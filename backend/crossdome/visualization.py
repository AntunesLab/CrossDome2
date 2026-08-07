from __future__ import annotations

import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
from matplotlib.gridspec import GridSpec

# Prediction tools present in predictions.parquet.
BINDING_TOOLS = [
    "BigMHC-EL",
    "NetMHC",
    "NetMHCpan",
    "NetMHCpan-EL",
    "MixMHCpred",
    "MHCflurryEL",
]

IMMUNOGENICITY_TOOLS = [
    "BigMHC_IM",
    "PRIME",
    "DeepImmuno",
    "TLImm",
]


def _numeric_expression_matrix(expression_matrix: pd.DataFrame, top_n: int = 15) -> pd.DataFrame:
    matrix = expression_matrix.copy()
    if top_n is not None:
        matrix = matrix.head(top_n)

    matrix = matrix.apply(pd.to_numeric, errors="coerce")
    matrix = matrix.replace([np.inf, -np.inf], np.nan)
    matrix = matrix.dropna(axis=0, how="all").dropna(axis=1, how="all")
    return matrix


def generate_expression_heatmap(
    expression_matrix: pd.DataFrame,
    top_n: int = 15,
    title: str = "Peptide expression and tissue specificity",
):
    """
    Plot tissue expression for each peptide and a peptide-aligned expression
    summary on the right.

    Left panel
    ----------
    Row-scaled tissue expression heatmap.

    Right panel
    -----------
    Maximum raw expression for each peptide, annotated with the tissue in
    which that maximum occurs. This keeps the tissue-specific expression
    summary aligned with the corresponding peptide row.
    """
    matrix = _numeric_expression_matrix(expression_matrix, top_n=top_n)

    fig_height = max(6.0, min(12.0, 0.48 * max(len(matrix), 1) + 3.0))
    fig = plt.figure(figsize=(17, fig_height))
    gs = GridSpec(1, 2, figure=fig, width_ratios=[5.8, 1.6], wspace=0.08)
    ax_heat = fig.add_subplot(gs[0, 0])
    ax_side = fig.add_subplot(gs[0, 1])

    if matrix.empty:
        ax_heat.text(0.5, 0.5, "No expression data available", ha="center", va="center")
        ax_heat.axis("off")
        ax_side.axis("off")
        fig.suptitle(title, fontsize=16)
        fig.tight_layout()
        return fig

    raw = matrix.fillna(0.0).to_numpy(dtype=float)

    # Row scaling preserves the tissue pattern within each peptide while the
    # side panel retains the original raw-expression magnitude.
    row_min = raw.min(axis=1, keepdims=True)
    row_max = raw.max(axis=1, keepdims=True)
    denom = np.where(row_max > row_min, row_max - row_min, 1.0)
    scaled = (raw - row_min) / denom

    image = ax_heat.imshow(scaled, aspect="auto", interpolation="nearest")
    ax_heat.set_yticks(np.arange(len(matrix.index)))
    ax_heat.set_yticklabels(matrix.index.astype(str))
    ax_heat.set_xticks(np.arange(len(matrix.columns)))
    ax_heat.set_xticklabels(matrix.columns.astype(str), rotation=90)
    ax_heat.set_xlabel("Tissue")
    ax_heat.set_ylabel("Peptide")
    ax_heat.set_title("Gene expression heatmap")

    cbar = fig.colorbar(image, ax=ax_heat, fraction=0.025, pad=0.015)
    cbar.set_label("Row-scaled expression")

    # Right-side peptide-specific summary.
    max_expression = matrix.max(axis=1, skipna=True).fillna(0.0)
    max_tissue = matrix.idxmax(axis=1, skipna=True).fillna("N/A")
    y = np.arange(len(matrix.index))

    ax_side.barh(y, max_expression.to_numpy(dtype=float))
    ax_side.set_ylim(ax_heat.get_ylim())
    ax_side.set_yticks(y)
    ax_side.set_yticklabels([])
    ax_side.set_xlabel("Max expression")
    ax_side.set_title("Highest-expression tissue")
    ax_side.grid(axis="x", alpha=0.2)

    xmax = float(max_expression.max()) if len(max_expression) else 0.0
    text_offset = xmax * 0.02 if xmax > 0 else 0.02
    for yi, (value, tissue) in enumerate(zip(max_expression, max_tissue)):
        ax_side.text(
            float(value) + text_offset,
            yi,
            str(tissue),
            va="center",
            fontsize=9,
        )

    # Leave room for tissue labels beyond the end of the bars.
    if xmax > 0:
        ax_side.set_xlim(0, xmax * 1.45)

    fig.suptitle(title, fontsize=17, y=0.995)
    fig.subplots_adjust(left=0.08, right=0.98, bottom=0.24, top=0.91)
    return fig


def plot_prediction_tools(
    result_df: pd.DataFrame,
    binding_tool: str,
    immunogenicity_tool: str,
    top_n: int = 30,
):
    """Create the two-panel prediction plot used by the frontend."""
    if binding_tool not in BINDING_TOOLS:
        raise ValueError(f"Unknown binding tool: {binding_tool}")
    if immunogenicity_tool not in IMMUNOGENICITY_TOOLS:
        raise ValueError(f"Unknown immunogenicity tool: {immunogenicity_tool}")

    order_col = "rank" if "rank" in result_df.columns else "relatedness_score"
    data = result_df.sort_values(order_col).head(top_n).copy()

    if "subject" not in data.columns:
        raise ValueError("Result table must contain a 'subject' column.")

    x = np.arange(len(data))
    fig, axes = plt.subplots(2, 1, figsize=(14, 8), sharex=True)

    panels = [
        (axes[0], immunogenicity_tool),
        (axes[1], binding_tool),
    ]

    for ax, col in panels:
        if col not in data.columns:
            values = pd.Series(np.nan, index=data.index)
        else:
            values = pd.to_numeric(data[col], errors="coerce")

        valid = values.notna()
        ax.scatter(x[valid.to_numpy()], values[valid].to_numpy())
        ax.set_ylabel(col)
        ax.grid(alpha=0.25)

        if not valid.any():
            ax.text(
                0.5,
                0.5,
                f"No {col} values available",
                transform=ax.transAxes,
                ha="center",
                va="center",
            )

    axes[0].set_title(f"{immunogenicity_tool} and {binding_tool} predictions")
    axes[1].set_xticks(x)
    axes[1].set_xticklabels(data["subject"].astype(str), rotation=90)
    axes[1].set_xlabel("Peptide")
    fig.tight_layout()
    return fig
