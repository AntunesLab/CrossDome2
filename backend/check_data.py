from pathlib import Path
import sys

import pandas as pd

from crossdome.data_loader import load_scoring_data
from crossdome.stats import load_length_parameters


def main():
    bio = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(__file__).resolve().parent / "bio-database"
    print(f"Checking {bio}")
    errors = []

    try:
        params = load_length_parameters(bio)
        print(f"RdS parameters: {len(params)} peptide lengths ({params.peptide_length.min()}–{params.peptide_length.max()})")
        missing = [n for n in range(8, 26) if n not in set(params.peptide_length)]
        if missing:
            print(f"WARNING: no calibrated parameters for lengths: {missing}")
    except Exception as exc:
        errors.append(str(exc))

    try:
        mds, blosum = load_scoring_data(str(bio.resolve()))
        print(f"MDS_COMPONENTS: {mds.shape}; BLOSUM80: {blosum.shape}")
    except Exception as exc:
        errors.append(str(exc))

    dbs = sorted(bio.glob("*_classI.parquet")) + sorted(bio.glob("*_classII.parquet"))
    if not dbs:
        errors.append("No <species>_classI/II.parquet files found.")
    else:
        for path in dbs:
            try:
                df = pd.read_parquet(path, columns=None)
                missing = {"peptide_sequence", "hla_allele"}.difference(df.columns)
                if missing:
                    errors.append(f"{path.name}: missing {sorted(missing)}")
                else:
                    print(f"{path.name}: {len(df):,} rows, {df['hla_allele'].nunique():,} alleles")
            except Exception as exc:
                errors.append(f"{path.name}: {exc}")

    if errors:
        print("\nProblems found:")
        for error in errors:
            print(f"- {error}")
        raise SystemExit(1)
    print("\nCrossDome bio-database check passed.")


if __name__ == "__main__":
    main()
