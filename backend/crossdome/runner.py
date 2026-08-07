from __future__ import annotations

import re
from pathlib import Path
from typing import Any

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import pandas as pd
from scipy.stats import norm
from statsmodels.stats.multitest import multipletests

from .core import calculate_rds_between_peptides, cross_compose
from .io import load_hla_database, merge_custom_database, parse_peptide_text
from .models import XRBackground
from .stats import get_length_parameters
from .visualization import (
    BINDING_TOOLS,
    IMMUNOGENICITY_TOOLS,
    generate_expression_heatmap,
    plot_prediction_tools,
)


def parse_tcr_weights(text: str | None) -> list[float] | None:
    if not text or not text.strip():
        return None

    parts = [p for p in re.split(r"[\s,]+", text.strip()) if p]
    try:
        weights = [float(p) for p in parts]
    except ValueError as exc:
        raise ValueError(
            "TCR weights must be numeric values separated by commas or spaces."
        ) from exc

    if any(w < 0 for w in weights):
        raise ValueError("TCR weights must be non-negative.")
    return weights


def database_path(bio_dir: str | Path, species: str, mhc_class: str) -> Path:
    return Path(bio_dir) / f"{species.lower()}_class{mhc_class.upper()}.parquet"


def _clean_result_columns(df: pd.DataFrame) -> pd.DataFrame:
    # These are annotation/helper columns used to create the expression figure.
    # Keep gene_donor because it is useful in the downloadable table.
    annotation_only = [
        "peptide_sequence",
        "ensembl_id",
        "Group",
        "spec_degree",
        "tissues",
    ]
    return df.drop(columns=[c for c in annotation_only if c in df.columns], errors="ignore")


def _available_tools(result_df: pd.DataFrame, tools: list[str]) -> list[str]:
    """Return only prediction tools that contain at least one numeric value."""
    available = []
    for tool in tools:
        if tool not in result_df.columns:
            continue
        values = pd.to_numeric(result_df[tool], errors="coerce")
        if values.notna().any():
            available.append(tool)
    return available


def _save_human_outputs(result, output_dir: Path) -> dict[str, Any]:
    output_dir.mkdir(parents=True, exist_ok=True)

    available_binding = _available_tools(result.result, BINDING_TOOLS)
    available_immunogenicity = _available_tools(result.result, IMMUNOGENICITY_TOOLS)

    outputs: dict[str, Any] = {
        "binding_tools": available_binding,
        "immunogenicity_tools": available_immunogenicity,
        "prediction_plots": {},
    }

    if result.expression_matrix is not None and not result.expression_matrix.empty:
        filename = "expression_heatmap.png"
        fig = generate_expression_heatmap(
            result.expression_matrix,
            top_n=15,
            title="Peptide expression and tissue specificity",
        )
        fig.savefig(output_dir / filename, dpi=250, bbox_inches="tight")
        plt.close(fig)
        outputs["expression_heatmap"] = filename

    # Generate only valid combinations. This prevents a dropdown choice from
    # pointing to a plot whose selected prediction column is completely empty.
    for binding in available_binding:
        for immuno in available_immunogenicity:
            filename = (
                f"prediction_{binding.replace('-', '_')}_{immuno.replace('-', '_')}.png"
            )
            fig = plot_prediction_tools(
                result.result,
                binding_tool=binding,
                immunogenicity_tool=immuno,
                top_n=30,
            )
            fig.savefig(output_dir / filename, dpi=250, bbox_inches="tight")
            plt.close(fig)

            outputs["prediction_plots"][f"{binding}__{immuno}"] = {
                "binding_tool": binding,
                "immunogenicity_tool": immuno,
                "filename": filename,
            }

    return outputs


def run_analysis(
    allele: str,
    query_peptides: list[str],
    bio_dir: str | Path,
    species: str = "human",
    mhc_class: str = "I",
    custom_database_path: str | None = None,
    tcr_weights: list[float] | None = None,
    output_dir: str | Path | None = None,
):
    db_path = database_path(bio_dir, species, mhc_class)
    if not db_path.exists():
        raise FileNotFoundError(f"Database not found: {db_path}")

    hla_df = load_hla_database(db_path)
    hla_df = merge_custom_database(hla_df, custom_database_path, allele)
    background = XRBackground(allele=allele, full_background=hla_df)

    if tcr_weights is not None:
        lengths = sorted({len(q) for q in query_peptides})
        if len(lengths) != 1 or len(tcr_weights) != lengths[0]:
            raise ValueError(
                "One TCR weight vector is applied to all query peptides. All queries must have "
                f"the same length and the vector must match it. Query lengths={lengths}, "
                f"weights={len(tcr_weights)}."
            )

    objects = []
    outputs = {}

    for index, query in enumerate(query_peptides):
        is_human = species.lower() == "human"

        result = cross_compose(
            query=query,
            background=background,
            bio_database_dir=bio_dir,
            position_weight=tcr_weights,
            include_predictions=is_human,
            include_expression=is_human,
        )
        result.metadata.update(
            {
                "species": species,
                "MHC_class": mhc_class,
                "mode": "analyze",
            }
        )

        # The frontend currently presents a single output plot set. Generate
        # that set from the first query; every query still remains in the CSV.
        if index == 0 and is_human and output_dir:
            outputs = _save_human_outputs(result, Path(output_dir))
            result.metadata["outputs"] = outputs

        result.result = _clean_result_columns(result.result)
        objects.append(result)

    return objects, outputs


