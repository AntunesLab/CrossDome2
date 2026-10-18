from __future__ import annotations

import re
from functools import lru_cache
from pathlib import Path
from typing import Iterable, Mapping, Sequence

import pandas as pd


@lru_cache(maxsize=4)
def load_scoring_data(bio_database_dir: str):
    base = Path(bio_database_dir)
    rdata = base / "sysdata.rda"
    mds_csv = base / "MDS_COMPONENTS.csv"
    blosum_csv = base / "BLOSUM80.csv"

    if rdata.exists():
        try:
            import pyreadr
        except ImportError as exc:
            raise RuntimeError("pyreadr is required to load sysdata.rda") from exc
        loaded = pyreadr.read_r(str(rdata))
        if "MDS_COMPONENTS" not in loaded or "BLOSUM80" not in loaded:
            raise RuntimeError("sysdata.rda must contain MDS_COMPONENTS and BLOSUM80")
        return loaded["MDS_COMPONENTS"], loaded["BLOSUM80"]

    if mds_csv.exists() and blosum_csv.exists():
        mds = pd.read_csv(mds_csv, index_col=0)
        blosum = pd.read_csv(blosum_csv, index_col=0)
        return mds, blosum

    raise FileNotFoundError(
        "Scoring data not found. Add bio-database/sysdata.rda, or both "
        "MDS_COMPONENTS.csv and BLOSUM80.csv."
    )


# Columns of hpa_database.parquet that are not per-tissue expression values.
NON_TISSUE_COLUMNS = frozenset(
    {"ensembl_id", "gene_donor", "Group", "spec_degree", "tissues"}
)

# A handful of low-complexity entries in the digest map to absurd numbers of
# genes (one maps to 17,984), which would produce a cell no reader can use. The
# reported gene list is truncated past this many names, with the full count kept
# in n_source_genes. Only 0.03% of peptides map to more genes than this.
MAX_REPORTED_GENES = 25

TRUNCATION_MARKER = re.compile(r"^\+(\d+) more$")

# The 20 standard residues, used to extend an 8-mer back into the 9-mer windows
# that contain it. Kept here rather than imported from core to avoid a cycle.
FLANK_RESIDUES = "ACDEFGHIKLMNPQRSTVWY"

ANNOTATION_COLUMNS = ["peptide_sequence", "ensembl_id", "gene_donor", "n_source_genes"]


@lru_cache(maxsize=4)
def load_gene_expression_breadth(bio_database_dir: str) -> pd.DataFrame:
    """ensembl_id -> expression breadth, for picking a representative gene.

    A peptide can be produced by several genes (paralogues, genes sharing a
    domain). All of them are reported, but the tissue-expression figure joins on
    exactly one gene per peptide, so the most broadly expressed one is used:
    detected in the most tissues, then highest mean expression across tissues.
    HPA's own spec_degree column is deliberately not used here -- it is a
    specificity class rather than a breadth count, and assigns its maximum value
    to "Not-Expressed" genes as well as to low-specificity ones.
    """
    path = Path(bio_database_dir) / "hpa_database.parquet"
    empty = pd.DataFrame(columns=["ensembl_id", "_n_tissues", "_mean_expr"])
    if not path.exists():
        return empty

    hpa = pd.read_parquet(path)
    tissue_cols = [c for c in hpa.columns if c not in NON_TISSUE_COLUMNS]
    if "ensembl_id" not in hpa.columns or not tissue_cols:
        return empty

    breadth = pd.DataFrame(
        {
            "ensembl_id": hpa["ensembl_id"],
            "_n_tissues": (hpa[tissue_cols] > 0).sum(axis=1).astype("int32"),
            "_mean_expr": hpa[tissue_cols].mean(axis=1).fillna(0.0),
        }
    )
    return breadth.drop_duplicates(subset=["ensembl_id"], keep="first")


def _join_gene_names(genes: Iterable[str], hidden: int = 0) -> str:
    """Format a gene list for display, truncating past MAX_REPORTED_GENES.

    hidden carries names already dropped by an earlier truncation, so that
    merging two truncated lists reports one combined marker rather than two.
    """
    names = list(genes)
    overflow = max(0, len(names) - MAX_REPORTED_GENES) + hidden
    kept = ", ".join(names[:MAX_REPORTED_GENES])
    if not overflow:
        return kept
    return f"{kept}, +{overflow} more" if kept else f"+{overflow} more"


