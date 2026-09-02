"""Ingest the extracted NIELIT NSQF corpus (167 qualifications) into Postgres.

Reads:  C:/D DRIVE/SIH 2026/DATABASE EXTRACTED/build/qualifications.db
Writes: qualifications  (upsert on qp_code)
        qualification_eligibility  (created if missing)
        qualification_pathways     (created if missing)
        qualification_modules      (created if missing)

The Postgres `qualifications` table already exists (see db/migrations/0001_init.sql).
For its NOT NULL columns we derive sensible values:
  qp_code       = nqr_code (or a synthetic 'NIELIT/<sector>/<qual_id>' fallback)
  duration_hours = notional_hours (0 if unknown)
  nsqf_level    = int(nsqf_level) if numeric else 3
  mode          = 'classroom' (NIELIT courses are institutional; can be corrected later)
  entry_min_age = 15
  self_employment_track = True if the sector suggests it

Run:  python -m ingesters.import_nsqf_extracted
"""
from __future__ import annotations
import os
import sqlite3
import sys
from pathlib import Path

import psycopg
from psycopg.rows import dict_row

SQLITE_PATH = Path(r"C:/D DRIVE/SIH 2026/DATABASE EXTRACTED/build/qualifications.db")
DATABASE_URL = os.getenv("DATABASE_URL",
                         "postgresql://postgres:postgres@localhost:5432/setu")

# Sector strings in the extracted DB → sector strings used elsewhere in Setu.
SECTOR_MAP = {
    "IT-ITeS": "IT",
    "Electronics & HW": "Electronics",
}

CREATE_SIDE_TABLES = """
create table if not exists qualification_eligibility (
    id            uuid primary key default gen_random_uuid(),
    qp_code       text not null references qualifications(qp_code) on delete cascade,
    option_no     int,
    education     text,
    experience    text,
    notes         text
);
create index if not exists qualification_eligibility_qp_idx
    on qualification_eligibility(qp_code);

create table if not exists qualification_pathways (
    id            uuid primary key default gen_random_uuid(),
    qp_code       text not null references qualifications(qp_code) on delete cascade,
    pathway_text  text
);
create index if not exists qualification_pathways_qp_idx
    on qualification_pathways(qp_code);

create table if not exists qualification_modules (
    id            uuid primary key default gen_random_uuid(),
    qp_code       text not null references qualifications(qp_code) on delete cascade,
    seq           int,
    title         text,
    nos_code      text,
    module_type   text,
    hours         numeric,
    credits       numeric
);
create index if not exists qualification_modules_qp_idx
    on qualification_modules(qp_code);
"""

UPSERT_QUAL = """
insert into qualifications
    (qp_code, name, sector, nsqf_level, duration_hours, entry_min_class,
     entry_min_age, mode, self_employment_track, source_url, evidence_date,
     job_role, keywords)
values
    (%(qp_code)s, %(name)s, %(sector)s, %(nsqf_level)s, %(duration_hours)s,
     %(entry_min_class)s, %(entry_min_age)s, %(mode)s,
     %(self_employment_track)s, %(source_url)s, %(evidence_date)s,
     %(job_role)s, %(keywords)s)
on conflict (qp_code) do update set
    name           = excluded.name,
    sector         = excluded.sector,
    nsqf_level     = excluded.nsqf_level,
    duration_hours = excluded.duration_hours,
    entry_min_class = coalesce(excluded.entry_min_class, qualifications.entry_min_class),
    entry_min_age   = coalesce(excluded.entry_min_age,   qualifications.entry_min_age),
    mode           = excluded.mode,
    source_url     = excluded.source_url,
    evidence_date  = excluded.evidence_date,
    job_role       = coalesce(excluded.job_role, qualifications.job_role),
    keywords       = coalesce(excluded.keywords, qualifications.keywords)
"""


def _to_level(raw: str | None) -> int:
    if not raw:
        return 3
    try:
        n = int(str(raw).strip().split(".")[0])
        return max(1, min(8, n))
    except (ValueError, TypeError):
        return 3


def _sector(raw: str | None) -> str:
    if not raw:
        return "IT"
    return SECTOR_MAP.get(raw, raw)


def _qp_code(row: dict) -> str:
    """NQR code when we have one; else a stable synthetic slug."""
    if row.get("nqr_code"):
        return row["nqr_code"]
    sector = (row.get("sector") or "MISC").replace(" & ", "-").replace(" ", "-").upper()
    return f"NIELIT/{sector}/{row['qual_id']:05d}"


