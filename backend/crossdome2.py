from __future__ import annotations

import argparse
from pathlib import Path

import pandas as pd

from crossdome.io import parse_peptide_text
from crossdome.runner import parse_tcr_weights, run_analysis, run_comparison
from crossdome.vectorized import compute_all_against_all, compute_pvalues


def _fmt_time(seconds: float) -> str:
    if seconds < 60:
        return f"{seconds:.0f}s"
    if seconds < 3600:
        return f"{seconds / 60:.1f}min"
    return f"{seconds / 3600:.1f}h"


def main():
    parser = argparse.ArgumentParser(description="CrossDome 2.1")
    parser.add_argument("--bio-dir", default=str(Path(__file__).resolve().parent / "bio-database"))
    sub = parser.add_subparsers(dest="command", required=True)

    analyze = sub.add_parser("analyze")
    analyze.add_argument("query", help="One peptide or comma-separated peptides")
    analyze.add_argument("allele")
    analyze.add_argument("--species", default="human")
    analyze.add_argument("--mhc-class", default="I", choices=["I", "II"])
    analyze.add_argument("--custom-db")
    analyze.add_argument("--tcr-weights", help="Comma/space-separated positional weights")
    analyze.add_argument("--output", default="crossdome_results.csv")

    compare = sub.add_parser("compare", help="Pairwise loop comparison of two peptide lists (any lengths).")
    compare.add_argument("subjects")
    compare.add_argument("targets")
    compare.add_argument("--tcr-weights")
    compare.add_argument("--output", default="crossdome_comparison.csv")

    batch = sub.add_parser(
        "all-against-all",
        help=(
            "Vectorized, disk-backed RdS for every pair within one peptide list "
            "(all peptides must share one length). Orders of magnitude faster than "
            "'compare' for large lists, at the cost of writing a memmap to --out-dir "
            "instead of a single CSV."
        ),
    )
    batch.add_argument("peptides_file", help="Text/CSV file with one peptide per line (or comma/whitespace separated)")
    batch.add_argument("--out-dir", required=True, help="Output directory for peptides.npy / distances.dat / metadata.json")
    batch.add_argument("--chunk-rows", type=int, default=2000, help="Row block size (default: 2000)")
    batch.add_argument("--chunk-cols", type=int, default=10000, help="Column block size (default: 10000)")
    batch.add_argument("--resume", action="store_true", help="Resume an interrupted run from its checkpoint")

    pvalues = sub.add_parser(
        "all-against-all-pvalues",
        help=(
            "Add p-values to a completed 'all-against-all' run. Always writes "
            "pvalues.dat (raw, streamed in bounded memory); also writes pvalues_adj.dat "
            "(Benjamini-Hochberg FDR-corrected) unless --no-fdr is given, since that step "
            "needs the full p-value array in memory."
        ),
    )
    pvalues.add_argument("--out-dir", required=True, help="Output directory from a completed 'all-against-all' run")
    pvalues.add_argument("--chunk-size", type=int, default=50_000_000, help="Pairs per streamed chunk for raw p-values (default: 50,000,000)")
    pvalues.add_argument("--no-fdr", action="store_true", help="Skip Benjamini-Hochberg correction (raw p-values only)")
    pvalues.add_argument("--force", action="store_true", help="Proceed with FDR correction even if it trips the memory guard")

    args = parser.parse_args()
    if args.command == "all-against-all":
        text = Path(args.peptides_file).read_text()
        peptides, invalid = parse_peptide_text(text)
        if invalid:
            print(f"Skipped {len(invalid):,} invalid peptide(s), e.g.: {invalid[:5]}")
        print(f"{len(peptides):,} unique valid peptides loaded from {args.peptides_file}")

        def _report(block_idx: int, n_blocks: int, pairs_done: int, n_pairs: int, elapsed: float) -> None:
            rate = pairs_done / elapsed if elapsed > 0 else 0
            eta = (n_pairs - pairs_done) / rate if rate > 0 else 0
            print(
                f"  block {block_idx:>6}/{n_blocks}  "
                f"{pairs_done / 1e9:.3f}B / {n_pairs / 1e9:.3f}B pairs  "
                f"{rate / 1e6:.1f}M/s  ETA {_fmt_time(eta)}",
                flush=True,
            )

        metadata = compute_all_against_all(
            peptides,
            bio_dir=args.bio_dir,
            out_dir=args.out_dir,
            chunk_rows=args.chunk_rows,
            chunk_cols=args.chunk_cols,
            resume=args.resume,
            progress_cb=_report,
        )
        print(
            f"Done. {metadata['n_pairs']:,} pairs across {metadata['n_peptides']:,} "
            f"peptides (length {metadata['length']})."
        )
        print(f"  distances : {metadata['distances_path']}")
        print(f"  peptides  : {metadata['peptides_path']}")
        return

    if args.command == "all-against-all-pvalues":
        def _report(chunk_idx: int, n_chunks: int, pairs_done: int, n_pairs: int, elapsed: float) -> None:
            rate = pairs_done / elapsed if elapsed > 0 else 0
            eta = (n_pairs - pairs_done) / rate if rate > 0 else 0
            print(
                f"  chunk {chunk_idx:>4}/{n_chunks}  "
                f"{pairs_done / 1e9:.3f}B / {n_pairs / 1e9:.3f}B pairs  "
                f"{rate / 1e6:.1f}M/s  ETA {_fmt_time(eta)}",
                flush=True,
            )

        metadata = compute_pvalues(
            args.out_dir,
            chunk_size=args.chunk_size,
            fdr=not args.no_fdr,
            force=args.force,
            progress_cb=_report,
        )
        print(f"Done. pvalues: {metadata['pvalues_path']}")
        if "pvalues_adj_path" in metadata:
            print(f"  pvalues_adj (BH-FDR) : {metadata['pvalues_adj_path']}")
            print(f"  significant at p_adj<=0.05: {metadata['n_significant_p_adj_0.05']:,}")
            print(f"  significant at p_adj<=0.01: {metadata['n_significant_p_adj_0.01']:,}")
        return

    if args.command == "analyze":
        queries, invalid = parse_peptide_text(args.query)
        if invalid:
            print("Skipped invalid input:", invalid)
        objects, _ = run_analysis(
            args.allele,
            queries,
            bio_dir=args.bio_dir,
            species=args.species,
            mhc_class=args.mhc_class,
            custom_database_path=args.custom_db,
            tcr_weights=parse_tcr_weights(args.tcr_weights),
        )
        df = pd.concat([o.result for o in objects], ignore_index=True)
    else:
        subjects, _ = parse_peptide_text(args.subjects)
        targets, _ = parse_peptide_text(args.targets)
        df = run_comparison(subjects, targets, bio_dir=args.bio_dir, tcr_weights=parse_tcr_weights(args.tcr_weights))

    df.to_csv(args.output, index=False)
    print(f"Saved {len(df):,} rows to {args.output}")


if __name__ == "__main__":
    main()
