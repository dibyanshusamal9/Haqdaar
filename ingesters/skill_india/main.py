"""Skill India Digital training centres ingester (P2)."""
from __future__ import annotations
import json, os, sys, datetime, pathlib
import httpx


OUT = pathlib.Path("data/raw/skill_india")
LIST_URL = "https://www.skillindiadigital.gov.in/api/centres"  # verify


def fetch(district: str) -> list[dict]:
    r = httpx.get(LIST_URL, params={"district": district}, timeout=60.0)
    r.raise_for_status()
    return r.json().get("centres", [])


def write_raw(rows: list[dict]) -> pathlib.Path:
    OUT.mkdir(parents=True, exist_ok=True)
    p = OUT / f"{datetime.date.today().isoformat()}.jsonl"
    with p.open("a") as f:
        for r in rows:
            f.write(json.dumps(r, ensure_ascii=False) + "\n")
    return p


def main() -> int:
    districts = os.environ.get("SETU_DISTRICTS", "Nalanda,Bhagalpur,Jhabua").split(",")
    total = 0
    for d in districts:
        try:
            rows = fetch(d)
            write_raw(rows)
            total += len(rows)
        except Exception as e:
            print(f"[skill_india] {d} failed: {e}", file=sys.stderr)
    print(f"[skill_india] wrote {total} rows")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
