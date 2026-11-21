# Haqdaar.ai curator console

Next.js 14 (pnpm). For the Admin / Curator in the report's use cases:

- **Overview**: corpus size, rule coverage, review status, how citizens give their details
- **Review queue**: schemes the normaliser flagged (FR-08); approve, flag, or rewrite their rules
- **Scrape runs**: start a myscheme.gov.in scrape + ingest or a re-ingest (UC-06); run history
- **Match log**: every match with its corpus version; *Replay* checks reproducibility (NFR-01)

Sign in with `ADMIN_ACCESS_CODE` from the API's `.env`. The code is kept in an httpOnly cookie
and every API call happens server-side.

    pnpm install
    pnpm dev            # http://localhost:3000

`.env.local`: `HAQDAAR_API_URL=http://localhost:4000`,
`NEXT_PUBLIC_CITIZEN_SITE_URL=http://localhost:3001`.
