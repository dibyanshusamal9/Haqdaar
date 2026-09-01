# Livelihood Setu

Voice-first AI counsellor for NSQF-aligned skilling under PM-AJAY GIA.
A beneficiary calls a number, speaks eight answers in their own language,
and receives three ranked pathways with a spoken reason for each —
grounded in real NSQF qualifications, real training centres, and real
district demand data.

This monorepo implements the MVP (FR-01 → FR-10) from `docs/PRD.md`.

## Layout

    apps/
      voice/         Python FastAPI — voice pipeline, IVR/WhatsApp webhooks,
                     STT, LLM extractor, ranker, composer, pack sender
      web/           Next.js 14 (App Router) — officer dashboard,
                     explainability drill-down, mobiliser leads queue
    db/
      migrations/    Postgres/Supabase schema (tables, ranking SQL function,
                     lifecycle triggers)
      seed/          Seed corpus — 60 NSQF QPs, 40 centres, 120 demand rows
    ingesters/       Weekly ingest jobs: NCVET, Skill India, NCS (P2 stubs)
    docs/            Architecture notes and PRD

## Quickstart

1. **Database.** Create a Supabase project (region `ap-south-1`).
   Apply `db/migrations/*.sql` in order, then run `db/seed/seed.sql`.

2. **Environment.** `cp .env.example .env` and fill Sarvam + Supabase keys.
   Other providers (Exotel, WhatsApp, extractor LLM) default to mock
   adapters — the system runs end-to-end without them.

3. **Voice service.**
   ```
   cd apps/voice
   pip install -r requirements.txt
   uvicorn app.main:app --reload --port 8000
   ```
   Try a session: `curl -X POST localhost:8000/session/turn -H "content-type: application/json" -d '{"phone_hash":"demo","text":"नमस्ते, मैं काम ढूंढ रही हूं"}'`

4. **Dashboard.**
   ```
   cd apps/web
   pnpm install
   pnpm dev
   ```
   Open http://localhost:3000

## What ships in MVP (from PRD § 10)

FR-01 through FR-10, three pilot districts (Nalanda, Bhagalpur, Jhabua),
four languages (Hindi, Bengali, Tamil, Marathi), demo cohort of ~30,
officer dashboard for one district. Kiosk PWA, DTMF fallback, session
resumption and weekly ingest are V1.1 (scaffolded, not wired here).

## Data honesty

No row in `qualifications`, `training_centres` or `demand_signals` is
written without a `source_url` and `evidence_date`. Rows with
`evidence_date` older than 180 days drop out of scoring automatically.
The seed corpus in `db/seed/` follows the same rule.

## Language & privacy

Phone numbers stored only as SHA-256 hash. Voice audio retained 30 days,
then anonymised. Beneficiary can trigger right-to-erase from the voice
line ("delete my record"). Data residency: Supabase Mumbai region.
