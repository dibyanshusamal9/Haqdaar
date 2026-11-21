# Testing Haqdaar.ai

Run commands below from the repository root unless another working directory is shown.
API suites are in `apps/api/tests`. SQL integration tests create a temporary schema; use a
dedicated development/test database with schema creation permission. The current suite
returns early when the database is unavailable, so a green Jest result alone does not prove
that SQL integration cases executed. Check connectivity and test conditions explicitly.

## Structural and frontend checks

- Repository links: `node scripts/quality/check-doc-links.mjs`.
- API: `npm run typecheck` and `npm run build` from `apps/api`.
- Citizen: `npx tsc --noEmit` and `npm run lint` from `apps/caller-site`.
- Console: `pnpm exec tsc --noEmit` and `pnpm build` from `apps/web`.
- Animation: `node --test tests/scroll-sequence.test.mjs` from `apps/caller-site`, with the
  citizen server on port 3001 (`TEST_SITE_URL` overrides the URL). Requires Puppeteer's browser.
  Covers forward/reverse captions, usable CTAs, source-resolution rendering, progressive
  loading, a failed frame, bounded decoded memory, resizing and cleanup on navigation.

Full release verification also includes production builds and manual API/provider workflows.
Builds may fetch Google Fonts. Browser and database prerequisites must be reported when unavailable.

## Automated

    cd apps/api
    npm test

| Suite | Covers |
|---|---|
| `eligibility-text.spec.ts` | income ceilings (lakh, Indian digit grouping, monthly → annual, category-wise limits), age phrases, refusing to guess |
| `range-probe.spec.ts` | recovering exact age limits from simulated overlap-filter counts; permissive bands when probes are limited |
| `normaliser.spec.ts` | portal tags → predicates, text refinement of approximate bounds, flags for what cannot be normalised |
| `profile.spec.ts` | profile aliases and units, PVTG/dairy-farmer expansion, keyword extraction (English, Devanagari, negation), ranking determinism |
| `matcher.db.spec.ts` | the real SQL engine in a throwaway schema: exclusion, `likely` for missing/uncertain values, soft predicates, reasons, determinism, logging + replay, missing-field rejection (skipped if no database is reachable) |

## By hand

With the API, citizen site and console running (`run.bat`):

1. **Typed form.** Open http://localhost:3001/check, fill age 45, female, Bihar, rural, SC,
   income 80000, BPL yes, and press *Find my schemes*. Expect a long list led by Bihar and
   central schemes for SC women / BPL households, each with green ✓ reasons.
2. **Missing fields (UC-04 2a).** Clear *State* and submit: the form names the missing field.
3. **Free text.** Type *"I am a 67 year old farmer from a village in Rajasthan, general category,
   income 60000"* and press *Fill the form from this*: age, state, area, category, occupation
   and income fill in and are highlighted. Change one: its highlight disappears.
4. **Voice.** With `SARVAM_API_KEY` set, tap the microphone and speak the same sentence in Hindi.
   The transcript appears in the editable box and the fields fill in. Without the key the
   microphone is disabled and the page says to type instead (NFR-03).
5. **Undecided income.** Leave income blank: schemes with an income limit appear under *Check one
   detail* asking you to add your income, instead of disappearing.
6. **Reproducibility (NFR-01).** In the console (http://localhost:3000) open *Match log* and press
   *Replay* on any row: it reports *Identical* while the corpus version is unchanged.
7. **Curator edit (UC-06 4a).** In *Review queue* open a flagged scheme, edit its rules JSON
   (for example add `{"field":"annual_income","op":"lte","value":250000}`), save: a new corpus
   version appears under *Scrape runs*, and replaying an older match now reports the version change.

## Example profiles

http://localhost:3001/examples opens the checker pre-filled for five illustrative people (a
widowed farm worker in Bihar, a student in Kerala, an older farmer in Rajasthan, a minority
artisan in Uttar Pradesh, a job-seeker with a disability in Maharashtra).
