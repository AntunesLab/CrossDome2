from __future__ import annotations

from pathlib import Path
from typing import Iterable

import numpy as np
import pandas as pd
from scipy.stats import norm
from statsmodels.stats.multitest import multipletests

from .data_loader import load_scoring_data
from .models import XRBackground, XRResult
from .stats import get_length_parameters
from .visualization import BINDING_TOOLS, IMMUNOGENICITY_TOOLS

STANDARD_AA = set("ACDEFGHIKLMNPQRSTVWY")

# Percentile columns are preserved in the downloadable result table when they
# are available in predictions.parquet. They are not used as frontend selectors.
PREDICTION_PERCENTILE_COLUMNS = [
    "BigMHC_EL_percentile",
    "BigMHC_IM_percentile",
    "NetMHC_percentile",
    "NetMHCpan_percentile",
    "NetMHCpanEL_percentile",
    "MixMHCpred_percentile",
    "MHCflurryEL_percentile",
    "PRIME_percentile",
    "DeepImmuno_percentile",
    "best_percentile",
    "median_percentile",
]


def _validate_pair(a: str, b: str) -> tuple[list[str], list[str]]:
    a = str(a).strip().upper()
    b = str(b).strip().upper()

    if len(a) != len(b):
        raise ValueError(f"Peptides must have the same length. Got {len(a)} and {len(b)}.")

    for peptide, label in [(a, "query"), (b, "subject")]:
        invalid = set(peptide).difference(STANDARD_AA)
        if invalid:
            raise ValueError(
                f"Invalid amino acid(s) in {label} peptide '{peptide}': {sorted(invalid)}"
            )

    return list(a), list(b)


def _related_distance(
    query: list[str],
    subject: list[str],
    weights: list[float],
    mds: pd.DataFrame,
) -> float:
    missing = sorted(set(query + subject).difference(mds.columns))
    if missing:
        raise ValueError(f"MDS components are missing amino acids: {missing}")

    q = mds[query].to_numpy(dtype=float)
    s = mds[subject].to_numpy(dtype=float)
    per_position = np.sqrt(np.sum((q - s) ** 2, axis=0))

    # Same weighting behavior used in the previous CrossDome implementation.
    weighted = per_position * np.sqrt(np.asarray(weights, dtype=float))
    return float(np.sum(weighted) / len(query))


def calculate_rds_between_peptides(
    peptide1: str,
    peptide2: str,
    position_weight: list[float] | None = None,
    bio_database_dir: str | Path = "bio-database",
) -> float:
    q, s = _validate_pair(peptide1, peptide2)
    weights = list(position_weight or [1.0] * len(q))

    if len(weights) != len(q):
        raise ValueError(f"Expected {len(q)} TCR weights, received {len(weights)}.")
    if any(w < 0 for w in weights):
        raise ValueError("TCR position weights must be non-negative.")

    mds, _ = load_scoring_data(str(Path(bio_database_dir).resolve()))
    return _related_distance(q, s, weights, mds)


def _normalize_column_name(name: str) -> str:
    return (
        str(name)
        .strip()
        .lower()
        .replace("-", "_")
        .replace(" ", "_")
        .replace(".", "_")
    )


def _find_column(df: pd.DataFrame, aliases: Iterable[str]) -> str | None:
    normalized = {_normalize_column_name(c): c for c in df.columns}
    for alias in aliases:
        key = _normalize_column_name(alias)
        if key in normalized:
            return normalized[key]
    return None


