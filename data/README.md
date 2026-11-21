# Local corpus data

`myscheme/raw/` is the resumable scraper cache; `myscheme/logs/` holds operational batch logs.
Both are ignored and can be large. They are inputs/evidence for ingestion, not application source.
PostgreSQL contains the queryable corpus and audit records. Do not put database backups,
recordings or personal data into tracked files here.

Rebuild cache with the API scrape CLI and normalise it using ingest. See
[operations](../docs/operations/README.md) before refreshing a shared database.