def _split_gene_names(gene_donor: object) -> tuple[list[str], int]:
    """Inverse of _join_gene_names: the listed names, plus the hidden count."""
    if not isinstance(gene_donor, str) or not gene_donor:
        return [], 0
    names = [part for part in (chunk.strip() for chunk in gene_donor.split(",")) if part]
    hidden = 0
    if names:
        match = TRUNCATION_MARKER.match(names[-1])
        if match:
            hidden = int(match.group(1))
            names = names[:-1]
    return names, hidden


def aggregate_peptide_annotation(
    annot: pd.DataFrame, breadth: pd.DataFrame
) -> pd.DataFrame:
    """Collapse long-format peptide annotation to one row per peptide.

    peptide_annotation.parquet holds one row per originating gene, so merging it
    into a scored result table unchanged fans a single scored candidate into N
    duplicate-looking rows sharing the same rank and score. Collapsing it to one
    arbitrary gene instead discards something a reader needs: a peptide that can
    also be presented from another locus carries its own off-target risk. So
    every source gene is reported in gene_donor, most broadly expressed first,
    with the count in n_source_genes, while ensembl_id keeps the single
    representative gene the expression figure joins on.
    """
    if annot.empty:
        return pd.DataFrame(columns=ANNOTATION_COLUMNS)

    if "gene_donor" not in annot.columns:
        annot = annot.assign(gene_donor=None)
    annot = annot[["peptide_sequence", "ensembl_id", "gene_donor"]]

    duplicated = annot.duplicated(subset=["peptide_sequence"], keep=False)
    singles = annot.loc[~duplicated].copy()
    singles["n_source_genes"] = singles["gene_donor"].notna().astype("int64")
    if not duplicated.any():
        return singles[ANNOTATION_COLUMNS].reset_index(drop=True)

    multi = annot.loc[duplicated].merge(breadth, on="ensembl_id", how="left")
    # Genes missing from HPA sort last: they cannot anchor the expression figure.
    multi["_n_tissues"] = multi["_n_tissues"].fillna(-1)
    multi["_mean_expr"] = multi["_mean_expr"].fillna(-1.0)
    multi = multi.sort_values(
        ["peptide_sequence", "_n_tissues", "_mean_expr", "ensembl_id"],
        ascending=[True, False, False, True],
        kind="stable",
    )

    named = multi.loc[multi["gene_donor"].notna()]
    named = named.drop_duplicates(subset=["peptide_sequence", "gene_donor"], keep="first")
    by_peptide = named.groupby("peptide_sequence", sort=False)["gene_donor"]

    aggregated = pd.DataFrame(
        {"ensembl_id": multi.groupby("peptide_sequence", sort=False)["ensembl_id"].first()}
    )
    aggregated["gene_donor"] = by_peptide.agg(_join_gene_names)
    aggregated["n_source_genes"] = (
        by_peptide.size().reindex(aggregated.index).fillna(0).astype("int64")
    )
    aggregated = aggregated.reset_index()

    return pd.concat(
        [singles[ANNOTATION_COLUMNS], aggregated[ANNOTATION_COLUMNS]], ignore_index=True
    )


@lru_cache(maxsize=4)
def load_annotation_nine_mer_index(
    bio_database_dir: str,
) -> dict[str, tuple[str, object, int]]:
    """9-mer peptide -> (ensembl_id, gene_donor, n_source_genes) index.

    peptide_annotation.parquet is overwhelmingly a 9-mer sliding-window digest
    of the human proteome (the standard Class I epitope workflow): it covers
    ~34,500 genes at length 9 but only a sparse, incomplete subset of genes at
    other lengths. A full digest at every peptide length actually present in
    the database (8-25mer) would be ~18x the current table (~1.4 GB on disk,
    ~12 GB in memory), so instead this index supports a containment fallback:
    callers check whether any 9-mer core window of a longer peptide hits a
    digested gene here, which recovers gene attribution for peptides whose
    exact full-length sequence was never materialized in the table.
    """
    path = Path(bio_database_dir) / "peptide_annotation.parquet"
    if not path.exists():
        return {}

    annot = pd.read_parquet(path)
    if "peptide_sequence" not in annot.columns or "ensembl_id" not in annot.columns:
        return {}
    if "gene_donor" not in annot.columns:
        annot = annot.assign(gene_donor=None)

    nine = annot.loc[
        annot["peptide_sequence"].astype(str).str.len() == 9,
        ["peptide_sequence", "ensembl_id", "gene_donor"],
    ]
    nine = aggregate_peptide_annotation(nine, load_gene_expression_breadth(bio_database_dir))
    return dict(
        zip(
            nine["peptide_sequence"],
            zip(nine["ensembl_id"], nine["gene_donor"], nine["n_source_genes"]),
        )
    )