def _prediction_aliases() -> dict[str, list[str]]:
    return {
        "BigMHC-EL": ["BigMHC-EL", "BigMHC_EL", "bigmhc_el"],
        "NetMHC": ["NetMHC", "netmhc"],
        "NetMHCpan": ["NetMHCpan", "netmhcpan"],
        "NetMHCpan-EL": ["NetMHCpan-EL", "NetMHCpan_EL", "netmhcpan_el"],
        "MixMHCpred": ["MixMHCpred", "mixmhcpred"],
        "MHCflurryEL": ["MHCflurryEL", "mhcflurryel", "mhcflurry_el"],
        "BigMHC_IM": ["BigMHC_IM", "BigMHC-IM", "bigmhc_im"],
        "PRIME": ["PRIME", "prime"],
        "DeepImmuno": ["DeepImmuno", "deepimmuno", "deep_immuno"],
        "TLImm": ["TLImm", "tlimm", "tl_imm"],
        "BigMHC_EL_percentile": ["BigMHC_EL_percentile", "BigMHC-EL_percentile"],
        "BigMHC_IM_percentile": ["BigMHC_IM_percentile", "BigMHC-IM_percentile"],
        "NetMHC_percentile": ["NetMHC_percentile"],
        "NetMHCpan_percentile": ["NetMHCpan_percentile"],
        "NetMHCpanEL_percentile": ["NetMHCpanEL_percentile", "NetMHCpan_EL_percentile"],
        "MixMHCpred_percentile": ["MixMHCpred_percentile"],
        "MHCflurryEL_percentile": ["MHCflurryEL_percentile"],
        "PRIME_percentile": ["PRIME_percentile"],
        "DeepImmuno_percentile": ["DeepImmuno_percentile"],
        "best_percentile": ["best_percentile"],
        "median_percentile": ["median_percentile"],
    }


def _merge_predictions(df: pd.DataFrame, bio_dir: Path, allele: str) -> pd.DataFrame:
    """
    Merge all prediction tools present in predictions.parquet.

    The user's current table contains:
      BigMHC-EL, BigMHC_IM, NetMHC, NetMHCpan, NetMHCpan-EL,
      MixMHCpred, MHCflurryEL, PRIME, DeepImmuno, TLImm,
      plus prediction percentile columns.
    """
    path = bio_dir / "predictions.parquet"
    display_tools = BINDING_TOOLS + IMMUNOGENICITY_TOOLS
    aliases = _prediction_aliases()

    out = df.copy()
    for col in display_tools + PREDICTION_PERCENTILE_COLUMNS:
        if col not in out.columns:
            out[col] = np.nan

    if not path.exists():
        return out

    pred = pd.read_parquet(path)
    peptide_col = _find_column(
        pred,
        ["peptide_sequence", "peptide", "subject", "epitope", "sequence"],
    )
    if peptide_col is None:
        raise ValueError("predictions.parquet has no recognizable peptide column.")

    pred = pred.copy()
    pred["_pep"] = pred[peptide_col].astype(str).str.upper().str.strip()

    allele_col = _find_column(pred, ["hla_allele", "allele", "mhc_allele", "hla"])
    if allele_col is not None:
        pred["_allele"] = pred[allele_col].astype(str).str.strip()
        pred = pred[pred["_allele"] == str(allele).strip()].copy()

    keep = ["_pep"]
    for output_name in display_tools + PREDICTION_PERCENTILE_COLUMNS:
        source = _find_column(pred, aliases.get(output_name, [output_name]))
        pred[output_name] = pd.to_numeric(pred[source], errors="coerce") if source else np.nan
        keep.append(output_name)

    # Multiple source files can contain the same peptide/allele. Averaging
    # numeric prediction values prevents duplicate CrossDome result rows.
    pred = pred[keep].groupby("_pep", as_index=False).mean(numeric_only=True)

    out = out.drop(
        columns=display_tools + PREDICTION_PERCENTILE_COLUMNS,
        errors="ignore",
    ).copy()
    out["_pep"] = out["subject"].astype(str).str.upper().str.strip()
    out = out.merge(pred, on="_pep", how="left")
    out.drop(columns="_pep", inplace=True)
    return out


def _add_expression(df: pd.DataFrame, bio_dir: Path):
    annot_path = bio_dir / "peptide_annotation.parquet"
    hpa_path = bio_dir / "hpa_database.parquet"

    if not (annot_path.exists() and hpa_path.exists()):
        return df, pd.DataFrame()

    annot = pd.read_parquet(annot_path)
    hpa = pd.read_parquet(hpa_path)

    required_annot = {"peptide_sequence", "ensembl_id"}
    if not required_annot.issubset(annot.columns) or "ensembl_id" not in hpa.columns:
        return df, pd.DataFrame()

    merged = df.merge(
        annot,
        left_on="subject",
        right_on="peptide_sequence",
        how="left",
    )
    merged = merged.merge(hpa, on="ensembl_id", how="left")

    non_tissue = {
        "ensembl_id",
        "gene_donor",
        "Group",
        "spec_degree",
        "tissues",
    }
    tissue_cols = [c for c in hpa.columns if c not in non_tissue]

    expression = pd.DataFrame()
    if tissue_cols:
        expression = (
            merged
            .dropna(subset=["ensembl_id"])
            .drop_duplicates(subset=["subject"], keep="first")
            .set_index("subject")[tissue_cols]
        )

    return merged, expression


