from __future__ import annotations

import json
import sqlite3
import uuid
from datetime import datetime, timezone
from pathlib import Path


def _connect(db_path: str | Path):
    con = sqlite3.connect(str(db_path))
    con.row_factory = sqlite3.Row
    return con


def init_db(db_path: str | Path):
    Path(db_path).parent.mkdir(parents=True, exist_ok=True)
    with _connect(db_path) as con:
        con.execute(
            """
            CREATE TABLE IF NOT EXISTS jobs (
                id TEXT PRIMARY KEY,
                created_at TEXT NOT NULL,
                user_email TEXT,
                status TEXT NOT NULL,
                instructions TEXT NOT NULL,
                result TEXT,
                error TEXT
            )
            """
        )


def create_job(db_path: str | Path, instructions: dict, user_email: str | None = None, job_id: str | None = None):
    job_id = job_id or str(uuid.uuid4())
    with _connect(db_path) as con:
        con.execute(
            "INSERT INTO jobs(id, created_at, user_email, status, instructions) VALUES (?, ?, ?, ?, ?)",
            (
                job_id,
                datetime.now(timezone.utc).isoformat(),
                user_email,
                "pending",
                json.dumps(instructions),
            ),
        )
    return job_id


def get_job(db_path: str | Path, job_id: str):
    with _connect(db_path) as con:
        row = con.execute("SELECT * FROM jobs WHERE id = ?", (job_id,)).fetchone()
    if not row:
        return None
    return {
        "id": row["id"],
        "created_at": row["created_at"],
        "user_email": row["user_email"],
        "status": row["status"],
        "instructions": json.loads(row["instructions"]),
        "result": json.loads(row["result"]) if row["result"] else None,
        "error": row["error"],
    }


def update_job(db_path: str | Path, job_id: str, *, status: str | None = None, result: dict | None = None, error: str | None = None):
    fields, values = [], []
    if status is not None:
        fields.append("status = ?")
        values.append(status)
    if result is not None:
        fields.append("result = ?")
        values.append(json.dumps(result, allow_nan=False))
    if error is not None:
        fields.append("error = ?")
        values.append(error)
    if not fields:
        return
    values.append(job_id)
    with _connect(db_path) as con:
        con.execute(f"UPDATE jobs SET {', '.join(fields)} WHERE id = ?", values)
