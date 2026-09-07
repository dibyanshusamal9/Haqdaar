"""NSQF qualification-pack scraper — NCVET National Qualification Register
(served from KaushalVerse). Weekly cadence. Writes to `qualifications`.

Python/Playwright port of the original TypeScript scraper. Method matches the
workflow doc: drive the search UI (no public API), normalise every row before
writing, quarantine (never silently drop) anything that fails validation.

⚠️ SELECTORS ARE PLACEHOLDERS. The gov portals render results with
framework-generated markup that has no stable test ids. Before the first real
run, open the page in Playwright codegen and replace the CSS selectors marked
`# TODO(selector)` below:
    python -m playwright codegen https://kaushalverse.ncvet.gov.in/homepage/repository
The rest of the pipeline (normalise → quarantine → upsert → record run) does
not change once the selectors are right.

Run:  python -m ingesters.web.nsqf_scraper
"""
from __future__ import annotations
import time

from .db import upsert_qualification, quarantine, record_ingest_run, today
from .normalize import parse_eligibility, infer_mode, infer_self_employment, NormalizationError

NQR_URL = "https://kaushalverse.ncvet.gov.in/homepage/repository"

# Seed sector list — in production, read distinct sectors from training_centres
# so district officers can extend coverage without a redeploy.
TARGET_SECTORS = [
    "Electronics", "Construction", "Automotive", "Retail", "Beauty & Wellness",
    "Healthcare", "Agriculture", "Apparel", "IT-ITeS", "Capital Goods",
    "Power", "Plumbing", "Green Jobs", "Food Processing", "Logistics",
]


def _scrape_sector(page, sector: str) -> list[dict]:
    page.goto(NQR_URL, wait_until="networkidle")
    # TODO(selector): sector dropdown + search button
    page.get_by_label("Sector").select_option(label=sector)
    page.get_by_role("button", name="Search").click()
    page.wait_for_selector('[data-testid="qp-result-row"]', timeout=15000)

    rows: list[dict] = []
    for handle in page.query_selector_all('[data-testid="qp-result-row"]'):  # TODO(selector)
        qp_code = handle.get_attribute("data-qp-code") or ""
        detail_href = handle.get_attribute("data-detail-href") or ""
        handle.click()
        detail = page.locator('[data-testid="qp-detail-panel"]')  # TODO(selector)
        detail.wait_for(state="visible", timeout=10000)
        nsqf = detail.locator('[data-field="nsqf-level"]').inner_text()
        dur = detail.locator('[data-field="notional-hours"]').inner_text()
        roles = detail.locator('[data-field="job-roles"]').inner_text()
        elig = detail.locator('[data-field="entry-criteria"]').inner_text()
        rows.append({
            "qp_code": qp_code,
            "nsqf_level": int("".join(filter(str.isdigit, nsqf)) or 0),
            "sector": sector,
            "job_roles": roles.strip(),
            "duration_hours": int("".join(filter(str.isdigit, dur)) or 0),
            "eligibility_text": elig.strip(),
            "source_url": detail_href or NQR_URL,
        })
        page.keyboard.press("Escape")
    return rows


def run() -> dict:
    from playwright.sync_api import sync_playwright  # imported here so the
    # module imports even if playwright isn't installed (e.g. on the API host).

    started = time.perf_counter()
    seen = written = quarantined = 0
    err = None
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(user_agent="LivelihoodSetu-Ingest/1.0")
        try:
            for sector in TARGET_SECTORS:
                try:
                    scraped = _scrape_sector(page, sector)
                except Exception as e:
                    print(f"[nsqf] sector {sector!r} failed, skipping: {e}")
                    continue
                seen += len(scraped)
                for row in scraped:
                    try:
                        elig = parse_eligibility(row["eligibility_text"])
                        upsert_qualification({
                            "qp_code": row["qp_code"],
                            "name": (row["job_roles"].split(",")[0].strip()
                                     or row["qp_code"]),
                            "sector": row["sector"],
                            "nsqf_level": max(1, min(8, row["nsqf_level"] or 3)),
                            "duration_hours": row["duration_hours"] or 0,
                            "entry_min_class": elig["entry_min_class"],
                            "entry_min_age": elig["entry_min_age"] or 18,
                            "mode": infer_mode(row["job_roles"], row["eligibility_text"]),
                            "self_employment_track": infer_self_employment(row["job_roles"]),
                            "job_role": row["job_roles"],
                            "keywords": row["eligibility_text"][:500],
                            "source_url": row["source_url"],
                            "evidence_date": today(),
                        })
                        written += 1
                    except NormalizationError as e:
                        quarantine("nsqf", row, str(e)); quarantined += 1
                    except Exception as e:
                        quarantine("nsqf", row, f"unexpected: {e}"); quarantined += 1
        except Exception as e:
            err = str(e)
        finally:
            browser.close()

    stats = {"rows_seen": seen, "rows_written": written,
             "rows_quarantined": quarantined,
             "duration_ms": int((time.perf_counter() - started) * 1000), "error": err}
    record_ingest_run("nsqf", stats)
    print(f"[nsqf] {stats}")
    return stats


if __name__ == "__main__":
    run()
