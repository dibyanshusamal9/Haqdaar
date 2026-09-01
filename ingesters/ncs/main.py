"""National Career Service demand ingester (P2). 90-day active vacancies."""
from __future__ import annotations
import os, sys, json, datetime, pathlib
import httpx


OUT = pathlib.Path("data/raw/ncs")
LIST_URL = "https://www.ncs.gov.in/api/vacancies"  # verify


def fetch(district: str) -> list[dict]:
    r = httpx.get(LIST_URL, params={"district": district, "window": "90d"},
                  timeout=60.0)
    r.raise_for_status()
    return r.json().get("vacancies", [])


def main() -> int:
    OUT.mkdir(parents=True, exist_ok=True)
    p = OUT / f"{datetime.date.today().isoformat()}.jsonl"
    districts = os.environ.get("SETU_DISTRICTS", "Nalanda,Bhagalpur,Jhabua").split(",")
    total = 0
    with p.open("w") as f:
        for d in districts:
            try:
                for r in fetch(d):
                    f.write(json.dumps(r, ensure_ascii=False) + "\n")
                    total += 1
            except Exception as e:
                print(f"[ncs] {d} failed: {e}", file=sys.stderr)
    print(f"[ncs] wrote {total} rows to {p}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
