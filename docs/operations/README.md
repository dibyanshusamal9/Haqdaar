# Operations and recovery

## Database lifecycle

Build the API before CLI commands. From `apps/api`, `npm run migrate` applies unapplied
`db/migrations/*.sql` in filename order, recording them in `schema_migrations`. Each file
runs in a transaction. Startup also migrates. Existing migrations must remain immutable.
The database stores schemes, ingest runs, curator edits and match logs; see architecture.

Before schema or corpus changes in a shared environment, take a PostgreSQL backup using
your database provider or `pg_dump`. Keep backups outside Git and verify a restore into a
separate database before relying on them. This project does not implement automatic rollback
or a backup scheduler. Do not remove Docker volumes to fix an application startup problem.

## Corpus lifecycle

`npm run scrape` populates `data/myscheme/raw`; `npm run ingest` normalises cached records
into PostgreSQL. `node dist/cli.js refresh` performs both as a recorded batch. Review failed
runs and flagged rules in the console. A full refresh can change corpus versions and therefore
match results. Retain cache/logs for diagnosis; reruns use the existing cache and upsert by source URL.

`.github/workflows/ingest-weekly.yml` schedules refresh for Monday 03:00 Asia/Calcutta and
also supports manual dispatch. It requires the GitHub repository secret `HAQDAAR_DATABASE_URL`
for a reachable database. Do not place that credential in the workflow file.

## Phone line (Exotel)

Callers reach the same conversation as the web call demo through Exotel's Voicebot applet,
which streams the call to `wss://<public host>/exotel/voicebot?sample-rate=16000`.

1. `run.bat` starts PostgreSQL, the API, both websites and a Cloudflare quick tunnel, then
   prints the Voicebot URL (also copied to the clipboard and written to `phone-line-url.txt`).
2. A **new** tunnel has a new address: paste it into the Voicebot URL of the "Haqdaar
   Helpline" flow and Save (run.bat opens `EXOTEL_FLOW_EDIT_URL`). A tunnel left running is
   reused, so restarting the apps alone keeps the address. `stop.bat` ends the tunnel.
3. The caller keys in `EXOTEL_CALL_PIN` (empty = no PIN), chooses a language (1 Hindi,
   2 English, 3 Bengali, 4 Marathi, 5 Odia), answers by voice or keypad (digits are sent after
   a 2-second pause), and hears the top two schemes for their area of interest.

Only calls from `EXOTEL_ACCOUNT_SID` are accepted. No API key or secret is configured in
Exotel. If calls connect and go silent, the Voicebot URL is usually an old tunnel address.
The API window logs each call (`call …abc123 started`, `heard "…"`, `matched …`).

## Deployment checklist

- Build each application using its own lockfile and package manager.
- Configure API and app environment values for the deployed origins; use explicit CORS origins.
- Serve public traffic over HTTPS and replace the development curator code.
- Keep the database and provider credentials server-side; restrict database access.
- Include API migrations alongside compiled output and citizen public assets alongside its build.
- Verify health, typed matching, provider failure fallback, curator sign-in and a representative replay.
- Measure the report's query/extraction latency targets in the deployed environment.

## Troubleshooting

- No matches or zero corpus: check `/api/health`, database URL and completed ingest runs.
- API unavailable: check Postgres, build output, port 4000 and migration errors.
- Browser CORS error: match the exact citizen origin in `CORS_ORIGINS` and restart the API.
- Voice unavailable: inspect capability flags and server-side Sarvam configuration; use the typed form.
- Extraction incomplete: review `dropped`/`missingRequired` and correct the form.
- Film frames missing: regenerate from the source ZIP; verify `public/scroll-frames` is deployed.
- Frontend build font errors: check network access to the configured font service.
- Port already in use: identify the owner before using the legacy port-based stop script.
