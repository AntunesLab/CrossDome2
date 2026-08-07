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
