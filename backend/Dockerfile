FROM python:3.12-slim
WORKDIR /app
ENV MPLBACKEND=Agg PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
COPY requirements.txt .
# Heavy deps pinned + split into their own layers so each push blob stays small
# (registry uploads on this network fail on large single blobs). Exact pins match
# what -r requirements.txt below resolves to, so that final step is a no-op for these.
RUN pip install --no-cache-dir numpy==2.5.3
RUN pip install --no-cache-dir scipy==1.18.1
RUN pip install --no-cache-dir pandas==2.3.3
RUN pip install --no-cache-dir pyarrow==21.0.0
RUN pip install --no-cache-dir matplotlib==3.11.2
RUN pip install --no-cache-dir statsmodels==0.15.0
RUN pip install --no-cache-dir -r requirements.txt
# The bio-database parquets are 647 MB of the build context. They go in their
# own layers, largest first, so no single push blob exceeds ~85 MB -- the same
# registry constraint that splits the pip steps above. The files below are
# already in place when COPY . . runs, so that step only adds code.
COPY bio-database/hla_database.csv bio-database/
COPY bio-database/peptide_annotation.parquet bio-database/
COPY bio-database/predictions.parquet bio-database/
COPY bio-database/predictions_classI_02.parquet bio-database/
COPY bio-database/predictions_classI_03.parquet bio-database/
COPY bio-database/predictions_classI_04.parquet bio-database/
COPY bio-database/predictions_classI_05.parquet bio-database/
COPY bio-database/predictions_classII.parquet bio-database/
COPY bio-database/hla_database.parquet bio-database/
COPY bio-database/human_classI.parquet bio-database/human_classII.parquet bio-database/
COPY . .
EXPOSE 5000
CMD ["gunicorn", "-b", "0.0.0.0:5000", "--timeout", "300", "app:create_app()"]
