# CrossDome bio-database files

The source bundle intentionally does **not** duplicate the production CrossDome databases. Copy your current database files into this directory before running the application.

## Required

1. Species/MHC peptide databases named:

   - `human_classI.parquet`
   - `human_classII.parquet`
   - `humanized_classI.parquet` / `humanized_classII.parquet` when available
   - `mouse_classI.parquet` / `mouse_classII.parquet`
   - `rat_classI.parquet` / `rat_classII.parquet`
   - `swine_classI.parquet` / `swine_classII.parquet`
   - `bovine_classII.parquet` (cattle data is BoLA-DRB3, a class II locus; there is no class I file)
   - `chicken_classI.parquet` / `chicken_classII.parquet`
   - `dogsl_classI.parquet` / `dogsl_classII.parquet`

   The filename stem is the species value the API sends, which is not always the name shown in the UI: `bovine` is labelled "Cattle", `swine` is labelled "Pig", `dogsl` is labelled "Dog", and `humanized` is labelled "Humanized mouse".

   Only combinations that exist in your production database need to be present. Each file must contain at least `peptide_sequence` and `hla_allele`. `peptide_length` and `resource` are recommended.

2. RDS distribution parameters:

   - `rds_length_parameters.parquet`, **or**
   - `rds_length_parameters.csv`

   Required columns:

   `peptide_length,rds_mu,rds_sigma,rds_cutoff_p005,rds_cutoff_p001`

   CrossDome 2.1 deliberately does not fall back to the old global 9-mer mean/sigma. If a peptide length has no calibrated row, the analysis stops with an explicit error.

3. RDS biochemical scoring data. Use either:

   - `sysdata.rda` containing `MDS_COMPONENTS` and `BLOSUM80`, or
   - `MDS_COMPONENTS.csv` plus `BLOSUM80.csv`.

## Optional files

- `peptide_annotation.parquet` — peptide-to-gene annotation. Expected to contain `peptide_sequence` and `ensembl_id`. **Human only.**
- `hpa_database.parquet` — gene/tissue expression matrix keyed by `ensembl_id`. **Human only.**
- `predictions*.parquet` — the peptide prediction tables, all keyed on `peptide_sequence` + `hla_allele`. CrossDome reads every file matching that glob and searches common aliases for the peptide, allele and per-tool columns.
  - class I — `predictions.parquet` and `predictions_classI_NN.parquet`: BigMHC-EL/-IM, NetMHC, NetMHCpan, NetMHCpan-EL, MixMHCpred, MHCflurry-BA/-EL/-PS, PRIME, DeepImmuno, TLImm, plus `*_percentile` columns.
  - class II — `predictions_classII.parquet`: NetMHCIIpan-EL, NetMHCIIpan-BA and their percentiles.

  The class I table is split into contiguous allele ranges only to keep every file under GitHub's 100 MB limit; an allele lives in exactly one file, which is what lets a query read each file filtered by allele. `backend/tools/run_predictions.py merge` rewrites the whole set.

If these optional files are missing, the core RDS analysis still runs. The corresponding heatmap or prediction plots are simply omitted.
