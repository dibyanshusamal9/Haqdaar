"""Weekly ingest entry point — runs both scrapers, exactly as the GitHub
Actions cron does. Never invoked from the request path.

Run:  python -m ingesters.web.run_weekly
"""
from __future__ import annotations
import sys

from . import nsqf_scraper, ncs_scraper


def main() -> int:
    print("=== weekly ingest starting ===")
    nsqf_stats = nsqf_scraper.run()
    ncs_stats = ncs_scraper.run()
    # Non-zero exit if BOTH scrapers wrote nothing — surfaces a broken run to CI.
    if nsqf_stats["rows_written"] == 0 and ncs_stats["rows_written"] == 0:
        print("!! both scrapers wrote 0 rows — selectors likely need calibration", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
