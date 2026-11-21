# REST API contract

Development base URL: `http://localhost:4000/api`. JSON requests use `Content-Type:
application/json`. Request schemas in controllers and `src/domain/profile.ts` are authoritative.
The browser should fetch `/profile/schema` for allowed values, required fields and capabilities.

## Public endpoints

- `GET /health`: API/corpus status.
- `GET /schemes`: browse with optional `q`, `level` (`central` or `state`), `state`, `category`,
  `page` (1–1000; default 1) and `size` (1–100; default 24).
- `GET /schemes/stats`: counts grouped by level, state and category.
- `GET /schemes/:slug`: one scheme and its eligibility information.
- `GET /profile/schema`: required fields, choices and voice/model capability flags.
- `POST /profile/extract`: `{ "text": "..." }`, between 1 and 4000 characters.
  Returns `transcript`, `languageCode`, `fields`, `filled`, `missingRequired`, `dropped`,
  `extractor`, and `warning`. The citizen must review the resulting form.
- `POST /profile/voice`: multipart field `audio` (up to 10 MiB), optional `language`
  (up to 5 characters). Returns the extraction response after transcription.
- `POST /match`: `{ "profile": { ... }, "inputMode": "form" }`; mode also accepts
  `voice` and `text`. Missing mandatory fields cause validation failure. Results include
  eligible/likely matches, reasons and conditions requiring verification.
- `POST /call/turn`: one turn of the phone-line (IVR) demo. Stateless: the browser sends
  `{ "stage": "menu" | "start" | "answer", "language": "hi" | "en", "asked", "attempt",
  "text", "profile", "skipped" }` and gets back the agent's line (`say`), Sarvam voice clips
  (`audio`, base64 WAV, or `null` so the browser reads `voice` itself), the updated state,
  and `done`. The call asks only for missing fields (the five required ones, then
  occupation and income once each); when it is done the response carries `match`, from
  the same matcher as `POST /match` (logged with input mode `voice`).
- `POST /call/listen`: multipart field `audio` (up to 5 MiB) and `language` (`hi`/`en`).
  Returns `{ "text", "available" }`; `available: false` means speech-to-text is down and
  the browser falls back to its own recogniser.

## Curator endpoints

All `/admin` endpoints require the `x-admin-code` header, validated by `AdminGuard`.
The console calls them server-side. Do not put the access code into browser environment variables.

- `GET /admin/session`: credential check.
- `GET /admin/overview`: operational summary.
- `GET /admin/runs`: batch history.
- `POST /admin/runs`: `{ "mode": "refresh" }` or `{ "mode": "ingest" }`; returns HTTP 202.
  Refresh calls the external source and writes the corpus; ingest uses cached data.
- `GET /admin/review`: optional `status` (`flagged`, `auto`, `approved`, `edited`, `all`),
  `page` and `q`; default status is `flagged`.
- `PATCH /admin/schemes/:slug`: curator edits validated by `SchemeEdit` in
  `apps/api/src/admin/admin.service.ts`; includes audit history.
- `GET /admin/matches`: paginated match audit.
- `GET /admin/matches/:id/replay`: UUID match identifier; evaluates against the current corpus.
  A changed corpus can legitimately change results; this is not a historical snapshot restore.

## Error handling and compatibility

Invalid request shapes are rejected by Zod-backed validation; clients should display the
returned error and retain form input. Missing audio is a bad request. Provider failures
must preserve the typed workflow. Do not infer a zero-match result from a network error.
Document payload changes here and update the citizen client's types and console server client
together. This document is a human-readable contract, not a generated OpenAPI specification.
