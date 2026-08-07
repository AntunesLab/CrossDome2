from __future__ import annotations

from pathlib import Path

import pandas as pd

REQUIRED = [
    "peptide_length",
    "rds_mu",
    "rds_sigma",
    "rds_cutoff_p005",
    "rds_cutoff_p001",
]

ALIASES = {
    "length": "peptide_length",
    "Peptide_Length": "peptide_length",
    "mu": "rds_mu",
    "sigma": "rds_sigma",
    "cutoff_p005": "rds_cutoff_p005",
    "cutoff_p001": "rds_cutoff_p001",
}


def find_parameter_file(bio_database_dir: str | Path) -> Path:
    base = Path(bio_database_dir)
    candidates = [
        base / "rds_length_parameters.parquet",
        base / "rds_length_parameters.csv",
    ]
    for path in candidates:
        if path.exists():
            return path
    raise FileNotFoundError(
        "Global RdS parameter file not found. Add bio-database/rds_length_parameters.csv "
        "or .parquet with peptide_length, rds_mu, rds_sigma, rds_cutoff_p005, "
        "and rds_cutoff_p001."
    )


def load_length_parameters(bio_database_dir: str | Path) -> pd.DataFrame:
    path = find_parameter_file(bio_database_dir)
    df = pd.read_parquet(path) if path.suffix == ".parquet" else pd.read_csv(path)
    df = df.rename(columns={k: v for k, v in ALIASES.items() if k in df.columns})
    missing = [c for c in REQUIRED if c not in df.columns]
    if missing:
        raise ValueError(f"RdS parameter file is missing columns: {missing}")
    out = df[REQUIRED].copy()
    for col in REQUIRED:
        out[col] = pd.to_numeric(out[col], errors="coerce")
    out = out.dropna().drop_duplicates("peptide_length", keep="last")
    out["peptide_length"] = out["peptide_length"].astype(int)
    return out


def get_length_parameters(bio_database_dir: str | Path, peptide_length: int) -> dict[str, float]:
    df = load_length_parameters(bio_database_dir)
    row = df[df["peptide_length"] == int(peptide_length)]
    if row.empty:
        raise ValueError(
            f"No RdS distribution parameters are available for peptide length {peptide_length}."
        )
    return row.iloc[0].to_dict()