def run_comparison(
    subject_peptides: list[str],
    target_peptides: list[str],
    bio_dir: str | Path,
    tcr_weights: list[float] | None = None,
):
    rows = []

    for query in subject_peptides:
        for subject in target_peptides:
            if len(query) != len(subject):
                rows.append(
                    {
                        "query": query,
                        "subject": subject,
                        "relatedness_score": None,
                        "peptide_length": None,
                        "error": "Peptides have different lengths",
                    }
                )
                continue

            weights = tcr_weights
            if weights is not None and len(weights) != len(query):
                raise ValueError(
                    f"Expected {len(query)} TCR weights for comparison, "
                    f"received {len(weights)}."
                )

            score = calculate_rds_between_peptides(query, subject, weights, bio_dir)
            params = get_length_parameters(bio_dir, len(query))

            rows.append(
                {
                    "query": query,
                    "subject": subject,
                    "relatedness_score": score,
                    "num_positive": sum(a == b for a, b in zip(query, subject)),
                    "num_mismatch": sum(a != b for a, b in zip(query, subject)),
                    "peptide_length": len(query),
                    **params,
                }
            )

    df = pd.DataFrame(rows)
    valid = df["relatedness_score"].notna()

    df["zscore"] = None
    df["pvalue"] = None

    for idx in df.index[valid]:
        sigma = float(df.at[idx, "rds_sigma"])
        if sigma <= 0:
            raise ValueError(
                f"Invalid rds_sigma={sigma} for peptide length "
                f"{df.at[idx, 'peptide_length']}."
            )
        z = (
            float(df.at[idx, "relatedness_score"]) - float(df.at[idx, "rds_mu"])
        ) / sigma
        df.at[idx, "zscore"] = z
        df.at[idx, "pvalue"] = norm.cdf(z)

    df["pvalue_adj"] = None
    if valid.any():
        _, adj, _, _ = multipletests(
            pd.to_numeric(df.loc[valid, "pvalue"]),
            method="fdr_bh",
        )
        df.loc[valid, "pvalue_adj"] = adj

    df["significant"] = pd.to_numeric(df["pvalue_adj"], errors="coerce") <= 0.05
    df["rank"] = df["relatedness_score"].rank(
        method="min",
        ascending=True,
    ).astype("Int64")

    return df.sort_values("rank", na_position="last").reset_index(drop=True)


def handle_request(instructions: dict, bio_dir: str | Path, output_dir: str | Path):
    valid_subject, invalid_subject = parse_peptide_text(
        instructions.get("subject_data", "")
    )
    if not valid_subject:
        raise ValueError(f"No valid subject peptides found: {invalid_subject}")

    weights = parse_tcr_weights(instructions.get("tcr_weights"))
    mode = instructions.get("mode", "analyze")

    if mode == "analyze":
        allele = str(instructions.get("target_data", "")).strip()
        if not allele:
            raise ValueError("Missing HLA/MHC allele.")

        objects, outputs = run_analysis(
            allele=allele,
            query_peptides=valid_subject,
            bio_dir=bio_dir,
            species=instructions.get("species", "human"),
            mhc_class=instructions.get("MHC_class", "I"),
            custom_database_path=instructions.get("custom_database_path"),
            tcr_weights=weights,
            output_dir=output_dir,
        )

        rows = []
        skipped = 0
        for obj in objects:
            rows.extend(obj.result.to_dict(orient="records"))
            skipped += int(obj.metadata.get("skipped_invalid_peptides_count", 0))

        return {
            "mode": "analyze",
            "rows": rows,
            "metadata": {
                "mode": "analyze",
                "allele": allele,
                "species": instructions.get("species", "human"),
                "MHC_class": instructions.get("MHC_class", "I"),
                "outputs": outputs,
                "skipped_invalid_peptides_count": skipped,
                "invalid_subject_peptides": invalid_subject,
                "weighted": weights is not None,
                "custom_database": bool(instructions.get("custom_database_path")),
            },
        }

    if mode == "compare":
        valid_target, invalid_target = parse_peptide_text(
            instructions.get("target_data", "")
        )
        if not valid_target:
            raise ValueError(f"No valid target peptides found: {invalid_target}")

        df = run_comparison(
            valid_subject,
            valid_target,
            bio_dir=bio_dir,
            tcr_weights=weights,
        )

        return {
            "mode": "compare",
            "rows": df.to_dict(orient="records"),
            "metadata": {
                "mode": "compare",
                "invalid_subject_peptides": invalid_subject,
                "invalid_target_peptides": invalid_target,
                "weighted": weights is not None,
                "outputs": {},
            },
        }

    raise ValueError(f"Invalid mode: {mode}")