def cross_compose(
    query: str,
    background: XRBackground,
    bio_database_dir: str | Path,
    position_weight: list[float] | None = None,
    include_predictions: bool = False,
    include_expression: bool = False,
) -> XRResult:
    query = str(query).strip().upper()
    qlen = len(query)
    bio_dir = Path(bio_database_dir)

    params = get_length_parameters(bio_dir, qlen)
    mds, blosum = load_scoring_data(str(bio_dir.resolve()))

    rows = background.get_background_data().copy()
    if "peptide_length" in rows.columns:
        lengths = pd.to_numeric(rows["peptide_length"], errors="coerce")
        rows = rows[lengths == qlen].copy()
    else:
        rows = rows[rows["peptide_sequence"].astype(str).str.len() == qlen].copy()

    if rows.empty:
        raise ValueError(
            f"No peptides of length {qlen} found for allele {background.allele}."
        )

    weights = list(position_weight or [1.0] * qlen)
    if len(weights) != qlen:
        raise ValueError(
            f"Expected {qlen} TCR weights for query {query}, received {len(weights)}."
        )
    if any(w < 0 for w in weights):
        raise ValueError("TCR position weights must be non-negative.")

    result_rows = []
    skipped = []

    for _, row in rows.iterrows():
        subject = str(row["peptide_sequence"]).strip().upper()
        try:
            q, s = _validate_pair(query, subject)
            score = _related_distance(q, s, weights, mds)
        except ValueError as exc:
            skipped.append({"peptide": subject, "reason": str(exc)})
            continue

        num_positive = 0
        for qa, sa in zip(query, subject):
            try:
                num_positive += int(float(blosum.loc[qa, sa]) > 0)
            except Exception:
                pass

        result_rows.append(
            {
                "query": query,
                "subject": subject,
                "relatedness_score": score,
                "num_positive": num_positive,
                "num_mismatch": sum(a != b for a, b in zip(query, subject)),
                "peptide_length": qlen,
                "hla_allele": background.allele,
                "resource": row.get("resource"),
            }
        )

    if not result_rows:
        raise ValueError(f"No valid background peptides remained for query {query}.")

    out = pd.DataFrame(result_rows)

    mu = float(params["rds_mu"])
    sigma = float(params["rds_sigma"])
    if sigma <= 0:
        raise ValueError(f"Invalid rds_sigma={sigma} for peptide length {qlen}.")

    out["rds_mu"] = mu
    out["rds_sigma"] = sigma
    out["rds_cutoff_p005"] = float(params["rds_cutoff_p005"])
    out["rds_cutoff_p001"] = float(params["rds_cutoff_p001"])
    out["zscore"] = (out["relatedness_score"] - mu) / sigma
    out["pvalue"] = norm.cdf(out["zscore"])

    _, adjusted, _, _ = multipletests(out["pvalue"].to_numpy(), method="fdr_bh")
    out["pvalue_adj"] = adjusted
    out["significant"] = out["pvalue_adj"] <= 0.05
    out["percentile_rank"] = (
        out["relatedness_score"].rank(method="min", ascending=True) / len(out) * 100
    )
    out["rank"] = out["relatedness_score"].rank(method="min", ascending=True).astype(int)
    out = out.sort_values(["rank", "subject"]).reset_index(drop=True)

    if include_predictions:
        out = _merge_predictions(out, bio_dir, background.allele)

    expression = pd.DataFrame()
    if include_expression:
        out, expression = _add_expression(out, bio_dir)

    return XRResult(
        query=query,
        result=out,
        allele=background.allele,
        position_weight=weights,
        expression_matrix=expression,
        metadata={
            "skipped_invalid_peptides_count": len(skipped),
            "skipped_invalid_peptides_preview": skipped[:20],
            "peptide_length": qlen,
        },
    )
