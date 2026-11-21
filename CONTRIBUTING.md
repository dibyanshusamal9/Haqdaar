# Contributing

Read the [setup guide](docs/development/setup.md), [repository map](docs/development/repository.md)
and [development workflow](docs/development/README.md).

Keep changes focused on the owning feature/application. Preserve ongoing uncommitted work.
Use descriptive branch/commit names and explain the user-visible problem and resulting behavior.
Keep dependency upgrades separate from structural refactors where possible.

Before review, run affected type checks/builds and behavior tests, check documentation links,
and inspect the diff. Explain any skipped database/browser checks. Include desktop/mobile
evidence for UI changes and regression cases for eligibility-rule changes. Never claim a
performance target is satisfied without measurements and the test conditions.

Keep package-manager lockfiles with their manifests. Add migrations rather than rewriting
applied SQL. Never commit secrets, raw recordings, database dumps, dependency directories or
temporary screenshots. Keep original media outside browser-served directories.