@lru_cache(maxsize=4)
def load_gene_breadth_rank(bio_database_dir: str) -> dict[str, tuple[int, float]]:
    """ensembl_id -> (n tissues detected, mean expression), for tie-breaking.

    The dict form of load_gene_expression_breadth, for the lookups that happen
    one peptide at a time rather than through a merge. ~20K genes, so this is
    small enough to hold alongside the 9-mer index.
    """
    breadth = load_gene_expression_breadth(bio_database_dir)
    if breadth.empty:
        return {}
    return {
        str(gene): (int(n_tissues), float(mean_expr))
        for gene, n_tissues, mean_expr in zip(
            breadth["ensembl_id"], breadth["_n_tissues"], breadth["_mean_expr"]
        )
    }


def expand_eight_mer(
    peptide: str, nine_mer_index: Mapping[str, tuple[str, object, int]]
) -> list[tuple[str, object, int]]:
    """Digest entries for every 9-mer window that contains this 8-mer.

    An 8-mer is shorter than the digest key, so neither an exact match nor the
    9-mer core scan can ever annotate it -- yet 8-mers are 56% of the human
    Class I annotation gap. Every 8-mer window of a protein is the prefix or
    the suffix of some 9-mer window of that same protein, so re-extending the
    peptide by one residue on either side and testing all 40 candidates against
    the 9-mer index recovers exactly what a materialized 8-mer digest would,
    without shipping or loading one. 40 dict lookups is ~2.3us per peptide.
    """
    hits: list[tuple[str, object, int]] = []
    for residue in FLANK_RESIDUES:
        for candidate in (residue + peptide, peptide + residue):
            hit = nine_mer_index.get(candidate)
            if hit is not None and hit not in hits:
                hits.append(hit)
    return hits


def merge_annotation_entries(
    entries: Sequence[tuple[str, object, int]],
    breadth_rank: Mapping[str, tuple[int, float]],
) -> tuple[str, object, int]:
    """Union several digest entries for one peptide into a single entry.

    An 8-mer typically sits in two different 9-mer windows (one per flank) and
    sometimes many more, and 13.2% of the 8-mers recovered this way reach more
    than one gene that way. Taking the first hit would hide the others, which
    is precisely the alternative-locus risk gene_donor exists to surface, so
    every gene is carried over. The representative ensembl_id that the
    expression figure joins on is re-picked by the same breadth rule
    aggregate_peptide_annotation applies: most tissues, then highest mean
    expression, then ensembl_id for determinism.
    """
    if len(entries) == 1:
        return entries[0]

    names: list[str] = []
    seen: set[str] = set()
    hidden = 0
    for _, gene_donor, _ in entries:
        listed, extra = _split_gene_names(gene_donor)
        hidden += extra
        for name in listed:
            if name not in seen:
                seen.add(name)
                names.append(name)

    def _breadth_key(ensembl_id: object) -> tuple[int, float, str]:
        n_tissues, mean_expr = breadth_rank.get(str(ensembl_id), (-1, -1.0))
        # Genes missing from HPA sort last: they cannot anchor the figure.
        return (-n_tissues, -mean_expr, str(ensembl_id))

    ensembl_id = min((entry[0] for entry in entries), key=_breadth_key)
    # hidden is an upper bound on the genes past the display cap, since the
    # truncated tails of two entries can overlap. It is reported anyway:
    # overstating how many loci a low-complexity peptide maps to is safer than
    # dropping the marker. Only reachable for the 0.03% of entries past the cap.
    joined = _join_gene_names(names, hidden) if (names or hidden) else None
    return ensembl_id, joined, len(names) + hidden
