"""Data-access layer for the weekly web scraper.

Writes to the SAME Postgres tables the voice app reads (qualifications,
demand_signals) plus the two bookkeeping tables from migration 0010. Uses
psycopg + raw SQL to match the rest of the project (the original TS version
used Prisma; this is the in-repo Python port).

Never runs in the /session/turn request path — only from run_weekly.py.
"""
from __future__ import annotations
import os
import json
import datetime as dt

import psycopg
from psycopg.rows import dict_row

DATABASE_URL = os.getenv("DATABASE_URL",
                         "postgresql://postgres:postgres@localhost:5432/setu")


def _conn():
    return psycopg.connect(DATABASE_URL, autocommit=True, row_factory=dict_row)


def upsert_qualification(row: dict) -> None:
    """Upsert on qp_code — a re-scrape of the same QP just refreshes it.
    `row` keys: qp_code, name, sector, nsqf_level, duration_hours,
    entry_min_class, entry_min_age, mode, self_employment_track, job_role,
    keywords, source_url, evidence_date."""
    with _conn() as c, c.cursor() as cur:
        cur.execute(
            """
            insert into qualifications
              (qp_code, name, sector, nsqf_level, duration_hours, entry_min_class,
               entry_min_age, mode, self_employment_track, job_role, keywords,
               source_url, evidence_date)
            values
              (%(qp_code)s,%(name)s,%(sector)s,%(nsqf_level)s,%(duration_hours)s,
               %(entry_min_class)s,%(entry_min_age)s,%(mode)s,%(self_employment_track)s,
               %(job_role)s,%(keywords)s,%(source_url)s,%(evidence_date)s)
            on conflict (qp_code) do update set
              name=excluded.name, sector=excluded.sector, nsqf_level=excluded.nsqf_level,
              duration_hours=excluded.duration_hours,
              entry_min_class=coalesce(excluded.entry_min_class, qualifications.entry_min_class),
              entry_min_age=coalesce(excluded.entry_min_age, qualifications.entry_min_age),
              mode=excluded.mode, job_role=excluded.job_role, keywords=excluded.keywords,
              source_url=excluded.source_url, evidence_date=excluded.evidence_date
            """,
            row,
        )


def upsert_demand_signal(row: dict) -> None:
    """Keyed on (district, sector, role_title): the weekly re-scrape overwrites
    vacancies + evidence_date, which is what lets the ranker age a row out after
    180 days of silence instead of us deleting anything.
    `row` keys: district, state, sector, qp_code, role_title, vacancies_90d,
    source_url, evidence_date."""
    with _conn() as c, c.cursor() as cur:
        # No natural unique constraint on demand_signals in the base schema, so
        # emulate upsert: delete the prior matching row, then insert fresh.
        cur.execute(
            "delete from demand_signals where district=%s and lower(sector)=lower(%s) "
            "and role_title=%s",
            (row["district"], row["sector"], row["role_title"]),
        )
        cur.execute(
            """
            insert into demand_signals
              (district, state, sector, qp_code, role_title, vacancies_90d,
               source_url, evidence_date)
            values
              (%(district)s,%(state)s,%(sector)s,%(qp_code)s,%(role_title)s,
               %(vacancies_90d)s,%(source_url)s,%(evidence_date)s)
            """,
            row,
        )


def quarantine(source: str, raw: object, reason: str) -> None:
    """Anything the normalizer rejects lands here instead of being dropped."""
    with _conn() as c, c.cursor() as cur:
        cur.execute(
            "insert into ingest_quarantine (source, reason, raw) values (%s,%s,%s)",
            (source, reason, json.dumps(raw, ensure_ascii=False, default=str)),
        )


def record_ingest_run(source: str, stats: dict) -> None:
    with _conn() as c, c.cursor() as cur:
        cur.execute(
            """
            insert into ingest_runs
              (source, rows_seen, rows_written, rows_quarantined, duration_ms, error)
            values (%s,%s,%s,%s,%s,%s)
            """,
            (source, stats.get("rows_seen", 0), stats.get("rows_written", 0),
             stats.get("rows_quarantined", 0), stats.get("duration_ms"),
             stats.get("error")),
        )


def today() -> dt.date:
    return dt.date.today()