def _self_employment(sector: str, name: str) -> bool:
    # Heuristic — most NIELIT IT/Electronics courses are institutional, not
    # inherently self-employment tracks, so default False.
    n = (name or "").lower()
    return any(w in n for w in ("entrepreneur", "assistant (solar", "assembly assistant",
                                "self employ", "own"))


def main() -> int:
    if not SQLITE_PATH.exists():
        print(f"! SQLite not found: {SQLITE_PATH}", file=sys.stderr)
        return 1

    src = sqlite3.connect(str(SQLITE_PATH))
    src.row_factory = sqlite3.Row

    quals = [dict(r) for r in src.execute("select * from qualifications")]
    print(f"Loaded {len(quals)} qualifications from SQLite")

    with psycopg.connect(DATABASE_URL, autocommit=True) as pg, pg.cursor(row_factory=dict_row) as cur:
        cur.execute(CREATE_SIDE_TABLES)

        for q in quals:
            sector = _sector(q.get("sector"))

            # Everything searchable that isn't the name: the learning-module
            # titles are the closest thing the corpus has to a skill list
            # ("Hand Embroidery", "CCTV Camera", "LCD-LED TV"), so fold them
            # into a keywords blob for full-text matching.
            module_titles = [
                r["title"] for r in src.execute(
                    "select title from learning_modules where qual_id=? order by seq",
                    (q["qual_id"],),
                ).fetchall() if r["title"]
            ]
            keywords = " ".join(filter(None, [
                q.get("subsector") or "",
                q.get("category") or "",
                " ".join(module_titles),
            ])).strip() or None

            row = {
                "qp_code":         _qp_code(q),
                "name":            q["name"],
                "sector":          sector,
                "nsqf_level":      _to_level(q.get("nsqf_level")),
                "duration_hours":  int(q.get("notional_hours") or 0),
                "entry_min_class": None,   # filled from eligibility below when present
                "entry_min_age":   15,
                "mode":            "classroom",
                "self_employment_track": _self_employment(sector, q.get("name")),
                "source_url":      q.get("source_url") or "https://www.nielit.in",
                "evidence_date":   q.get("evidence_date") or "2026-09-02",
                "job_role":        q.get("job_role"),
                "keywords":        keywords,
            }

            # Cheap eligibility hint: look at first eligibility row's education
            # text, try to pull a class number.
            elig_rows = src.execute(
                "select * from eligibility_criteria where qual_id=? order by option_no", (q["qual_id"],)
            ).fetchall()
            for e in elig_rows:
                edu = (e["education"] or "").lower()
                for token, cls in (("10th", 10), ("class 10", 10), ("secondary", 10),
                                   ("12th", 12), ("class 12", 12), ("higher secondary", 12),
                                   ("graduate", 15), ("diploma", 13), ("8th", 8)):
                    if token in edu:
                        row["entry_min_class"] = cls
                        break
                if row["entry_min_class"]:
                    break

            cur.execute(UPSERT_QUAL, row)
            qp_code = row["qp_code"]

            # side tables — replace rather than append so re-runs stay clean
            cur.execute("delete from qualification_eligibility where qp_code=%s", (qp_code,))
            for e in elig_rows:
                cur.execute(
                    "insert into qualification_eligibility "
                    "(qp_code, option_no, education, experience, notes) "
                    "values (%s,%s,%s,%s,%s)",
                    (qp_code, e["option_no"], e["education"], e["experience"], e["notes"]),
                )

            cur.execute("delete from qualification_pathways where qp_code=%s", (qp_code,))
            for p in src.execute(
                "select * from progression_pathways where qual_id=?", (q["qual_id"],)
            ):
                cur.execute(
                    "insert into qualification_pathways (qp_code, pathway_text) values (%s,%s)",
                    (qp_code, p["pathway_text"]),
                )

            cur.execute("delete from qualification_modules where qp_code=%s", (qp_code,))
            for m in src.execute(
                "select * from learning_modules where qual_id=? order by seq", (q["qual_id"],)
            ):
                cur.execute(
                    "insert into qualification_modules "
                    "(qp_code, seq, title, nos_code, module_type, hours, credits) "
                    "values (%s,%s,%s,%s,%s,%s,%s)",
                    (qp_code, m["seq"], m["title"], m["nos_code"],
                     m["module_type"], m["hours"], m["credits"]),
                )

        # Sanity summary
        totals = cur.execute(
            "select sector, count(*) as n from qualifications group by sector order by n desc"
        ).fetchall()
        print("\nAfter import — qualifications by sector:")
        for r in totals:
            print(f"  {r['sector']:24s} {r['n']}")
        print(f"\nTotal qualifications: {sum(r['n'] for r in totals)}")

    src.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
