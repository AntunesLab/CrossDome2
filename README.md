# CrossDome 2.1

This is a clean source bundle for the current CrossDome workflow. It combines the backend and frontend paths that had previously been developed as separate patches.

## What is included

- Same-length peptide comparison for 8–25 amino acid peptides
- Length-specific RdS `mu`, `sigma`, p-value thresholds, z-scores, p-values, BH-adjusted p-values, and ranks
- Human, humanized, mouse, rat, swine, bovine, chicken, and dog database naming support
- MHC class I and II database selection
- Optional custom peptide database upload
- Optional TCR positional weights
- Human-only expression heatmap
- Human-only selectable predictions: BigMHC-EL / NetMHCpan-EL with DeepImmuno / TLImm
- Direct peptide-to-peptide/list comparison
- Top-30 browser table plus full CSV download
- REST API and command-line interface
- SQLite job storage
- Docker files for local deployment

The production peptide databases and calibrated RdS parameter file are **not fabricated or bundled here**. Copy your current validated files into `backend/bio-database/`; see that directory's README.

## Directory layout

```text
CrossDome-2.1/
├── backend/
│   ├── app.py
│   ├── api.py
│   ├── crossdome2.py
│   ├── jobs.py
│   ├── requirements.txt
│   ├── Dockerfile
│   ├── bio-database/
│   └── crossdome/
│       ├── core.py
│       ├── data_loader.py
│       ├── io.py
│       ├── models.py
│       ├── runner.py
│       ├── stats.py
│       └── visualization.py
├── frontend/
│   ├── src/
│   ├── package.json
│   ├── vite.config.ts
│   └── Dockerfile
└── docker-compose.yml
```

## 1. Add the production data

Copy your current files into `backend/bio-database/`.

At minimum, an analysis needs:

- the relevant `<species>_class<I|II>.parquet` file;
- `rds_length_parameters.csv` or `.parquet`;
- `sysdata.rda` (or the two CSV scoring matrices).

Human heatmaps and prediction plots additionally use the optional annotation/expression/prediction files described in `backend/bio-database/README.md`.

## 2. Run locally without Docker

### Backend

Python 3.12 is recommended.

```bash
cd CrossDome-2.1/backend
python3.12 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
python app.py
```

The API runs at `http://127.0.0.1:5000`.

Health check:

```bash
curl http://127.0.0.1:5000/api/v1/health
```

### Frontend

In a second terminal:

```bash
cd CrossDome-2.1/frontend
npm install
cp .env.example .env
npm run dev
```

Open `http://127.0.0.1:5173`.

## 3. Run with Docker Compose

After adding the bio-database files:

```bash
cd CrossDome-2.1
docker compose up --build
```

Frontend: `http://127.0.0.1:5173`  
Backend: `http://127.0.0.1:5000`

## CLI examples

### Human analysis

```bash
cd backend
python crossdome2.py analyze LLFGYPVYV 'HLA-A*02:01' \
  --species human \
  --mhc-class I \
  --output results.csv
```

### With TCR weights

```bash
python crossdome2.py analyze LLFGYPVYV 'HLA-A*02:01' \
  --species human \
  --mhc-class I \
  --tcr-weights '1,1,1.4,2,2,1.4,1,1,1' \
  --output weighted_results.csv
```

### With a custom peptide database

```bash
python crossdome2.py analyze LLFGYPVYV 'HLA-A*02:01' \
  --species human \
  --mhc-class I \
  --custom-db my_peptides.csv \
  --output custom_results.csv
```

### Direct comparison

```bash
python crossdome2.py compare 'LLFGYPVYV,ACDEFGHIK' 'LLFGYPIYV,ACDEYGHIK' \
  --output comparison.csv
```

## Statistical behavior

For every valid peptide pair, lower RdS means greater biochemical similarity. The z-score is calculated from the calibrated distribution for that peptide length:

```text
z = (RdS - rds_mu) / rds_sigma
p = NormalCDF(z)
```

BH correction is applied to the p-values within the result set. The output also carries the calibrated `rds_cutoff_p005` and `rds_cutoff_p001` values for that length.

Different-length peptide pairs are never scored.

## Custom database behavior

A custom database may be CSV, TSV, TXT, or Parquet. A tabular file should have `peptide_sequence`; common peptide-column aliases are accepted. During an analysis, the custom peptides are assigned to the selected allele and appended to that run's background, then duplicates are removed.

## TCR weights

Enter weights as comma- or space-separated non-negative values. One vector is applied to all query peptides in the submitted analysis, so all query peptides must have the same length when weights are supplied. The vector length must equal the peptide length.

## Human-specific outputs

Human analysis can produce:

- an expression heatmap from `peptide_annotation.parquet` + `hpa_database.parquet`;
- binding/immunogenicity plots from `predictions.parquet`.

The tissue-specificity summary plot from older frontend versions is intentionally not part of 2.1.

Other-species and compare modes show RdS/statistical results only.
