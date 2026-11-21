# Requirements traceability

Baseline: [October 2026 mid-semester report](../reports/Haqdaar_ai_Mid_Sem_Report_LaTeX.pdf),
SRS sections 3.1–3.2 and use cases UC-02 through UC-06. This mapping records implementation
evidence and verification needs; it is not a claim that every acceptance criterion is complete.
Paths below are relative to the repository root.

## Functional requirements

- **FR-01 typed profile**: `apps/caller-site/src/features/check/ProfileForm.tsx` and
  `apps/api/src/domain/profile.ts`. Verify required fields, invalid values and manual correction.
- **FR-02 voice**: `DescribeCard.tsx` in the check feature, API `profile/profile.controller.ts`
  and `profile/stt.service.ts`. Live provider/microphone verification is required.
- **FR-03 structured extraction**: API `profile/extractor.service.ts`, `profile/rule-extractor.ts`
  and profile validation. `apps/api/tests/profile.spec.ts` covers deterministic parsing;
  real model responses and failure handling require integration/manual checks.
- **FR-04 editable fields**: citizen `src/app/check/page.tsx` and check feature components.
  Manually verify corrections, highlighted extracted fields and submitted values.
- **FR-05 deterministic matching**: API `src/match`, domain predicates and SQL migrations
  `0002_matcher.sql`/`0003_matcher_fast.sql`. `matcher.db.spec.ts` exercises SQL behavior.
- **FR-06 reasons**: matcher output and check `Results.tsx`; database tests plus manual cards.
- **FR-07 corpus ingestion**: API `src/ingest/scraper.ts` and `src/cli.ts`.
  Run a controlled scrape/ingest and inspect current counts. The report's minimum is 150;
  the UI's larger corpus figure is not proof of the locally loaded record count.
- **FR-08 normalisation/review**: API `src/ingest/normaliser.ts`, `eligibility-text.ts`,
  `src/admin`, and console review route. Normaliser/text unit tests cover parsing;
  curator approval/edit paths need manual verification.
- **FR-09 idempotence**: API `src/ingest/ingest.ts`, source URL uniqueness and content hashes.
  Verify a repeated ingest against an unchanged cache and inspect run counts/audit history.
- **FR-10 presentation**: citizen check `Results.tsx` and scheme routes. Manually verify
  reasons, official URLs and filtering, including empty/error states.
- **FR-11 logging**: API `src/match/match.service.ts`, `match_logs` and console matches route.
  Database tests exercise logging/replay. Replay uses today's corpus, so changed rules can differ.

## Non-functional requirements

- **NFR-01 reproducibility**: pure SQL evaluation and deterministic ranking; profile/database
  tests. Compare the same profile with the same corpus version. Historical corpus restoration
  is not implemented by the replay endpoint.
- **NFR-02 performance**: report targets are matching below 500 ms and voice extraction below
  8 seconds. Benchmark separately on the full corpus and representative network/hardware;
  no performance acceptance result is implied by this reorganization.
- **NFR-03 reliability**: keyword extraction fallback and editable typed workflow. Exercise
  missing provider keys, provider failures, empty transcripts and interrupted requests.
- **NFR-04 usability**: responsive citizen UI and language resources. Animation tests cover
  desktop/mobile captions; full keyboard, screen-reader and real-user usability checks remain separate.
- **NFR-05 privacy/security**: server-side secrets, input validation and limited match logging.
  HTTPS is a deployment responsibility; review retention and provider data handling before release.
- **NFR-06 maintainability**: three app boundaries, feature UI, API domain/services/database
  adapter, colocated tests, engineering docs. No additional generic repository abstraction is claimed.
- **NFR-07 polite scraping**: throttling/retries/cache in `src/ingest/myscheme.client.ts`;
  verify live source behavior and respect configured request limits.

## Use cases and stories

UC-02 and US-01 map to transcription/extraction; UC-03 and US-02 to editable review;
UC-04 and US-03 to matching; UC-05 and US-05 to result explanations; UC-06 and US-04 to
scraping/ingestion. The report's diagrams describe logical flows, not necessarily separate
physical stores: the current application does not introduce a standalone persistent profile store.

Record test command, date, environment, corpus version and any skipped checks when evaluating
these criteria. Keep source code and tests authoritative for current behavior.
