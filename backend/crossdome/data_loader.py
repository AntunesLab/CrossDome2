from __future__ import annotations

from functools import lru_cache
from pathlib import Path

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


@lru_cache(maxsize=4)
def load_annotation_nine_mer_index(bio_database_dir: str) -> dict[str, tuple[str, object]]:
    """9-mer peptide -> (ensembl_id, gene_donor) index from peptide_annotation.parquet.

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
    nine = nine.drop_duplicates(subset=["peptide_sequence"], keep="first")
    return dict(zip(nine["peptide_sequence"], zip(nine["ensembl_id"], nine["gene_donor"])))
