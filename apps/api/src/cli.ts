import { config } from './config';
import { Database } from './db/database';
import { ingest } from './ingest/ingest';
import { MySchemeClient } from './ingest/myscheme.client';
import { ALL_STAGES, MySchemeScraper, Stage } from './ingest/scraper';

/**
 * Batch commands for the Admin / Curator (UC-06):
 *   node dist/cli.js migrate
 *   node dist/cli.js scrape  [--stages listing,facets,ranges,details] [--limit N] [--refresh]
 *   node dist/cli.js ingest                      normalise the cache into the database
 *   node dist/cli.js refresh [--run-id N]        scrape + ingest (admin button, weekly job)
 */

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : undefined;
}
const flag = (name: string) => process.argv.includes(`--${name}`);
const log = (msg: string) => console.log(`[${new Date().toISOString().slice(11, 19)}] ${msg}`);

async function withDb<T>(fn: (db: Database) => Promise<T>): Promise<T> {
  const db = new Database(config.databaseUrl);
  try {
    return await fn(db);
  } finally {
    await db.close();
  }
}

async function runScrape(stages: Stage[]) {
  const bad = stages.filter((s) => !ALL_STAGES.includes(s));
  if (bad.length) throw new Error(`Unknown stage(s): ${bad.join(', ')}`);
  const client = new MySchemeClient({ ...config.myscheme, log });
  const scraper = new MySchemeScraper(client, {
    cacheDir: config.myscheme.cacheDir,
    stages,
    concurrency: config.myscheme.concurrency,
    refresh: flag('refresh'),
    maxAgeDays: Number(arg('max-age-days') ?? process.env.MYSCHEME_MAX_AGE_DAYS ?? 6),
    limit: arg('limit') ? Number(arg('limit')) : undefined,
    log,
  });
  log(`scrape: stages ${stages.join(', ')} -> ${config.myscheme.cacheDir}`);
  const report = await scraper.run();
  log(
    `scrape: done. ${report.requests} requests, ${report.listed} listed, ${report.detailsFetched} details fetched, ` +
      `${report.detailsCached} cached, ${report.failures.length} failures`,
  );
  return report;
}

const commands: Record<string, () => Promise<unknown>> = {
  migrate: () => withDb((db) => db.migrate(log)),

  scrape: () => runScrape((arg('stages')?.split(',').map((s) => s.trim()) ?? ALL_STAGES) as Stage[]),

  ingest: () =>
    withDb(async (db) => {
      await db.migrate(log);
      return ingest(db, config.myscheme.cacheDir, {
        mode: 'ingest',
        triggeredBy: arg('triggered-by') ?? 'cli',
        runId: Number(arg('run-id')) || undefined,
        log,
      });
    }),

  refresh: () =>
    withDb(async (db) => {
      await db.migrate(log);
      const runId =
        Number(arg('run-id')) ||
        (await db.one<{ id: number }>("insert into ingest_runs (mode, triggered_by) values ('scrape+ingest', $1) returning id", [
          arg('triggered-by') ?? 'cli',
        ]))!.id;
      try {
        await runScrape(ALL_STAGES);
      } catch (err) {
        await db.query("update ingest_runs set status='failed', finished_at=now(), error=$2 where id=$1", [
          runId,
          `scrape failed: ${(err as Error).message}`.slice(0, 2000),
        ]);
        throw err;
      }
      return ingest(db, config.myscheme.cacheDir, { mode: 'scrape+ingest', triggeredBy: 'cli', runId, log });
    }),
};

async function main() {
  const cmd = process.argv[2];
  const run = commands[cmd];
  if (!run) {
    console.error(`usage: node dist/cli.js <${Object.keys(commands).join('|')}> [options]`);
    process.exit(2);
  }
  await run();
}

main().catch((err) => {
  console.error(err instanceof Error ? err.stack : err);
  process.exit(1);
});
