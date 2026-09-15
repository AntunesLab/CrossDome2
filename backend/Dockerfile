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
COPY . .
EXPOSE 5000
CMD ["gunicorn", "-b", "0.0.0.0:5000", "app:create_app()"]
