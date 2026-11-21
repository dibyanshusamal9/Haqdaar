import * as fs from 'node:fs';
import * as path from 'node:path';
import { Pool, PoolClient, QueryResultRow } from 'pg';

export const MIGRATIONS_DIR = path.resolve(__dirname, '..', '..', 'db', 'migrations');

export class Database {
  readonly pool: Pool;

  constructor(connectionString: string, opts: { searchPath?: string } = {}) {
    if (!connectionString) {
      throw new Error('No database configured: set HAQDAAR_DATABASE_URL (or DATABASE_URL) in .env');
    }
    this.pool = new Pool({
      connectionString,
      max: 10,
      idleTimeoutMillis: 30_000,
      // Tests run against a throwaway schema.
      options: opts.searchPath ? `-c search_path=${opts.searchPath}` : undefined,
    });
  }

  async query<T extends QueryResultRow = any>(sql: string, params: unknown[] = []): Promise<T[]> {
    const res = await this.pool.query<T>(sql, params);
    return res.rows;
  }

  async one<T extends QueryResultRow = any>(sql: string, params: unknown[] = []): Promise<T | null> {
    return (await this.query<T>(sql, params))[0] ?? null;
  }

  async tx<T>(fn: (c: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('begin');
      const out = await fn(client);
      await client.query('commit');
      return out;
    } catch (err) {
      await client.query('rollback');
      throw err;
    } finally {
      client.release();
    }
  }

  /** Applies db/migrations/*.sql in name order, once each. */
  async migrate(log: (msg: string) => void = () => {}): Promise<string[]> {
    await this.query(
      'create table if not exists schema_migrations (name text primary key, applied_at timestamptz not null default now())',
    );
    const done = new Set((await this.query<{ name: string }>('select name from schema_migrations')).map((r) => r.name));
    const files = fs.readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.sql')).sort();
    const applied: string[] = [];
    for (const file of files) {
      if (done.has(file)) continue;
      const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
      await this.tx(async (c) => {
        await c.query(sql);
        await c.query('insert into schema_migrations (name) values ($1)', [file]);
      });
      applied.push(file);
      log(`migrate: applied ${file}`);
    }
    if (!applied.length) log('migrate: schema up to date');
    return applied;
  }

  async close() {
    await this.pool.end();
  }
}
