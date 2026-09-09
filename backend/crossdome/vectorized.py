"""Vectorized, disk-backed all-against-all RdS computation for large peptide sets.

run_comparison (runner.py) scores one pair at a time in pure Python
(~700-800 pairs/sec) and is limited to MAX_COMPARE_PAIRS on the web server.
This module computes RdS for every pair within a single peptide list by
treating each peptide position as an independent all-vs-all distance problem
and solving it with scipy.spatial.distance.cdist, reaching tens of millions
of pairs/sec. In exchange, every peptide must be the same length, and results
are written to a disk-backed memmap instead of returned as an in-memory
DataFrame, since the pair count for large N (N choose 2) can run into the
billions.

Ported from the standalone rds-dist/compute_rds_distribution.py research
script (used to build the exhaustive human-immunopeptidome RdS distribution
figures), generalized to accept an arbitrary user-supplied peptide list
instead of the internal bio-database.

Output format (in --out-dir):
  peptides.npy     - string array of shape (N,), index -> peptide sequence
  distances.dat    - float16 condensed upper-triangle memmap, shape (N*(N-1)//2,)
  metadata.json    - length, N, pair count, rds_mu/rds_sigma used for z/p-values
  progress.json    - checkpoint (last completed block), enables --resume
  pvalues.dat      - float32 memmap, same order as distances.dat (added by compute_pvalues)
  pvalues_adj.dat  - float32 memmap, BH-FDR-adjusted (added by compute_pvalues, optional)

Condensed upper triangle: for pair (i, j) with i < j, the index into
distances.dat is  i*(2N-i-1)//2 + (j-i-1). This gives O(1) random access and
halves storage versus a full symmetric matrix.

Significance (compute_pvalues) is a separate, later pass over the saved
distances.dat rather than something computed inline during
compute_all_against_all. The raw p-value for a pair is a pointwise transform
of its RdS score against the population's fixed mu/sigma, so it can be
streamed in bounded memory at any scale. Benjamini-Hochberg FDR correction,
however, ranks every p-value against every other, so it inherently needs the
full p-value array in memory -- there is no way to stream it. That is the
whole reason it was left out of the main compute step.
"""

from __future__ import annotations

import json
import time
from pathlib import Path
from typing import Callable

import numpy as np
import pandas as pd
from scipy.spatial.distance import cdist
from scipy.stats import norm
from statsmodels.stats.multitest import multipletests

from .data_loader import load_scoring_data
from .stats import get_length_parameters

ProgressCallback = Callable[[int, int, int, int, float], None]


def _position_embeddings(peptides: list[str], mds: pd.DataFrame) -> list[np.ndarray]:
    """One (N, D) MDS-coordinate array per peptide position."""
    length = len(peptides[0])
    missing = sorted(set("".join(peptides)).difference(mds.columns))
    if missing:
        raise ValueError(f"MDS components are missing amino acids: {missing}")
    return [mds[[pep[p] for pep in peptides]].to_numpy(dtype=float).T for p in range(length)]


def _row_offset(i: int, n: int) -> int:
    """Start index in the condensed array for row i (all pairs j > i)."""
    return i * (2 * n - i - 1) // 2


def _compute_block(embeddings: list[np.ndarray], row_s: int, row_e: int, col_s: int, col_e: int) -> np.ndarray:
    length = len(embeddings)
    block = np.zeros((row_e - row_s, col_e - col_s), dtype=np.float32)
    for pos_emb in embeddings:
        block += cdist(pos_emb[row_s:row_e], pos_emb[col_s:col_e], metric="euclidean")
    block /= length
    return block


def _write_block(dist: np.memmap, block: np.ndarray, row_s: int, col_s: int, col_e: int, n: int) -> None:
    """Write the upper-triangle portion of a computed block into the condensed memmap."""
    for local_i in range(block.shape[0]):
        global_i = row_s + local_i
        j_lo = max(col_s, global_i + 1)
        if j_lo >= col_e:
            continue
        local_j_lo = j_lo - col_s
        run_length = col_e - j_lo
        offset = _row_offset(global_i, n) + (j_lo - global_i - 1)
        dist[offset: offset + run_length] = block[local_i, local_j_lo:].astype(np.float16)


