"""NCVET qualification pack ingester (P2 — FR-14).

Weekly cron. Writes raw JSONL first (audit trail), then upserts into
qualifications. Every row carries source_url + evidence_date.

Run: python -m ingesters.ncvet.main"""
from __future__ import annotations
import json, os, sys, datetime, pathlib
import httpx


NCVET_LIST_URL = "https://www.ncvet.gov.in/api/qualifications"  # verify
OUT = pathlib.Path("data/raw/ncvet")


def fetch() -> list[dict]:
    r = httpx.get(NCVET_LIST_URL, timeout=60.0)
    r.raise_for_status()
    return r.json().get("qualifications", [])


def write_raw(rows: list[dict]) -> pathlib.Path:
    OUT.mkdir(parents=True, exist_ok=True)
    p = OUT / f"{datetime.date.today().isoformat()}.jsonl"
    with p.open("w") as f:
        for r in rows:
            f.write(json.dumps(r, ensure_ascii=False) + "\n")
    return p


def upsert(rows: list[dict]) -> None:
    import psycopg
    url = os.environ["DATABASE_URL"]
    with psycopg.connect(url, autocommit=True) as c, c.cursor() as cur:
        for r in rows:
            cur.execute(
                """
                insert into qualifications (qp_code, name, sector, nsqf_level,
                    duration_hours, entry_min_class, entry_min_age, mode,
                    self_employment_track, source_url, evidence_date)
                values (%(qp_code)s,%(name)s,%(sector)s,%(nsqf_level)s,
                        %(duration_hours)s,%(entry_min_class)s,%(entry_min_age)s,
                        %(mode)s,%(self_employment_track)s,%(source_url)s,%(evidence_date)s)
                on conflict (qp_code) do update set
                    name           = excluded.name,
                    sector         = excluded.sector,
                    nsqf_level     = excluded.nsqf_level,
                    duration_hours = excluded.duration_hours,
                    source_url     = excluded.source_url,
                    evidence_date  = excluded.evidence_date
                """,
                r,
            )


def main() -> int:
    try:
        rows = fetch()
    except Exception as e:
        print(f"[ncvet] fetch failed: {e}", file=sys.stderr)
        return 1
    path = write_raw(rows)
    print(f"[ncvet] wrote {len(rows)} raw rows to {path}")
    upsert(rows)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
