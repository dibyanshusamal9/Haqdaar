# Haqdaar.ai

**A multimodal, deterministic eligibility matcher for Indian government welfare schemes.**

*Haqdaar* (हक़दार) means "one who is rightfully entitled". A citizen speaks or types their
situation once; the words land in an editable form; a PostgreSQL/JSONB rules engine (not a
language model) decides which of the **4,700+ central and state schemes on myscheme.gov.in**
they qualify for, and shows the reason for every match.

UCS503 Software Engineering project, Thapar Institute of Engineering and Technology, Patiala:
Dibyanshu Samal, Gunagye Jain, Yash Jagwan. Supervisor: Paramveer Sidhu.

## Layout

    apps/
      api/           NestJS API: myscheme.gov.in scraper, rule normaliser, voice/text
                     extraction (Sarvam AI + Groq Llama 3), deterministic matcher, admin API
        db/migrations/   schema + the SQL matching engine (haqdaar_eval / haqdaar_match)
        tests/           unit tests + SQL engine integration tests
      caller-site/   Next.js 16: the citizen website (check eligibility, browse schemes)
      web/           Next.js 14: the curator console (runs, review queue, match audit)
    data/myscheme/raw/   scrape cache (git-ignored; rebuilt by `npm run scrape`)
    docs/                requirements, design, development, testing, operations,
                         reports and presentations (see docs/README.md)
    scripts/dev/         one-click run.bat / stop.bat (database, apps and phone line)

| What | Where |
|---|---|
| Citizen site | http://localhost:3001 |
| Curator console | http://localhost:3000 (sign in with `ADMIN_ACCESS_CODE`) |
| API | http://localhost:4000/api (health: `/api/health`) |

## Quick start (Windows)

Prerequisites: Node 24, pnpm, and PostgreSQL 16 (local install, or Docker Desktop).

1. `copy .env.example .env` and fill in `HAQDAAR_DATABASE_URL`, `ADMIN_ACCESS_CODE`,
   `SARVAM_API_KEY` (voice) and `GROQ_API_KEY` (free at <https://console.groq.com/keys>).
   Without the AI keys everything still works: voice is disabled and free text is parsed by
   deterministic keyword rules.
   The database must be UTF-8 (`createdb -E UTF8 -T template0 haqdaar`, or use Docker below).
2. Build the corpus (about an hour of polite requests the first time; resumable):

   ```
   cd apps\api
   npm install
   npm run build
   npm run scrape
   npm run ingest
   ```
3. `run.bat` from the repo root starts the API (:4000), the citizen site (:3001) and the
   curator console (:3000).

Using Docker for Postgres instead: `docker compose up -d` gives a UTF-8 `haqdaar` database at
`postgresql://postgres:postgres@localhost:5432/haqdaar`.

## How a match works

1. **Input**: the citizen types into the form, or records their voice. Sarvam AI transcribes
   it; Groq-hosted Llama 3 turns the transcript into fixed JSON fields, validated field by
   field. The transcript stays editable and every field is shown before anything is decided.
2. **Matching**: `POST /api/match` normalises the profile and calls `haqdaar_match(profile)`,
   a pure SQL function over each scheme's JSONB rules. No model is called. The same profile
   against the same corpus version always returns the same list, and each match is logged.
3. **Results**: every scheme comes back with the conditions the citizen satisfied, anything
   they still need to confirm, and a link to the official page.

## Where the rules come from

The scraper reads the same public JSON API the myscheme.gov.in website uses:

- the scheme listing (name, level, states, categories),
- the portal's own eligibility tags (gender, caste, residence, marital status, occupation,
  employment, disability, BPL, minority, student…), recovered by querying each filter value,
- exact age and disability-percentage limits, recovered by probing the portal's range filter,
- each scheme's page and documents list.

The normaliser turns tags into hard rules and parses income ceilings from the eligibility text
with regular expressions. Anything it cannot normalise is flagged for the curator (FR-08).

## Tests

    cd apps\api
    npm test

Unit tests cover text parsing, range recovery, normalisation, profile handling, the rule
extractor and ranking; integration tests run the real SQL engine in a throwaway schema.

## Data honesty

Results are informational: the authority running each scheme makes the final decision.
Haqdaar.ai is a student project and is not affiliated with the Government of India. The match
log stores only the profile fields used for matching: no names, phone numbers, audio or
transcripts.

## Documentation and project organization

Start with the [documentation index](docs/README.md) or [local setup](docs/development/setup.md).

- [Repository map and placement rules](docs/development/repository.md)
- [Architecture](docs/design/architecture.md) and [design decisions](docs/design/decisions.md)
- [API contract](docs/design/api.md)
- [Testing and verification](docs/testing/testing.md)
- [Requirements traceability](docs/requirements/traceability.md)
- [Operations and troubleshooting](docs/operations/README.md)
- [Contribution workflow](CONTRIBUTING.md) and [security practices](SECURITY.md)
- [Academic report](docs/reports/Haqdaar_ai_Mid_Sem_Report_LaTeX.pdf)

`apps/` contains deployable applications, `assets/source/` contains original media,
`data/` contains local corpus data, `scripts/` contains repository tooling, and
`docs/` contains engineering documentation. Framework configuration and lockfiles
stay beside the application that owns them. Root launchers remain convenient entry points.