def compute_all_against_all(
    peptides: list[str],
    bio_dir: str | Path,
    out_dir: str | Path,
    chunk_rows: int = 2000,
    chunk_cols: int = 10000,
    resume: bool = False,
    progress_cb: ProgressCallback | None = None,
) -> dict:
    """
    Compute RdS for every pair within `peptides` (must all share one length)
    and write the condensed upper-triangle result to `out_dir` as a
    disk-backed memmap.

    progress_cb, if given, is called after each block as
    (block_idx, n_blocks, pairs_done, n_pairs, elapsed_seconds).
    """
    peptides = list(dict.fromkeys(p.strip().upper() for p in peptides if p.strip()))
    lengths = {len(p) for p in peptides}
    if len(lengths) != 1:
        raise ValueError(
            "all-against-all requires every peptide to be the same length. "
            f"Found lengths: {sorted(lengths)}. Split the input by length and run once per length."
        )
    length = lengths.pop()

    n = len(peptides)
    if n < 2:
        raise ValueError("Need at least 2 peptides to compute pairs.")
    n_pairs = n * (n - 1) // 2

    out_dir = Path(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    pep_path = out_dir / "peptides.npy"
    dist_path = out_dir / "distances.dat"
    ckpt_path = out_dir / "progress.json"
    meta_path = out_dir / "metadata.json"

    mds, _ = load_scoring_data(str(Path(bio_dir).resolve()))
    params = get_length_parameters(bio_dir, length)
    embeddings = _position_embeddings(peptides, mds)

    if not pep_path.exists() or not resume:
        np.save(str(pep_path), np.array(peptides))

    mode = "r+" if (dist_path.exists() and resume) else "w+"
    dist = np.memmap(str(dist_path), dtype=np.float16, mode=mode, shape=(n_pairs,))

    start_block = 0
    if resume and ckpt_path.exists():
        start_block = json.loads(ckpt_path.read_text()).get("last_block", 0)

    blocks = []
    for row_s in range(0, n, chunk_rows):
        row_e = min(row_s + chunk_rows, n)
        for col_s in range(row_s, n, chunk_cols):
            col_e = min(col_s + chunk_cols, n)
            blocks.append((row_s, row_e, col_s, col_e))

    pairs_done = sum((row_e - row_s) * (col_e - col_s) for row_s, row_e, col_s, col_e in blocks[:start_block])
    t_start = time.perf_counter()

    for block_idx, (row_s, row_e, col_s, col_e) in enumerate(blocks):
        if block_idx < start_block:
            continue

        block = _compute_block(embeddings, row_s, row_e, col_s, col_e)
        _write_block(dist, block, row_s, col_s, col_e, n)
        dist.flush()

        pairs_done += (row_e - row_s) * (col_e - col_s)
        ckpt_path.write_text(json.dumps({"last_block": block_idx + 1, "pairs_done": int(pairs_done)}))

        if progress_cb:
            progress_cb(block_idx + 1, len(blocks), pairs_done, n_pairs, time.perf_counter() - t_start)

    dist.flush()

    metadata = {
        "length": length,
        "n_peptides": n,
        "n_pairs": n_pairs,
        "rds_mu": params["rds_mu"],
        "rds_sigma": params["rds_sigma"],
        "peptides_path": str(pep_path),
        "distances_path": str(dist_path),
    }
    meta_path.write_text(json.dumps(metadata, indent=2))
    return metadata


# Rough per-pair peak memory for exact Benjamini-Hochberg correction: the raw
# p-value array (float32, 4B) plus statsmodels' internal argsort index
# (int64, 8B), sorted copy (float32, 4B), and adjusted output (float32, 4B).
_BH_BYTES_PER_PAIR = 20
_BH_MEMORY_GUARD_GB = 8.0


def compute_pvalues(
    out_dir: str | Path,
    chunk_size: int = 50_000_000,
    fdr: bool = True,
    force: bool = False,
    progress_cb: ProgressCallback | None = None,
) -> dict:
    """
    Post-process a completed compute_all_against_all run: add p-values for
    every pair in distances.dat.

    Always writes pvalues.dat (float32, same order as distances.dat) -- the
    raw one-sided p-value of each RdS score against the length's population
    mu/sigma (norm.cdf((score - mu) / sigma)). This is a pointwise transform,
    so it is streamed in `chunk_size`-pair blocks with bounded memory
    regardless of how large the run is.

    If `fdr` is true (default), also writes pvalues_adj.dat (float32):
    Benjamini-Hochberg FDR-corrected p-values across the whole run. Unlike
    the raw p-values, this ranks every p-value against every other, so it
    needs the full array in memory -- there is no chunked way to do it. Pass
    `force=True` to proceed anyway if the estimated footprint trips the
    built-in memory guard; otherwise skip it with `fdr=False` and compare the
    raw p-values against the fixed rds_cutoff_p005 / rds_cutoff_p001 columns
    in rds_length_parameters.csv instead.
    """
    out_dir = Path(out_dir)
    meta_path = out_dir / "metadata.json"
    metadata = json.loads(meta_path.read_text())
    n_pairs = metadata["n_pairs"]
    mu, sigma = metadata["rds_mu"], metadata["rds_sigma"]

    dist = np.memmap(out_dir / "distances.dat", dtype=np.float16, mode="r", shape=(n_pairs,))
    pvalue_path = out_dir / "pvalues.dat"
    pvals = np.memmap(pvalue_path, dtype=np.float32, mode="w+", shape=(n_pairs,))

    n_chunks = (n_pairs + chunk_size - 1) // chunk_size
    t_start = time.perf_counter()
    for chunk_idx, start in enumerate(range(0, n_pairs, chunk_size)):
        end = min(start + chunk_size, n_pairs)
        z = (dist[start:end].astype(np.float32) - mu) / sigma
        pvals[start:end] = norm.cdf(z)
        if progress_cb:
            progress_cb(chunk_idx + 1, n_chunks, end, n_pairs, time.perf_counter() - t_start)
    pvals.flush()
    metadata["pvalues_path"] = str(pvalue_path)

    if fdr:
        est_gb = n_pairs * _BH_BYTES_PER_PAIR / 1e9
        if est_gb > _BH_MEMORY_GUARD_GB and not force:
            raise ValueError(
                "Benjamini-Hochberg correction ranks every p-value against every other, so "
                f"it needs the full p-value array in memory. Estimated peak memory for "
                f"{n_pairs:,} pairs is ~{est_gb:.1f} GB, above the {_BH_MEMORY_GUARD_GB:.0f} GB "
                "guard. Re-run with force=True (--force on the CLI) if your machine can handle "
                "it, or skip FDR correction (fdr=False / --no-fdr) and compare the raw p-values "
                "against the fixed rds_cutoff_p005 / rds_cutoff_p001 columns in "
                "rds_length_parameters.csv instead."
            )

        _, adjusted, _, _ = multipletests(pvals[:], method="fdr_bh")
        adj_path = out_dir / "pvalues_adj.dat"
        adj = np.memmap(adj_path, dtype=np.float32, mode="w+", shape=(n_pairs,))
        adj[:] = adjusted.astype(np.float32)
        adj.flush()

        metadata["pvalues_adj_path"] = str(adj_path)
        metadata["n_significant_p_adj_0.05"] = int(np.sum(adj[:] <= 0.05))
        metadata["n_significant_p_adj_0.01"] = int(np.sum(adj[:] <= 0.01))

    meta_path.write_text(json.dumps(metadata, indent=2))
    return metadata


def _load_run(out_dir: str | Path) -> tuple[np.ndarray, np.memmap, dict, dict[str, int]]:
    out_dir = Path(out_dir)
    metadata = json.loads((out_dir / "metadata.json").read_text())
    peptides = np.load(out_dir / "peptides.npy")
    n, n_pairs = metadata["n_peptides"], metadata["n_pairs"]
    dist = np.memmap(out_dir / "distances.dat", dtype=np.float16, mode="r", shape=(n_pairs,))
    index = {pep: i for i, pep in enumerate(peptides)}
    return peptides, dist, metadata, index


def _pair_index(i: int, j: int, n: int) -> int:
    if i == j:
        raise ValueError("A peptide has no distance to itself in the condensed matrix.")
    if i > j:
        i, j = j, i
    return _row_offset(i, n) + (j - i - 1)


def lookup_pair(out_dir: str | Path, peptide1: str, peptide2: str) -> dict:
    """Look up the precomputed RdS (plus z-score/p-value) between two peptides from a completed run."""
    peptides, dist, metadata, index = _load_run(out_dir)
    p1, p2 = peptide1.strip().upper(), peptide2.strip().upper()
    for pep in (p1, p2):
        if pep not in index:
            raise ValueError(f"Peptide '{pep}' is not part of this all-against-all run.")
    score = float(dist[_pair_index(index[p1], index[p2], len(peptides))])
    z = (score - metadata["rds_mu"]) / metadata["rds_sigma"]
    return {"query": p1, "subject": p2, "relatedness_score": score, "zscore": z, "pvalue": float(norm.cdf(z))}


def top_k_neighbors(out_dir: str | Path, peptide: str, k: int = 10) -> pd.DataFrame:
    """Return the k most-related peptides to `peptide` from a completed all-against-all run."""
    peptides, dist, metadata, index = _load_run(out_dir)
    pep = peptide.strip().upper()
    if pep not in index:
        raise ValueError(f"Peptide '{pep}' is not part of this all-against-all run.")
    n = len(peptides)
    i = index[pep]
    scores = np.empty(n, dtype=np.float32)
    for j in range(n):
        scores[j] = np.nan if j == i else dist[_pair_index(i, j, n)]
    order = np.argsort(scores)
    order = order[order != i][:k]
    mu, sigma = metadata["rds_mu"], metadata["rds_sigma"]
    return pd.DataFrame({
        "subject": peptides[order],
        "relatedness_score": scores[order],
        "zscore": (scores[order] - mu) / sigma,
    })
