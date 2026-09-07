# ingesters/ — how NSQF & demand data gets into the database

There are **two** ingesters, for two different jobs. Both write to the **same
Postgres database the voice app reads** (`DATABASE_URL`, default the local
Docker Postgres `setu`).

| Path | What it does | When it runs | Writes to |
|------|--------------|--------------|-----------|
| `import_nsqf_extracted.py` | One-time bulk load of the **local NIELIT SQLite extract** (`DATABASE EXTRACTED/build/qualifications.db`) | manually, once | `qualifications` (+ side tables) |
| `web/` | **Live weekly web scraper** — NCVET/NQR → courses, NCS → district demand | weekly cron (GitHub Actions) | `qualifications`, `demand_signals`, `ingest_runs`, `ingest_quarantine` |

The old standalone TypeScript scraper (`livelihood-setu-ingest/`) has been
**ported into `web/`** in this repo's own stack (Python + psycopg + our SQL
schema), so there is now a single scraper location. `livelihood-setu-ingest/`
can be deleted.

## Where the data actually lives

Postgres, database `setu`. Inspect it directly:

```bash
# list tables
docker exec project-db-1 psql -U postgres -d setu -c "\dt"

# the corpus the ranker matches against
docker exec project-db-1 psql -U postgres -d setu -c "select sector, count(*) from qualifications group by 1 order by 2 desc;"

# district demand
docker exec project-db-1 psql -U postgres -d setu -c "select district, count(*) from demand_signals group by 1;"

# scraper health (one row per run)
docker exec project-db-1 psql -U postgres -d setu -c "select source, ran_at, rows_seen, rows_written, rows_quarantined from ingest_runs order by ran_at desc limit 10;"

# rows the scraper rejected, for review
docker exec project-db-1 psql -U postgres -d setu -c "select source, reason, created_at from ingest_quarantine where not reviewed order by created_at desc limit 20;"
```

Schema is defined in `db/migrations/*.sql`. The tables:
`qualifications`, `qualification_eligibility`, `qualification_pathways`,
`qualification_modules`, `training_centres`, `centre_qualifications`,
`demand_signals`, `beneficiaries`, `sessions`, `voice_turns`,
`recommendations`, `enrollments`, `ingest_runs`, `ingest_quarantine`,
`skill_synonyms`.

## Running the weekly scraper

```bash
pip install -r ingesters/web/requirements.txt
python -m playwright install --with-deps chromium
python -m ingesters.web.run_weekly        # both scrapers
python -m ingesters.web.nsqf_scraper      # just courses
python -m ingesters.web.ncs_scraper       # just demand
```

The GitHub Action `.github/workflows/ingest-weekly.yml` runs
`run_weekly` every Monday 03:00 IST and on the manual **Run workflow**
button. It needs repo secrets: `DATABASE_URL`, `SLACK_INGEST_WEBHOOK_URL`.

### ⚠️ Selectors need calibration before the first real run

Both scrapers use **placeholder CSS selectors** (marked `# TODO(selector)`)
because the government portals render results with framework-generated markup
that has no stable ids. Until they're calibrated, a run scrapes 0 rows (and
`run_weekly` exits non-zero so CI flags it). To calibrate:

```bash
python -m playwright codegen https://kaushalverse.ncvet.gov.in/homepage/repository
python -m playwright codegen https://www.ncs.gov.in/job-seeker/Pages/JobSearch.aspx
```
Replace the `# TODO(selector)` lines with the real selectors. The rest of the
pipeline (normalise → quarantine → upsert → record run) is done.
