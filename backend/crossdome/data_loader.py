from __future__ import annotations

from functools import lru_cache
from pathlib import Path
from typing import Iterable

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


def _join_gene_names(genes: Iterable[str]) -> str:
    names = list(genes)
    if len(names) <= MAX_REPORTED_GENES:
        return ", ".join(names)
    kept = ", ".join(names[:MAX_REPORTED_GENES])
    return f"{kept}, +{len(names) - MAX_REPORTED_GENES} more"


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
