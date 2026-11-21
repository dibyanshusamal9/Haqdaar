# Development workflow

Start with [setup](setup.md) and the [repository map](repository.md).

1. Inspect the working tree and preserve existing uncommitted work.
2. Identify the owning application and feature. Keep cross-app communication through REST.
3. Add or adjust tests for changed behavior, especially eligibility, normalisation and persistence.
4. Run the relevant type checks/build and tests. Review the diff for generated files and secrets.
5. Update the API documentation, requirements mapping or operations guide when behavior changes.

## Commands

- API: `npm run typecheck`, `npm run build`, `npm test -- --runInBand` from `apps/api`.
- API development: `npm run dev` builds once then watches compiled output. For continuous
  TypeScript compilation, run `npx tsc -p tsconfig.build.json --watch` in a second terminal.
- Citizen: `npx tsc --noEmit`, `npm run lint`, `npm run build` from `apps/caller-site`.
- Citizen animation: with port 3001 running, `node --test tests/scroll-sequence.test.mjs`.
- Console: `pnpm exec tsc --noEmit`, `pnpm build` from `apps/web`.
- Documentation: `node scripts/quality/check-doc-links.mjs` from the repository root.

Builds of the Next.js apps may need network access for configured Google Fonts. A production
build failure due to font downloading is distinct from a TypeScript or application failure.

Do not edit previously applied SQL migrations; add a new numbered migration and a database
test. Matching code must not invoke a model. Treat extracted values as untrusted until
validated and reviewed by the citizen. Translation changes belong to `src/i18n`.

Regenerate media with `apps/caller-site/scripts/import-scroll-frames.ps1`; see the
[source-media guide](../../assets/source/README.md). Do not place original archives in `public`.
