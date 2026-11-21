# Repository map

The Git repository is the `Haqdaar.ai/` folder itself. `.agent/` and `.claude/` hold local
assistant configuration and are not committed.

```text
Haqdaar.ai/
  apps/
    api/                 NestJS service and ingestion CLI
      src/               modules, domain types, database adapter, entry points
      db/migrations/     ordered SQL schema and matcher changes
      tests/             unit and SQL integration tests
    caller-site/         citizen Next.js application
      src/app/           routes and root layout
      src/features/      home and eligibility-check components
      src/components/    reusable UI and layout components
      src/api/           typed API client
      src/i18n/          translations and language state
      src/styles/        application CSS
      public/            browser-served images, CSS and animation frames
      scripts/           media processing tools
      tests/             browser regression tests
    web/                 curator Next.js application
      app/               routes, layouts and server actions
      components/        console UI
      lib/               server API, session and formatting helpers
  assets/source/         original media, outside the public web roots
  data/                  local source corpus cache and operational logs
  docs/                  life-cycle documentation:
    requirements/        requirements traceability
    design/              architecture, design decisions, API contract
    development/         setup, repository map, workflow
    testing/             test strategy and verification
    operations/          running, refresh, phone line, troubleshooting
    reports/             academic reports
    presentations/       pitch deck
  scripts/dev/           Windows launch/stop implementations
  scripts/quality/       repository documentation checks
  .github/workflows/     scheduled ingestion
  docker-compose.yml     local PostgreSQL entry point
  run.bat, stop.bat      one-click launchers (call scripts/dev)
  .env.example           API configuration template
```

## Placement rules

Application code belongs to its application, and feature-specific UI belongs to its feature.
Shared UI must not import a feature. Routes compose features and shared components.
Keep API controllers focused on transport and validation, services on orchestration,
domain modules on pure rules/types, and SQL/migrations under the API that owns the database.
There is currently no generic repository layer: services use the `Database` adapter.
Introduce a repository abstraction only when a concrete persistence boundary needs one.

Keep migrations, tests, configuration, package manifests and lockfiles with their owner.
Do not relocate Next.js route directories or tooling configuration just to reduce root files.
The applications keep independent dependency installations: npm for API/citizen and pnpm for console.
The repository is not a single package-manager workspace.

Original media belongs under `assets/source`; encoded deliverables belong in the citizen
site's `public`. The source ZIP is local and ignored; the WebP frames are deployable assets.
`node_modules`, `.next`, `dist`, `coverage`, `.impeccable`, and `*.tsbuildinfo` are generated,
ignored local state. They stay beside the tools that create them. Do not commit or manually
move those trees while a development server is running.

## Migration notes

The home film moved from `src/components` to `src/features/home`; check components moved
to `src/features/check`; `components/ed` became `components/layout`; app CSS moved to
`src/styles`. API `test` became `tests`, including its compiler/Jest configuration.
Root launchers delegate to `scripts/dev`. In November 2026 the repository moved up from
`Haqdaar.ai/raahi/` to `Haqdaar.ai/`, and the docs were regrouped by life-cycle phase
(`architecture/` and `api/` became `design/`, `quality/` became `testing/`). Application names and runtime routes are stable.
