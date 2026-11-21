# Haqdaar.ai API

NestJS 12 + PostgreSQL. Scrapes myscheme.gov.in, normalises eligibility into JSONB rules,
extracts profile fields from voice or text, and matches citizens to schemes with a pure SQL
engine. See [the architecture](../../docs/design/architecture.md).

    npm install
    npm run build
    npm run migrate          # also runs automatically when the API starts
    npm run scrape           # myscheme.gov.in -> data/myscheme/raw (resumable, ~1 h first time)
    npm run ingest           # normalise the cache -> database (seconds; idempotent)
    npm start                # http://localhost:4000/api
    npm test

Scrape options: `--stages listing,facets,ranges,details`, `--limit N` (details for the first N
schemes only), `--refresh` (ignore the cache), `--max-age-days N` (default 6).
`node dist/cli.js refresh` runs scrape + ingest as one recorded run; the curator console's
*Scrape runs* page starts the same command.

Configuration comes from the repo-root `.env` (see `.env.example`), optionally overridden by
`apps/api/.env`. The database must be UTF-8.

NestJS 12 is published as ES modules; the compiled CommonJS output loads it through Node 24's
`require(esm)`, and `npm test` runs Jest with `--experimental-vm-modules` for the same reason.

## Module ownership

`src/domain` defines profile/rule types and pure normalization; `src/profile` owns speech and
field extraction; `src/match` owns matching/ranking; `src/ingest` owns external collection and
normalization; `src/admin` owns curator operations; `src/schemes` owns public corpus queries.
`src/db` provides the database adapter, while `db/migrations` owns persisted schema/rules.
Tests live in `tests/`. Configuration and server/CLI composition stay at the `src` root.

See [API contracts](../../docs/design/api.md), [setup](../../docs/development/setup.md),
and [operations](../../docs/operations/README.md). `npm run dev` builds once and watches
compiled JavaScript; run TypeScript watch in a second terminal for continuous recompilation.
