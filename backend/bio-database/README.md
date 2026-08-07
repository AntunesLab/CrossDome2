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
   - `bovine_classI.parquet` / `bovine_classII.parquet`
   - `chicken_classI.parquet` / `chicken_classII.parquet`
   - `dog_classI.parquet` / `dog_classII.parquet`

   Only combinations that exist in your production database need to be present. Each file must contain at least `peptide_sequence` and `hla_allele`. `peptide_length` and `resource` are recommended.

2. RdS distribution parameters:

   - `rds_length_parameters.parquet`, **or**
   - `rds_length_parameters.csv`

   Required columns:

   `peptide_length,rds_mu,rds_sigma,rds_cutoff_p005,rds_cutoff_p001`

   CrossDome 2.1 deliberately does not fall back to the old global 9-mer mean/sigma. If a peptide length has no calibrated row, the analysis stops with an explicit error.

3. RdS biochemical scoring data. Use either:

   - `sysdata.rda` containing `MDS_COMPONENTS` and `BLOSUM80`, or
   - `MDS_COMPONENTS.csv` plus `BLOSUM80.csv`.

## Human-only optional files

- `peptide_annotation.parquet` — peptide-to-gene annotation. Expected to contain `peptide_sequence` and `ensembl_id`.
- `hpa_database.parquet` — gene/tissue expression matrix keyed by `ensembl_id`.
- `predictions.parquet` — peptide prediction table. CrossDome searches common aliases for peptide, allele, BigMHC-EL, NetMHCpan-EL, DeepImmuno, and TLImm columns.

If these optional files are missing, the core RdS analysis still runs. The corresponding heatmap or prediction plots are simply omitted.
