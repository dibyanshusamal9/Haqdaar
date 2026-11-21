import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Database } from '../db/database';
import { InjectDb } from '../db/database.module';
import { normaliseProfileInput, Profile, ProfileSchema, REQUIRED_FIELDS, toMatchDocument } from '../domain/profile';
import { Predicate, reasonFor, verifyFor } from '../domain/rules';
import { rank } from './ranking';

export type InputMode = 'form' | 'voice' | 'text';

export interface MatchResult {
  slug: string;
  name: string;
  shortTitle: string | null;
  level: 'central' | 'state';
  states: string[];
  categories: string[];
  brief: string | null;
  benefitType: string | null;
  closeDate: string | null;
  closed: boolean;
  sourceUrl: string;
  status: 'eligible' | 'likely';
  score: number;
  /** the satisfied conditions, phrased from the citizen's profile (FR-06) */
  reasons: { condition: string; why: string }[];
  /** conditions the citizen should confirm */
  verify: string[];
  /** how many structured conditions this scheme has */
  conditionsChecked: number;
}

@Injectable()
export class MatchService {
  constructor(@InjectDb() private readonly db: Database) {}

  /** UC-04 step 2: normalise, and reject naming any missing or unreadable field. */
  validateProfile(input: unknown): Profile {
    if (!input || typeof input !== 'object') throw new BadRequestException('Body must contain a "profile" object');
    const { values, invalid } = normaliseProfileInput(input as Record<string, unknown>);
    const missing = REQUIRED_FIELDS.filter((f) => values[f] === undefined);
    if (missing.length || invalid.length) {
      throw new BadRequestException({
        message: missing.length ? `Missing required field(s): ${missing.join(', ')}` : `Unreadable field(s): ${invalid.join(', ')}`,
        missing,
        invalid,
      });
    }
    return ProfileSchema.parse(values);
  }

  async run(profile: Profile, today = new Date().toISOString().slice(0, 10)) {
    const rows = await this.db.query<{
      status: 'eligible' | 'likely';
      passed: Predicate[];
      verify: Predicate[];
      slug: string;
      name: string;
      shortTitle: string | null;
      level: 'central' | 'state';
      states: string[];
      categories: string[];
      brief: string | null;
      benefitType: string | null;
      closeDate: string | null;
      sourceUrl: string;
      total: number;
    }>(
      `select m.status, m.passed, m.verify, s.slug, s.name, s.short_title as "shortTitle", s.level, s.states,
              s.categories, s.brief, s.benefit_type as "benefitType", to_char(s.close_date, 'YYYY-MM-DD') as "closeDate",
              s.source_url as "sourceUrl", jsonb_array_length(s.rules->'all') as total
       from haqdaar_match($1::jsonb) m join schemes s on s.id = m.scheme_id`,
      [JSON.stringify(toMatchDocument(profile))],
    );
    const ranked = rank(rows, profile, today);
    return ranked.map<MatchResult>((r) => ({
      slug: r.slug,
      name: r.name,
      shortTitle: r.shortTitle,
      level: r.level,
      states: r.states,
      categories: r.categories,
      brief: r.brief && r.brief.length > 280 ? `${r.brief.slice(0, 277)}…` : r.brief,
      benefitType: r.benefitType,
      closeDate: r.closeDate,
      closed: r.closed,
      sourceUrl: r.sourceUrl,
      status: r.status,
      score: r.score,
      reasons: r.passed.map((p) => ({ condition: p.label, why: reasonFor(p, profile) })),
      verify: r.verify.map((p) => verifyFor(p, profile)),
      conditionsChecked: Number(r.total),
    }));
  }

  /** UC-04 end to end: validate, match, rank, log (FR-11), respond. */
  async match(input: unknown, mode: InputMode) {
    const started = performance.now();
    const profile = this.validateProfile(input);
    const corpusVersion = (await this.db.one<{ v: number }>('select haqdaar_corpus_version() as v'))!.v;
    const results = await this.run(profile);
    const durationMs = Math.round(performance.now() - started);
    const eligible = results.filter((r) => r.status === 'eligible').length;
    const likely = results.length - eligible;
    const log = await this.db.one<{ id: string }>(
      `insert into match_logs (corpus_version, input_mode, profile, eligible_count, likely_count, result, duration_ms)
       values ($1, $2, $3, $4, $5, $6, $7) returning id`,
      [corpusVersion, mode, JSON.stringify(profile), eligible, likely,
       JSON.stringify(results.map((r) => [r.slug, r.status, r.score])), durationMs],
    );
    return {
      matchId: log!.id,
      corpusVersion,
      durationMs,
      profile,
      counts: {
        total: results.length,
        eligible,
        likely,
        central: results.filter((r) => r.level === 'central').length,
        state: results.filter((r) => r.level === 'state').length,
        open: results.filter((r) => !r.closed).length,
      },
      categories: countBy(results.flatMap((r) => r.categories)),
      results,
    };
  }

  /** NFR-01 check: re-run a logged match and compare it with what was returned then. */
  async replay(id: string) {
    const log = await this.db.one<{ profile: Profile; result: [string, string, number][]; corpus_version: number; created_at: Date }>(
      'select profile, result, corpus_version, created_at from match_logs where id = $1',
      [id],
    );
    if (!log) throw new NotFoundException(`No match log ${id}`);
    const currentVersion = (await this.db.one<{ v: number }>('select haqdaar_corpus_version() as v'))!.v;
    const now = await this.run(ProfileSchema.parse(log.profile), log.created_at.toISOString().slice(0, 10));
    const before = log.result.map(([slug, status]) => `${slug}:${status}`);
    const after = now.map((r) => `${r.slug}:${r.status}`);
    const identical = before.length === after.length && before.every((x, i) => x === after[i]);
    const beforeSet = new Set(before);
    const afterSet = new Set(after);
    return {
      id,
      loggedCorpusVersion: log.corpus_version,
      currentCorpusVersion: currentVersion,
      sameCorpus: log.corpus_version === currentVersion,
      identical,
      loggedCount: before.length,
      replayCount: after.length,
      added: after.filter((x) => !beforeSet.has(x)).slice(0, 50),
      removed: before.filter((x) => !afterSet.has(x)).slice(0, 50),
    };
  }
}

function countBy(values: string[]) {
  const m = new Map<string, number>();
  for (const v of values) m.set(v, (m.get(v) ?? 0) + 1);
  return [...m.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count || (a.name < b.name ? -1 : 1));
}
