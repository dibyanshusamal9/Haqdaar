import { config } from '../src/config';
import { Database } from '../src/db/database';
import { ProfileSchema } from '../src/domain/profile';
import { Predicate, predicateLabel } from '../src/domain/rules';
import { MatchService } from '../src/match/match.service';

/**
 * Exercises the real SQL engine (haqdaar_eval / haqdaar_match) in a throwaway schema.
 * Skipped when no database is reachable.
 */

const schema = `haqdaar_test_${process.pid}`;
let db: Database;
let admin: Database;
let matcher: MatchService;
let available = true;

const p = (x: Omit<Predicate, 'label' | 'id' | 'src'> & { src?: Predicate['src'] }): Predicate => {
  const base = { id: x.field, src: 'myscheme-facet' as const, ...x };
  return { ...base, label: predicateLabel(base) };
};

const SCHEMES: { slug: string; level: 'central' | 'state'; rules: Predicate[]; close?: string }[] = [
  { slug: 'open-to-all', level: 'central', rules: [] },
  { slug: 'women-only', level: 'central', rules: [p({ field: 'gender', op: 'in', value: ['female'] })] },
  { slug: 'bihar-only', level: 'state', rules: [p({ field: 'state', op: 'in', value: ['Bihar'] })] },
  { slug: 'st-farmers', level: 'central', rules: [p({ field: 'caste', op: 'in', value: ['st'] }), p({ field: 'occupation', op: 'in', value: ['farmer'] })] },
  { slug: 'age-band', level: 'central', rules: [p({ field: 'age', op: 'between', value: [18, 40], strict: [18, 35] })] },
  { slug: 'income-cap', level: 'central', rules: [p({ field: 'annual_income', op: 'lte', value: 250000, src: 'eligibility-text' })] },
  { slug: 'soft-age', level: 'central', rules: [p({ field: 'age', op: 'between', value: [60, 120], strength: 'soft', src: 'eligibility-text' })] },
  { slug: 'students', level: 'central', rules: [p({ field: 'student', op: 'eq', value: true })] },
];

beforeAll(async () => {
  if (!config.databaseUrl) {
    available = false;
    return;
  }
  admin = new Database(config.databaseUrl);
  try {
    await admin.query(`create schema ${schema}`);
  } catch {
    available = false;
    await admin.close().catch(() => {});
    return;
  }
  db = new Database(config.databaseUrl, { searchPath: `${schema},public` });
  await db.migrate();
  const run = await db.one<{ id: number }>("insert into ingest_runs (mode, status, corpus_version) values ('ingest', 'succeeded', 1) returning id");
  for (const s of SCHEMES) {
    await db.query(
      `insert into schemes (source_url, slug, name, level, content_hash, corpus_version, rules, close_date)
       values ($1, $2, $3, $4, 'x', $5, $6, $7)`,
      [`https://example.test/${s.slug}`, s.slug, s.slug, s.level, run!.id, JSON.stringify({ version: 1, all: s.rules }), s.close ?? null],
    );
  }
  matcher = new MatchService(db);
}, 30_000);

afterAll(async () => {
  if (!available) return;
  await db.close();
  await admin.query(`drop schema ${schema} cascade`);
  await admin.close();
});

const profile = (over: Record<string, unknown>) =>
  ProfileSchema.parse({ age: 30, gender: 'male', state: 'Kerala', residence: 'urban', caste: 'general', ...over });

const slugs = async (over: Record<string, unknown>) =>
  Object.fromEntries((await matcher.run(profile(over))).map((r) => [r.slug, r.status]));

const maybe = (name: string, fn: () => Promise<void>) => it(name, async () => (available ? fn() : undefined));

describe('haqdaar_match (SQL)', () => {
  // Makes a silent skip visible: with a database configured these tests must really run.
  it('reaches the configured database', () => {
    if (config.databaseUrl) expect(available).toBe(true);
  });

  maybe('excludes on a failed hard predicate and includes open schemes', async () => {
    const r = await slugs({});
    expect(r['open-to-all']).toBe('eligible');
    expect(r['women-only']).toBeUndefined();
    expect(r['bihar-only']).toBeUndefined();
    expect((await slugs({ gender: 'female', state: 'Bihar' }))['women-only']).toBe('eligible');
    expect((await slugs({ state: 'Bihar' }))['bihar-only']).toBe('eligible');
  });

  maybe('lets a PVTG dairy farmer satisfy ST + farmer rules', async () => {
    expect((await slugs({ caste: 'pvtg', occupation: 'dairy_farmer' }))['st-farmers']).toBe('eligible');
    expect((await slugs({ caste: 'sc', occupation: 'farmer' }))['st-farmers']).toBeUndefined();
  });

  maybe('turns the uncertain part of an age band into "likely"', async () => {
    expect((await slugs({ age: 30 }))['age-band']).toBe('eligible');
    expect((await slugs({ age: 38 }))['age-band']).toBe('likely');
    expect((await slugs({ age: 45 }))['age-band']).toBeUndefined();
  });

  maybe('treats a missing income as undecided, not as a fail', async () => {
    expect((await slugs({}))['income-cap']).toBe('likely');
    expect((await slugs({ annual_income: 200000 }))['income-cap']).toBe('eligible');
    expect((await slugs({ annual_income: 300000 }))['income-cap']).toBeUndefined();
  });

  maybe('never excludes on a soft (text-derived) predicate', async () => {
    expect((await slugs({ age: 30 }))['soft-age']).toBe('likely');
    expect((await slugs({ age: 65 }))['soft-age']).toBe('eligible');
  });

  maybe('returns satisfied rules as reasons and ranks targeted schemes first', async () => {
    const res = await matcher.run(profile({ student: true, gender: 'female', annual_income: 100000 }));
    const students = res.find((r) => r.slug === 'students')!;
    expect(students.reasons).toEqual([{ condition: 'Students', why: 'You are a student' }]);
    const order = res.map((r) => r.slug);
    expect(order.indexOf('students')).toBeLessThan(order.indexOf('open-to-all'));
    // an undecided text-only condition the citizen probably fails sinks below open schemes
    expect(order[order.length - 1]).toBe('soft-age');
  });

  maybe('is deterministic (NFR-01)', async () => {
    const a = await matcher.run(profile({ gender: 'female', age: 38 }));
    const b = await matcher.run(profile({ gender: 'female', age: 38 }));
    expect(b).toEqual(a);
  });

  maybe('logs every match and can replay it identically (FR-11)', async () => {
    const out = await matcher.match({ age: 25, gender: 'female', state: 'Bihar', residence: 'rural', caste: 'st' }, 'form');
    const replay = await matcher.replay(out.matchId);
    expect(replay.identical).toBe(true);
    expect(replay.sameCorpus).toBe(true);
  });

  maybe('rejects a profile with missing required fields, naming them', async () => {
    await expect(matcher.match({ age: 25 }, 'form')).rejects.toMatchObject({
      response: { missing: ['gender', 'state', 'residence', 'caste'] },
    });
  });
});
