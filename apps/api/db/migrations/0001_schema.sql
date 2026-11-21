-- Haqdaar.ai core schema: the scheme corpus scraped from myscheme.gov.in, ingest runs,
-- curator edits and the match audit log. Idempotent: safe to re-run.

-- array_to_string() is only STABLE, so generated columns need an IMMUTABLE wrapper.
create or replace function haqdaar_join(text[]) returns text
language sql immutable parallel safe as $$ select coalesce(array_to_string($1, ' '), '') $$;

create table if not exists schemes (
  id                  bigint generated always as identity primary key,
  source_url          text not null unique,               -- FR-09: idempotent upsert key
  slug                text not null unique,
  myscheme_id         text,
  name                text not null,
  short_title         text,
  level               text not null check (level in ('central', 'state')),
  scheme_type         text,
  scheme_for          text,
  states              text[] not null default '{}',       -- empty = open across India
  ministry            text,
  department          text,
  implementing_agency text,
  categories          text[] not null default '{}',
  sub_categories      text[] not null default '{}',
  tags                text[] not null default '{}',
  brief               text,
  description_md      text,
  benefits_md         text,
  exclusions_md       text,
  eligibility_md      text,
  documents_md        text,
  application_md      text,
  application_modes   text[] not null default '{}',
  apply_url           text,
  references_json     jsonb not null default '[]',
  benefit_type        text,
  is_dbt              boolean,
  open_date           date,
  close_date          date,
  -- Eligibility rules as data (report §1.1): {"version":1,"all":[predicate, ...]}
  rules               jsonb not null default '{"version":1,"all":[]}',
  review_status       text not null default 'auto'
                      check (review_status in ('auto', 'flagged', 'approved', 'edited')),
  review_reasons      text[] not null default '{}',
  curator_note        text,
  content_hash        text not null,
  corpus_version      integer not null,                   -- ingest run that last changed this row
  first_seen_at       timestamptz not null default now(),
  scraped_at          timestamptz,
  updated_at          timestamptz not null default now(),
  withdrawn_at        timestamptz,                        -- no longer listed on myscheme
  search_doc          tsvector generated always as (
                        setweight(to_tsvector('english', coalesce(name, '') || ' ' || coalesce(short_title, '')), 'A') ||
                        setweight(to_tsvector('english', coalesce(brief, '') || ' ' || haqdaar_join(tags)), 'B') ||
                        setweight(to_tsvector('english', coalesce(eligibility_md, '') || ' ' || coalesce(benefits_md, '')), 'C')
                      ) stored
);

create index if not exists schemes_search_idx     on schemes using gin (search_doc);
create index if not exists schemes_states_idx     on schemes using gin (states);
create index if not exists schemes_categories_idx on schemes using gin (categories);
create index if not exists schemes_level_idx      on schemes (level);
create index if not exists schemes_review_idx     on schemes (review_status);

-- One row per change to the corpus: a scrape and/or ingest (UC-06 step 6: "schemes
-- added, updated, failed"), or a curator's rule edit. Each changing run is a new corpus version.
create table if not exists ingest_runs (
  id              bigint generated always as identity primary key,
  mode            text not null check (mode in ('scrape+ingest', 'ingest', 'curator')),
  status          text not null default 'running' check (status in ('running', 'succeeded', 'failed')),
  triggered_by    text not null default 'cli',
  started_at      timestamptz not null default now(),
  finished_at     timestamptz,
  corpus_version  integer,
  listed          integer not null default 0,
  added           integer not null default 0,
  updated         integer not null default 0,
  unchanged       integer not null default 0,
  withdrawn       integer not null default 0,
  failed          integer not null default 0,
  flagged         integer not null default 0,
  report          jsonb not null default '{}',
  error           text
);

-- Every curator change to a scheme's rules, so a corrected rule is never silently lost
-- on the next scrape (re-ingest keeps curator-edited rules).
create table if not exists curator_edits (
  id            bigint generated always as identity primary key,
  scheme_id     bigint not null references schemes (id) on delete cascade,
  edited_at     timestamptz not null default now(),
  review_status text not null,
  old_rules     jsonb,
  new_rules     jsonb,
  note          text
);

-- FR-11: every match request and its result, for audit and reproducibility.
-- Stores only the profile fields used for matching (NFR-05), never a transcript.
create table if not exists match_logs (
  id              uuid primary key default gen_random_uuid(),
  created_at      timestamptz not null default now(),
  corpus_version  integer not null,
  input_mode      text not null check (input_mode in ('form', 'voice', 'text')),
  profile         jsonb not null,
  eligible_count  integer not null,
  likely_count    integer not null,
  result          jsonb not null,           -- [[slug, status, score], ...] in rank order
  duration_ms     integer not null
);
create index if not exists match_logs_created_idx on match_logs (created_at desc);
