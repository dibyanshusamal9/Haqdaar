# Livelihood Setu — Officer Web

Next.js 14 (App Router) + Tailwind. Implements the officer dashboard
(FR-09) and explainability drill-down (FR-10 UI).

## Pages

    /                                 landing — pick district
    /districts/[id]                   demand-vs-supply, funnel, gap tiles
    /leads                            mobiliser queue (stalled enrollments)
    /recommendations/[id]             explainability trail

Data comes from the voice API's `/admin/*` endpoints (server-side fetch)
so RLS is enforced service-side.

## Run

    pnpm install
    cp .env.example .env.local
    pnpm dev
