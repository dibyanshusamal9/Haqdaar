# Architecture decisions

## 001: Retain three independently runnable applications

The API owns ingestion, matching and persistence; the citizen app owns public interaction;
the console owns curator workflows. Keeping existing app paths preserves CLI/config path
resolution, CI working directories and deployment boundaries. Package managers remain local
to each app; a unified workspace is a future change requiring coordinated lockfile migration.

## 002: Separate extraction from eligibility

Sarvam transcribes and Groq extracts fields; validated results populate an editable form.
PostgreSQL evaluates versioned JSONB predicates. Missing/uncertain values remain explainable
instead of being guessed by a language model. This supports FR-03, FR-05 and FR-06.

## 003: Organize UI by feature and keep shared components reusable

Home animation and eligibility-check components have their own feature directories. Shared
layout/navigation and API access remain reusable. Next.js route entry points compose these
pieces; moving routes outside framework conventions would add unnecessary configuration.

## 004: Separate original media, generated deliverables and runtime data

Original animation ZIPs live in `assets/source`, encoded browser assets in the citizen
`public` directory, and source corpus cache/logs under `data`. Runtime-generated directories
are ignored. The 1080p lossless frames preserve source pixels; the player limits decoded
frames and requests nearby frames to control startup and memory cost. A complete traversal
can still transfer about 158 MiB; compressed video or lower-bandwidth variants are future work.

## 005: Keep report requirements traceable without claiming unmeasured compliance

The report is a reference baseline. The requirements guide identifies concrete implementation
locations and verification gaps. Performance, HTTPS deployment and real-user accessibility
must be validated in the target environment rather than inferred from code organization.
