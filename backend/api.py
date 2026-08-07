from __future__ import annotations

import csv
import io
import math
import os
import uuid
from pathlib import Path

import numpy as np
import pandas as pd
from flask import Blueprint, Response, current_app, jsonify, request, send_from_directory

from crossdome.io import load_hla_database
from crossdome.runner import database_path, handle_request
from jobs import create_job, get_job, update_job

bp = Blueprint("crossdome", __name__, url_prefix="/api/v1")


def _json_safe(value):
    if value is None:
        return None
    if isinstance(value, (np.integer,)):
        return int(value)
    if isinstance(value, (np.floating,)):
        value = float(value)
    if isinstance(value, float) and (math.isnan(value) or math.isinf(value)):
        return None
    if isinstance(value, (np.bool_,)):
        return bool(value)
    if pd.isna(value):
        return None
    return value


def _clean_rows(rows):
    return [{k: _json_safe(v) for k, v in row.items()} for row in rows]


def _db_path():
    return current_app.config["JOB_DB"]


def _bio_dir():
    return Path(current_app.config["BIO_DATABASE_DIR"])


def _output_dir(job_id: str):
    path = Path(current_app.config["OUTPUT_DIR"]) / job_id
    path.mkdir(parents=True, exist_ok=True)
    return path


def _upload_dir(job_id: str):
    path = Path(current_app.config["UPLOAD_DIR"]) / job_id
    path.mkdir(parents=True, exist_ok=True)
    return path


def _read_peptide_upload(file_storage) -> str:
    data = file_storage.read()
    try:
        return data.decode("utf-8")
    except UnicodeDecodeError as exc:
        raise ValueError("Peptide input files must be UTF-8 CSV/TXT files.") from exc


@bp.get("/health")
def health():
    return jsonify({"status": "ok", "version": "2.1"})


@bp.get("/alleles")
def alleles():
    species = request.args.get("specie", request.args.get("species", "human")).strip().lower()
    mhc_class = request.args.get("MHC_class", "I").strip().upper()
    path = database_path(_bio_dir(), species, mhc_class)
    if not path.exists():
        return jsonify({"status": "error", "message": f"Database not found: {path.name}", "alleles": []}), 404
    df = load_hla_database(path)
    values = sorted(df["hla_allele"].dropna().astype(str).unique().tolist())
    return jsonify({"status": "ok", "species": species, "MHC_class": mhc_class, "alleles": values})


@bp.post("/submitform")
def submit_form():
    mode = request.form.get("mode", "analyze").strip().lower()
    job_id = str(uuid.uuid4())

    subject_type = request.form.get("subjectInputType", "text")
    if subject_type == "file":
        f = request.files.get("subjectFile")
        if not f:
            return jsonify({"status": "error", "message": "Missing subject file."}), 400
        subject_data = _read_peptide_upload(f)
    else:
        subject_data = request.form.get("subjectText", "")

    if mode == "compare":
        target_type = request.form.get("targetInputType", "text")
        if target_type == "file":
            f = request.files.get("targetFile")
            if not f:
                return jsonify({"status": "error", "message": "Missing target file."}), 400
            target_data = _read_peptide_upload(f)
        else:
            target_data = request.form.get("targetText", "")
    else:
        target_data = request.form.get("targetHLA", "").strip()

    custom_path = None
    custom_file = request.files.get("customDatabase")
    if custom_file and custom_file.filename:
        ext = Path(custom_file.filename).suffix.lower()
        if ext not in {".csv", ".txt", ".tsv", ".parquet"}:
            return jsonify({"status": "error", "message": "Custom database must be CSV, TSV, TXT, or Parquet."}), 400
        safe_name = f"custom_database{ext}"
        custom_path = str(_upload_dir(job_id) / safe_name)
        custom_file.save(custom_path)

    instructions = {
        "mode": mode,
        "subject_data": subject_data,
        "target_data": target_data,
        "species": request.form.get("specie", request.form.get("species", "human")).strip().lower(),
        "MHC_class": request.form.get("MHC_class", "I").strip().upper(),
        "custom_database_path": custom_path,
        "tcr_weights": request.form.get("tcrWeights", "").strip(),
    }
    create_job(_db_path(), instructions, request.form.get("user_email"), job_id=job_id)
    return jsonify({"status": "ok", "job_id": job_id, "message": "Parameters stored"})


@bp.get("/job/<job_id>/results")
def results(job_id):
    job = get_job(_db_path(), job_id)
    if not job:
        return jsonify({"status": "error", "message": "Job not found."}), 404

    if job["status"] == "complete" and job["result"]:
        result = job["result"]
    else:
        try:
            update_job(_db_path(), job_id, status="running")
            result = handle_request(job["instructions"], _bio_dir(), _output_dir(job_id))
            result["rows"] = _clean_rows(result["rows"])
            update_job(_db_path(), job_id, status="complete", result=result, error="")
        except Exception as exc:
            update_job(_db_path(), job_id, status="error", error=str(exc))
            current_app.logger.exception("CrossDome job failed")
            return jsonify({"status": "error", "message": str(exc)}), 500

    metadata = result.get("metadata", {})
    outputs = metadata.get("outputs", {})
    if outputs.get("expression_heatmap"):
        outputs["expression_heatmap"] = f"/api/v1/job/{job_id}/outputs/{outputs['expression_heatmap']}"
    for item in (outputs.get("prediction_plots") or {}).values():
        if item.get("filename"):
            item["url"] = f"/api/v1/job/{job_id}/outputs/{item['filename']}"

    return jsonify({
        "status": "ok",
        "job_id": job_id,
        "mode": result.get("mode"),
        "total_rows": len(result.get("rows", [])),
        "metadata": metadata,
        "outputs": outputs,
    })


@bp.get("/job/<job_id>/results-chunked")
def chunked(job_id):
    job = get_job(_db_path(), job_id)
    if not job or not job.get("result"):
        return jsonify({"status": "error", "message": "Results are not available.", "rows": [], "lastRow": 0}), 404
    rows = job["result"].get("rows", [])
    try:
        start = max(0, int(request.args.get("start", 0)))
        end = min(len(rows), int(request.args.get("end", start + 100)))
    except ValueError:
        start, end = 0, min(100, len(rows))
    return jsonify({"status": "success", "rows": rows[start:end], "lastRow": len(rows)})


@bp.get("/job/<job_id>/download.csv")
def download_csv(job_id):
    job = get_job(_db_path(), job_id)
    if not job or not job.get("result"):
        return jsonify({"status": "error", "message": "Results are not available."}), 404
    rows = job["result"].get("rows", [])
    if not rows:
        return jsonify({"status": "error", "message": "No rows available."}), 404
    buffer = io.StringIO()
    writer = csv.DictWriter(buffer, fieldnames=list(rows[0].keys()), extrasaction="ignore")
    writer.writeheader()
    writer.writerows(rows)
    return Response(
        buffer.getvalue(),
        mimetype="text/csv",
        headers={"Content-Disposition": f"attachment; filename=crossdome-{job_id}.csv"},
    )


@bp.get("/job/<job_id>/outputs/<filename>")
def output_file(job_id, filename):
    return send_from_directory(_output_dir(job_id), filename)
