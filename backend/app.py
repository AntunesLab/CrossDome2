from __future__ import annotations

import os
import secrets
from pathlib import Path

from dotenv import load_dotenv
from flask import Flask, jsonify
from flask_cors import CORS
from werkzeug.exceptions import RequestEntityTooLarge

from api import bp
from jobs import init_db

BASE_DIR = Path(__file__).resolve().parent
load_dotenv(BASE_DIR / ".env")

# The web form reads peptide uploads straight into memory and saves a custom
# database to disk, both before any job exists, so the request body needs a
# ceiling. 32 MB clears the largest shipped background table (human class I,
# 10 MB) with room to spare. This caps the HTTP surface only -- the CLI reads
# files from disk and is unaffected.
DEFAULT_MAX_UPLOAD_MB = 32

# Production serves the SPA and the API from a single origin through CloudFront,
# so cross-origin calls are only a local-development need. Set CORS_ORIGINS to a
# comma-separated list to name real origins, or to "*" for the old
# allow-everything behaviour.
DEFAULT_CORS_ORIGINS = [r"http://localhost:\d+$", r"http://127\.0\.0\.1:\d+$"]


def _cors_origins():
    configured = os.getenv("CORS_ORIGINS", "").strip()
    if configured == "*":
        return "*"
    if configured:
        return [origin.strip() for origin in configured.split(",") if origin.strip()]
    return DEFAULT_CORS_ORIGINS


def create_app():
    app = Flask(__name__)

    # A fixed fallback would be a known signing key in production. Nothing signs
    # sessions today, so a random per-worker key costs nothing and fails closed
    # if something starts to.
    secret_key = os.getenv("SECRET_KEY")
    if not secret_key:
        secret_key = secrets.token_hex(32)
        app.logger.warning("SECRET_KEY is unset; generated a random per-worker key.")

    app.config.update(
        SECRET_KEY=secret_key,
        MAX_CONTENT_LENGTH=int(os.getenv("MAX_UPLOAD_MB", str(DEFAULT_MAX_UPLOAD_MB))) * 1024 * 1024,
        BIO_DATABASE_DIR=os.getenv(
            "BIO_DATABASE_DIR",
            str(BASE_DIR / "bio-database"),
        ),
        JOB_DB=os.getenv(
            "JOB_DB",
            str(BASE_DIR / "crossdome_jobs.sqlite3"),
        ),
        OUTPUT_DIR=os.getenv(
            "OUTPUT_DIR",
            str(BASE_DIR / "outputs"),
        ),
        UPLOAD_DIR=os.getenv(
            "UPLOAD_DIR",
            str(BASE_DIR / "uploads"),
        ),
    )

    Path(app.config["OUTPUT_DIR"]).mkdir(parents=True, exist_ok=True)
    Path(app.config["UPLOAD_DIR"]).mkdir(parents=True, exist_ok=True)
    init_db(app.config["JOB_DB"])

    # Werkzeug aborts an oversized body before any route runs, so the JSON shape
    # the frontend expects has to come from an app-level handler.
    @app.errorhandler(RequestEntityTooLarge)
    def too_large(_exc):
        limit_mb = app.config["MAX_CONTENT_LENGTH"] // (1024 * 1024)
        return jsonify({
            "status": "error",
            "message": (
                f"Upload exceeds the {limit_mb} MB limit of the web interface. "
                "Use the command line tool for larger inputs."
            ),
        }), 413

    # Browser callers are limited to the configured origins
    CORS(app, origins=_cors_origins())

    app.register_blueprint(bp)

    return app


if __name__ == "__main__":
    create_app().run(
        host="0.0.0.0",
        port=int(os.getenv("PORT", "5000")),
        debug=os.getenv("FLASK_DEBUG") == "1",
    )
