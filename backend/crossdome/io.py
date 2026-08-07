from __future__ import annotations

import os
import re
from pathlib import Path

import pandas as pd

STANDARD_AA = set("ACDEFGHIKLMNPQRSTVWY")


def normalize_peptide(value: str) -> str:
    return str(value).strip().upper()


def validate_peptide(peptide: str, min_length: int = 8, max_length: int = 25) -> str | None:
    peptide = normalize_peptide(peptide)
    if not (min_length <= len(peptide) <= max_length):
        return f"Length {len(peptide)} not in [{min_length}, {max_length}]"
    invalid = sorted(set(peptide).difference(STANDARD_AA))
    if invalid:
        return f"Invalid amino acid(s): {', '.join(invalid)}"
    return None


def parse_peptide_text(text: str, min_length: int = 8, max_length: int = 25):
    valid: list[str] = []
    invalid: list[tuple[str, str]] = []
    for token in re.split(r"[\s,;]+", text or ""):
        token = token.strip()
        if not token:
            continue
        peptide = normalize_peptide(token)
        reason = validate_peptide(peptide, min_length=min_length, max_length=max_length)
        if reason:
            invalid.append((token, reason))
        else:
            valid.append(peptide)
    return list(dict.fromkeys(valid)), invalid


def load_peptide_database(file_path: str | os.PathLike) -> pd.DataFrame:
    path = Path(file_path)
    if not path.exists():
        raise FileNotFoundError(f"Database file not found: {path}")

    ext = path.suffix.lower()
    if ext == ".parquet":
        df = pd.read_parquet(path)
    elif ext == ".csv":
        df = pd.read_csv(path)
    elif ext in {".txt", ".tsv"}:
        if ext == ".tsv":
            df = pd.read_csv(path, sep="\t")
        else:
            lines = [line.strip() for line in path.read_text(errors="ignore").splitlines() if line.strip()]
            if lines and ("," in lines[0] or "\t" in lines[0]):
                try:
                    df = pd.read_csv(path, sep=None, engine="python")
                except Exception:
                    df = pd.DataFrame({"peptide_sequence": lines})
            else:
                df = pd.DataFrame({"peptide_sequence": lines})
    else:
        raise ValueError("Supported database formats: .parquet, .csv, .tsv, .txt")

    aliases = ["peptide_sequence", "peptide", "subject", "sequence", "epitope"]
    if "peptide_sequence" not in df.columns:
        source = next((c for c in aliases if c in df.columns), None)
        if source is None:
            raise ValueError("Database must contain a peptide sequence column.")
        df = df.rename(columns={source: "peptide_sequence"})

    df["peptide_sequence"] = df["peptide_sequence"].astype(str).str.strip().str.upper()
    if "peptide_length" not in df.columns:
        df["peptide_length"] = df["peptide_sequence"].str.len()
    else:
        df["peptide_length"] = pd.to_numeric(df["peptide_length"], errors="coerce")
    return df


def load_hla_database(file_path: str | os.PathLike) -> pd.DataFrame:
    df = load_peptide_database(file_path)
    if "hla_allele" not in df.columns:
        raise ValueError(f"Required column 'hla_allele' missing in {file_path}")
    return df


def merge_custom_database(main_df: pd.DataFrame, custom_path: str | None, allele: str) -> pd.DataFrame:
    if not custom_path:
        return main_df
    custom = load_peptide_database(custom_path)
    custom["hla_allele"] = allele
    if "resource" not in custom.columns:
        custom["resource"] = "Custom database"
    merged = pd.concat([main_df, custom], ignore_index=True, sort=False)
    return merged.drop_duplicates(subset=["peptide_sequence", "hla_allele"], keep="first")
