from __future__ import annotations

import os
from pathlib import Path

from dotenv import load_dotenv
from flask import Flask
from flask_cors import CORS

from api import bp
from jobs import init_db

BASE_DIR = Path(__file__).resolve().parent
load_dotenv(BASE_DIR / ".env")


def create_app():
    app = Flask(__name__)

    app.config.update(
        SECRET_KEY=os.getenv("SECRET_KEY", "crossdome-dev-key"),
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

    # Allow the local frontend to communicate with Flask
    CORS(app)

    app.register_blueprint(bp)

    return app


if __name__ == "__main__":
    create_app().run(
        host="0.0.0.0",
        port=int(os.getenv("PORT", "5000")),
        debug=os.getenv("FLASK_DEBUG") == "1",
    )
