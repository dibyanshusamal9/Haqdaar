import { ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { spawn } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { z } from 'zod';
import { config } from '../config';
import { Database } from '../db/database';
import { InjectDb } from '../db/database.module';
import { PROFILE_FIELDS } from '../domain/profile';
import { Predicate, predicateLabel, RuleSet } from '../domain/rules';
import { MatchService } from '../match/match.service';
import { SchemesService } from '../schemes/schemes.service';

const num = z.number().finite();
export const PredicateInput = z
  .object({
    id: z.string().max(40).optional(),
    field: z.enum(PROFILE_FIELDS as [string, ...string[]]),
    op: z.enum(['in', 'eq', 'gte', 'lte', 'between']),
    value: z.union([z.array(z.string().min(1)).min(1), z.boolean(), num, z.tuple([num, num])]),
    strict: z.union([num, z.tuple([num, num])]).optional(),
    strength: z.enum(['hard', 'soft']).optional(),
    src: z.enum(['myscheme-facet', 'eligibility-text', 'curator']).optional(),
  })
  .refine(
    (p) =>
      (p.op === 'in' && Array.isArray(p.value) && typeof p.value[0] === 'string') ||
      (p.op === 'eq' && typeof p.value === 'boolean') ||
      ((p.op === 'gte' || p.op === 'lte') && typeof p.value === 'number') ||
      (p.op === 'between' && Array.isArray(p.value) && typeof p.value[0] === 'number' && p.value[0] <= (p.value[1] as number)),
    { message: 'value does not fit the operator (in: list of values, eq: true/false, gte/lte: number, between: [lo, hi])' },
  );

export const SchemeEdit = z.object({
  rules: z.array(PredicateInput).max(30).optional(),
  reviewStatus: z.enum(['approved', 'edited', 'flagged']),
  note: z.string().max(1000).optional(),
});

const STALE_RUN_MS = 4 * 60 * 60 * 1000;

@Injectable()
export class AdminService {
  private readonly logger = new Logger('Admin');

  constructor(
    @InjectDb() private readonly db: Database,
    private readonly schemes: SchemesService,
    private readonly matcher: MatchService,
  ) {}

  async overview() {
    const [stats, review, matches, runs] = await Promise.all([
      this.schemes.stats(),
      this.db.query(`select review_status as status, count(*)::int as count from schemes where withdrawn_at is null group by 1 order by 1`),
      this.db.one(
        `select count(*)::int as total,
                count(*) filter (where created_at > now() - interval '7 days')::int as "last7Days",
                coalesce(round(avg(duration_ms)), 0)::int as "avgDurationMs",
                coalesce(round(avg(eligible_count + likely_count)), 0)::int as "avgResults",
                count(*) filter (where input_mode = 'voice')::int as voice,
                count(*) filter (where input_mode = 'text')::int as text,
                count(*) filter (where input_mode = 'form')::int as form
         from match_logs`,
      ),
      this.runs(8),
    ]);
    return { stats, review, matches, runs };
  }

  runs(limit = 50) {
    return this.db.query(
      `select id, mode, status, triggered_by as "triggeredBy", started_at as "startedAt", finished_at as "finishedAt",
              corpus_version as "corpusVersion", listed, added, updated, unchanged, withdrawn, failed, flagged, error,
              report->'scrape'->'requests' as requests
       from ingest_runs order by id desc limit $1`,
      [limit],
    );
  }

  /** UC-06 trigger: starts the batch job in its own process and returns its run id. */
  async startRun(mode: 'refresh' | 'ingest') {
    const running = await this.db.one<{ id: number; started_at: Date }>(
      "select id, started_at from ingest_runs where status = 'running' order by id desc limit 1",
    );
    if (running) {
      if (Date.now() - running.started_at.getTime() < STALE_RUN_MS) {
        throw new ConflictException(`Run ${running.id} is still in progress`);
      }
      await this.db.query("update ingest_runs set status='failed', finished_at=now(), error='abandoned (stale)' where id=$1", [running.id]);
    }
    const run = await this.db.one<{ id: number }>(
      "insert into ingest_runs (mode, triggered_by) values ($1, 'admin') returning id",
      [mode === 'refresh' ? 'scrape+ingest' : 'ingest'],
    );
    const cli = path.join(__dirname, '..', 'cli.js');
    const logDir = path.join(path.dirname(config.myscheme.cacheDir), 'logs');
    fs.mkdirSync(logDir, { recursive: true });
    const out = fs.openSync(path.join(logDir, `run-${run!.id}.log`), 'a');
    const child = spawn(process.execPath, [cli, mode, '--run-id', String(run!.id), '--triggered-by', 'admin'], {
      detached: true,
      stdio: ['ignore', out, out],
      windowsHide: true,
    });
    child.on('error', (err) => this.logger.error(`run ${run!.id} failed to start: ${err.message}`));
    child.unref();
    this.logger.log(`started ${mode} run ${run!.id} (pid ${child.pid})`);
    return { runId: run!.id, mode };
  }

  async reviewQueue(status: string, page: number, q?: string) {
    const size = 20;
    const rows = await this.db.query(
      `select slug, name, level, states, review_status as "reviewStatus", review_reasons as "reviewReasons",
              rules, eligibility_md as "eligibilityMd", curator_note as "curatorNote", source_url as "sourceUrl",
              updated_at as "updatedAt", count(*) over() as total
       from schemes
       where withdrawn_at is null and ($1 = 'all' or review_status = $1)
         and ($2::text is null or search_doc @@ websearch_to_tsquery('english', $2))
       order by array_length(review_reasons, 1) desc nulls last, name, slug
       limit $3 offset $4`,
      [status, q?.trim() || null, size, (page - 1) * size],
    );
    return { total: rows.length ? Number(rows[0].total) : 0, page, size, items: rows.map(({ total: _t, ...r }) => r) };
  }

  /** Curator correction (UC-06 4a): new rules and/or a review decision, audited. */
  async editScheme(slug: string, edit: z.infer<typeof SchemeEdit>) {
    return this.db.tx(async (c) => {
      const prev = (await c.query('select id, rules, review_status from schemes where slug = $1 for update', [slug])).rows[0];
      if (!prev) throw new NotFoundException(`No scheme with slug "${slug}"`);
      let rules: RuleSet = prev.rules;
      let corpusVersion: number | null = null;
      if (edit.rules) {
        rules = {
          version: 1,
          all: edit.rules.map((p, i) => {
            const base = { ...p, id: p.id ?? `${p.field}-${i}`, src: p.src ?? 'curator' } as Omit<Predicate, 'label'>;
            return { ...base, label: predicateLabel(base) };
          }),
        };
        if (JSON.stringify(rules) !== JSON.stringify(prev.rules)) {
          // A rule change is a new corpus version, so match logs stay reproducible (NFR-01).
          const run = (await c.query(
            "insert into ingest_runs (mode, triggered_by, status, finished_at) values ('curator', 'admin', 'succeeded', now()) returning id",
          )).rows[0];
          corpusVersion = run.id;
          await c.query('update ingest_runs set corpus_version = $1, updated = 1 where id = $1', [run.id]);
        }
      }
      const status = corpusVersion !== null ? 'edited' : edit.reviewStatus;
      await c.query(
        `update schemes set rules = $2, review_status = $3, curator_note = coalesce($4, curator_note),
           corpus_version = coalesce($5, corpus_version), updated_at = now(),
           review_reasons = case when $3 = 'flagged' then review_reasons else '{}' end
         where id = $1`,
        [prev.id, JSON.stringify(rules), status, edit.note ?? null, corpusVersion],
      );
      await c.query(
        'insert into curator_edits (scheme_id, review_status, old_rules, new_rules, note) values ($1, $2, $3, $4, $5)',
        [prev.id, status, JSON.stringify(prev.rules), JSON.stringify(rules), edit.note ?? null],
      );
      return { slug, reviewStatus: status, rules, corpusVersion };
    });
  }

  async matches(page: number) {
    const size = 25;
    const rows = await this.db.query(
      `select id, created_at as "createdAt", corpus_version as "corpusVersion", input_mode as "inputMode",
              eligible_count as eligible, likely_count as likely, duration_ms as "durationMs",
              profile->>'state' as state, profile->>'age' as age, profile->>'gender' as gender,
              count(*) over() as total
       from match_logs order by created_at desc limit $1 offset $2`,
      [size, (page - 1) * size],
    );
    return { total: rows.length ? Number(rows[0].total) : 0, page, size, items: rows.map(({ total: _t, ...r }) => r) };
  }

  replay(id: string) {
    return this.matcher.replay(id);
  }
}
