from __future__ import annotations

import argparse
from pathlib import Path

import pandas as pd

from crossdome.io import parse_peptide_text
from crossdome.runner import parse_tcr_weights, run_analysis, run_comparison


def main():
    parser = argparse.ArgumentParser(description="CrossDome 2.1")
    parser.add_argument("--bio-dir", default=str(Path(__file__).resolve().parent / "bio-database"))
    sub = parser.add_subparsers(dest="command", required=True)

    analyze = sub.add_parser("analyze")
    analyze.add_argument("query", help="One peptide or comma-separated peptides")
    analyze.add_argument("allele")
    analyze.add_argument("--species", default="human")
    analyze.add_argument("--mhc-class", default="I", choices=["I", "II"])
    analyze.add_argument("--custom-db")
    analyze.add_argument("--tcr-weights", help="Comma/space-separated positional weights")
    analyze.add_argument("--output", default="crossdome_results.csv")

    compare = sub.add_parser("compare")
    compare.add_argument("subjects")
    compare.add_argument("targets")
    compare.add_argument("--tcr-weights")
    compare.add_argument("--output", default="crossdome_comparison.csv")

    args = parser.parse_args()
    if args.command == "analyze":
        queries, invalid = parse_peptide_text(args.query)
        if invalid:
            print("Skipped invalid input:", invalid)
        objects, _ = run_analysis(
            args.allele,
            queries,
            bio_dir=args.bio_dir,
            species=args.species,
            mhc_class=args.mhc_class,
            custom_database_path=args.custom_db,
            tcr_weights=parse_tcr_weights(args.tcr_weights),
        )
        df = pd.concat([o.result for o in objects], ignore_index=True)
    else:
        subjects, _ = parse_peptide_text(args.subjects)
        targets, _ = parse_peptide_text(args.targets)
        df = run_comparison(subjects, targets, bio_dir=args.bio_dir, tcr_weights=parse_tcr_weights(args.tcr_weights))

    df.to_csv(args.output, index=False)
    print(f"Saved {len(df):,} rows to {args.output}")


if __name__ == "__main__":
    main()
