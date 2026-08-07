from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from typing import Any

import pandas as pd


@dataclass
class XRBackground:
    allele: str
    full_background: pd.DataFrame
    off_targets: list[str] | None = None

    def __post_init__(self) -> None:
        required = {"peptide_sequence", "hla_allele"}
        missing = required.difference(self.full_background.columns)
        if missing:
            raise ValueError(f"Background database is missing columns: {sorted(missing)}")

        self.background_data = self.full_background[
            self.full_background["hla_allele"].astype(str) == str(self.allele)
        ].copy()
        if self.background_data.empty:
            raise ValueError(f"No peptides found for allele {self.allele}.")

        self.peptides = self.background_data["peptide_sequence"].dropna().astype(str).tolist()
        if self.off_targets:
            self.peptides = list(dict.fromkeys(self.peptides + self.off_targets))

        self.stats = {
            "off_target": len(self.off_targets or []),
            "database": len(self.peptides),
        }

    def get_background_data(self) -> pd.DataFrame:
        return self.background_data


@dataclass
class XRResult:
    query: str
    result: pd.DataFrame
    allele: str
    position_weight: list[float]
    expression_matrix: pd.DataFrame | None = None
    metadata: dict[str, Any] = field(default_factory=dict)
    timestamp: str = field(default_factory=lambda: datetime.now().strftime("%Y-%m-%d %H:%M:%S"))

    def to_dict(self) -> dict[str, Any]:
        return {
            "query": self.query,
            "allele": self.allele,
            "position_weight": self.position_weight,
            "metadata": self.metadata,
            "timestamp": self.timestamp,
            "result": self.result.to_dict(orient="records"),
        }
