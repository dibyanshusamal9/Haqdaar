# Haqdaar.ai architecture

Five subsystems, as in the mid-semester report (§1.2). The language model only ever turns
words into form fields; eligibility is a database query.

```
   citizen                                                  admin / curator
     │ form, or voice                                             │
     ▼                                                            ▼
┌──────────────────────┐   REST    ┌───────────────────────────────────────────────────────────────┐
│ caller-site (Next 16)│ ────────► │ api (NestJS)                                                  │
│  /check  /schemes    │           │                                                               │
└──────────────────────┘           │  ProfileController ── SttService ──► Sarvam AI (speech → text)
┌──────────────────────┐ server    │        │            └ ExtractorService ─► Groq Llama 3 (text → JSON)
│ web (Next 14)        │ actions   │        │                 └ rule-extractor (fallback, no model)
│  curator console     │ ────────► │  MatchController ── MatchService ──► haqdaar_match()  (SQL, no model)
└──────────────────────┘           │  SchemesController, AdminController (x-admin-code)            │
                                   │  cli.ts: migrate · scrape · ingest · refresh                  │
                                   └───────────────┬─────────────────────────────┬─────────────────┘
                                                   │                             │
                              MySchemeScraper ◄────┘                             ▼
                     (polite, cached, resumable)                     PostgreSQL 16
                     api.myscheme.gov.in  ──► data/myscheme/raw ──►  schemes (rules JSONB)
                                                normaliser            ingest_runs · curator_edits
                                                                      match_logs
```

## Data ingestion (UC-06, FR-07..09)

`apps/api/src/ingest/`

| Stage | What it fetches | Output |
|---|---|---|
| listing | every scheme card from `search/v6/schemes` (100 per page, sorted for stable paging) | `listing.json` |
| facets | for each value of gender, caste, residence, marital status, employment, occupation, and the yes/no tags (disability, minority, BPL, student, government employee, economic distress): the schemes the portal tags with it | `facets.json` |
| ranges | the age and disability-percentage limits, recovered from the portal's range filter (below) | `range-age.json`, `range-disability.json` |
| details | each scheme page (`schemes/v6/public/schemes?slug=`) and its documents list | `details/`, `documents/` |

**Politeness (NFR-07).** One global throttle (default one request every 350 ms, three workers),
exponential backoff with `Retry-After` support on 429/5xx/network errors, an identifying
User-Agent, and a disk cache so interrupted runs resume. The public `x-api-key` is read from the
site's own JS bundle, the same way every visitor's browser gets it.

**Recovering exact age limits.** The portal filters ranges by *overlap*: `{min:a, max:b}`
returns schemes whose `[lower, upper]` overlaps `[a, b]`. Counting `[0, a]` and `[b, 120]` for
every integer shows exactly where limits sit (a count rises at each scheme's lower limit and drops
just past each upper limit). Fetching full membership at each of those boundary points then pins
every scheme's limits exactly. `range-probe.ts` is pure and unit-tested; if a probe budget is ever
set, the leftovers become a *strict* band (pass) inside a *permissive* band (verify), so a citizen
is never excluded because of our uncertainty.

**Normaliser (FR-08).** `normaliser.ts` turns one cached scheme into a record with
`rules = {version: 1, all: [predicate…]}`:

- portal tags → hard predicates (`state in`, `gender in`, `caste in`, `bpl eq true`, …);
- recovered ranges → `age between [lo, hi]`, `disability_percent gte n`;
- eligibility text (regex, `eligibility-text.ts`) → `annual_income lte ₹n`; age bounds only
  when the portal has none, and then as *soft* predicates that ask to verify instead of excluding.

Anything that looks like a condition but does not parse is listed in `review_reasons` and the
scheme is flagged for the curator.

**Repository (FR-09).** `ingest.ts` upserts on `source_url` and compares a content hash, so a
re-run on an unchanged cache writes nothing. Schemes that disappear from a complete listing are
marked withdrawn. Rules a curator edited survive later scrapes; an approval does not survive a
rule change. Every run that changes rows becomes the new *corpus version*.

## Matching (UC-04, FR-05/06, NFR-01)

`apps/api/db/migrations/0002_matcher.sql`

- `haqdaar_eval(predicate, profile)` returns `pass`, `fail` or `unknown` (missing value, inside
  an uncertain band, or a soft predicate that failed).
- `haqdaar_match(profile)` returns every live scheme with no failed predicate: `eligible` if
  every predicate passed, `likely` otherwise, with the passed predicates (the reasons) and the
  undecided ones (what to verify).

`MatchService` normalises the profile (aliases, units, PVTG → also ST, dairy farmer → also
farmer), rejects missing required fields by name, ranks deterministically (open schemes first,
then how specifically the scheme targets this profile, then name and slug in code-point order),
logs the request with its corpus version (FR-11), and can replay any logged match.

## Extraction (UC-02, FR-02..04)

`POST /api/profile/voice` (multipart audio) → Sarvam `speech-to-text` → transcript →
`ExtractorService`. With `GROQ_API_KEY`, Llama 3 returns one JSON object under a fixed schema at
temperature 0; every field is normalised and validated, and invalid ones are dropped and left
blank (UC-02 5a). Without a key, or if Groq fails, `rule-extractor.ts` fills what it can from
English, romanised Hindi and Devanagari keywords (NFR-03). The response lists which fields were
filled so the form can highlight them (US-02).

## API

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/health` | liveness + corpus size and version |
| GET | `/api/schemes` | browse/search (`q`, `level`, `state`, `category`, `page`, `size`) |
| GET | `/api/schemes/stats` | corpus counts by level, state and category |
| GET | `/api/schemes/:slug` | one scheme, including its rules |
| GET | `/api/profile/schema` | form options and whether voice / LLM are available |
| POST | `/api/profile/extract` | `{text}` → profile fields |
| POST | `/api/profile/voice` | multipart `audio`, `language` → transcript + fields |
| POST | `/api/match` | `{profile, inputMode}` → ranked schemes with reasons |
| GET | `/api/admin/overview` · `/runs` · `/review` · `/matches` | curator views (header `x-admin-code`) |
| POST | `/api/admin/runs` | `{mode: refresh \| ingest}` starts a batch job |
| PATCH | `/api/admin/schemes/:slug` | approve / flag / replace a scheme's rules |
| GET | `/api/admin/matches/:id/replay` | re-run a logged match and compare |

## Tables

| Table | Holds |
|---|---|
| `schemes` | the corpus: presentation fields, `rules` JSONB, review status, content hash, corpus version, generated full-text `search_doc` |
| `ingest_runs` | every scrape, re-ingest and curator edit, with added/updated/flagged counts; changing runs are corpus versions |
| `curator_edits` | old and new rules for every curator change |
| `match_logs` | profile fields, corpus version, ranked result slugs, timing (no transcripts, no names) |
