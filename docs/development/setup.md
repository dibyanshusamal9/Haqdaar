# Local setup

Run commands from `raahi/` unless an application directory is specified. Use Node.js 24,
npm, pnpm for the console, and PostgreSQL 16 (UTF-8). Docker is optional for local Postgres.

1. Copy `.env.example` to `.env`; configure `HAQDAAR_DATABASE_URL` and a private
   `ADMIN_ACCESS_CODE`. Never overwrite an existing local environment file.
2. Start local Postgres with `docker compose up -d`, or use an existing UTF-8 database.
3. In `apps/api`, run `npm ci`, `npm run build`, and `npm run migrate`.
4. In `apps/caller-site`, run `npm ci`. Copy `.env.example` to `.env.local` if needed.
5. In `apps/web`, run `pnpm install --frozen-lockfile`. Copy `.env.example` to `.env.local`.
6. In separate terminals, run `npm start` in the API, `npm run dev -- --port 3001` in the
   citizen site, and `pnpm dev` in the console.

The API health endpoint is `http://localhost:4000/api/health`; citizen UI is on port 3001
and the console on port 3000. The citizen client requires the API base URL without `/api`.
The console uses `HAQDAAR_API_URL` server-side and links to `NEXT_PUBLIC_CITIZEN_SITE_URL`.

For Windows, `run.bat` installs missing dependencies, builds, migrates and starts all apps.
It terminates listeners on ports 3000, 3001 and 4000; use separate terminals when those ports
may belong to other projects. `stop.bat` has the same port-based scope and leaves Postgres running.

## Populate the corpus

In `apps/api`, run `npm run scrape` then `npm run ingest`. Scraping calls the external
source and can take a long time; its disk cache allows resuming. Ingest writes the database.
An empty database can start successfully but cannot return useful matches. Query health/stats
for current corpus counts instead of assuming the README's headline figure is loaded locally.

## Configuration ownership

The API loads `apps/api/.env` first, then root `.env`; existing process variables take precedence.
The Next.js apps use their own environment files. Restart the relevant server after changes.
`SARVAM_API_KEY` enables speech transcription. `GROQ_API_KEY` enables model extraction;
without it, the API uses deterministic keyword extraction. The typed form remains available.
Use `.env.example` and `apps/api/src/config.ts` as the configuration references.
