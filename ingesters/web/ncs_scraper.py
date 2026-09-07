"""demand_signals scraper — National Career Service (ncs.gov.in) job-vacancy
search, counted by district × sector over the last 90 days. Weekly cadence.

Python/Playwright port of the original TS scraper. Every row it writes gets a
fresh evidence_date, which is what lets the ranker age a row out after 180 days
of silence instead of deleting anything.

⚠️ SELECTORS ARE PLACEHOLDERS — see the note in nsqf_scraper.py. Calibrate with:
    python -m playwright codegen https://www.ncs.gov.in/job-seeker/Pages/JobSearch.aspx

Run:  python -m ingesters.web.ncs_scraper
"""
from __future__ import annotations
import time

from .db import upsert_demand_signal, record_ingest_run, today

NCS_URL = "https://www.ncs.gov.in/job-seeker/Pages/JobSearch.aspx"
LOOKBACK_DAYS = 90

# Pilot districts → state (demand_signals.state is NOT NULL). In production,
# read distinct (district, state) from training_centres.
PILOT_DISTRICTS = {
    "Nalanda": "Bihar", "Bhagalpur": "Bihar", "Gaya": "Bihar",
    "Jhabua": "Madhya Pradesh", "Chitrakoot": "Uttar Pradesh",
    "Ramanathapuram": "Tamil Nadu", "Nuh": "Haryana",
}
SECTORS = [
    "Electronics", "Construction", "Automotive", "Retail", "Beauty & Wellness",
    "Healthcare", "Agriculture", "Apparel", "IT-ITeS", "Capital Goods",
    "Power", "Plumbing", "Green Jobs", "Food Processing", "Logistics",
]


def _scrape_cell(page, district: str, sector: str) -> list[dict]:
    page.goto(NCS_URL, wait_until="networkidle")
    # TODO(selector): district + sector filters, date range, search
    page.get_by_label("District").select_option(label=district)
    page.get_by_label("Sector").select_option(label=sector)
    page.get_by_role("button", name="Search").click()
    page.wait_for_load_state("networkidle")

    rows: list[dict] = []
    for rr in page.query_selector_all('[data-testid="vacancy-role-row"]'):  # TODO(selector)
        role = (rr.query_selector('[data-field="role-title"]').inner_text() or "").strip()
        count_txt = rr.query_selector('[data-field="opening-count"]').inner_text()
        count = int("".join(filter(str.isdigit, count_txt)) or 0)
        if role and count > 0:
            rows.append({"district": district, "sector": sector,
                         "role": role, "openings": count})
    return rows


def run() -> dict:
    from playwright.sync_api import sync_playwright

    started = time.perf_counter()
    seen = written = 0
    err = None
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(user_agent="LivelihoodSetu-Ingest/1.0")
        try:
            for district, state in PILOT_DISTRICTS.items():
                for sector in SECTORS:
                    try:
                        rows = _scrape_cell(page, district, sector)
                    except Exception as e:
                        print(f"[ncs] {district}×{sector} failed, skipping: {e}")
                        continue
                    seen += len(rows)
                    for row in rows:
                        upsert_demand_signal({
                            "district": row["district"],
                            "state": state,
                            "sector": row["sector"],
                            "qp_code": None,
                            "role_title": row["role"],
                            "vacancies_90d": row["openings"],  # raw count; ranker scales it
                            "source_url": NCS_URL,
                            "evidence_date": today(),
                        })
                        written += 1
                    page.wait_for_timeout(400)  # polite to a gov portal
        except Exception as e:
            err = str(e)
        finally:
            browser.close()

    stats = {"rows_seen": seen, "rows_written": written, "rows_quarantined": 0,
             "duration_ms": int((time.perf_counter() - started) * 1000), "error": err}
    record_ingest_run("ncs", stats)
    print(f"[ncs] {stats}")
    return stats


if __name__ == "__main__":
    run()
