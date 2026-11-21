# Repository tooling

`dev/` owns the Windows service launch/stop scripts, invoked by root compatibility wrappers.
They resolve the repository root relative to their location. They operate on the configured
development ports; review the setup guide before using them alongside other projects.

`quality/check-doc-links.mjs` validates local Markdown links in tracked-source documentation.
Application-specific tools stay in their app: the API CLI is `apps/api/src/cli.ts`, and media
processing scripts live under `apps/caller-site/scripts`.
