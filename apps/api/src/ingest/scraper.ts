import * as fs from 'node:fs';
import * as path from 'node:path';
import { Facet, MySchemeClient, SearchFilter, SearchHit } from './myscheme.client';
import { chooseProbes, ProbeSet, RangeProbeData, SideData } from './range-probe';

/**
 * Batch scraper for myscheme.gov.in (UC-06, FR-07). Writes a raw on-disk cache; the
 * ingest step (normaliser + repository) turns that cache into database rows. Splitting
 * the two means re-normalising never re-hits the source site.
 *
 *   listing.json            every scheme card (slug, name, level, states, categories...)
 *   facets.json             structured eligibility memberships: facet -> value -> slugs
 *   range-age.json          probe data for per-scheme age bounds
 *   range-disability.json   probe data for minimum disability percentage
 *   details/<slug>.json     full scheme page (benefits, eligibility, process, references)
 *   documents/<slug>.json   documents required
 *   scrape-report.json      what this run did
 */

/** Facets whose specific values become eligibility rules. "All"/"Both" mean unrestricted. */
export const CATEGORICAL_FACETS = ['gender', 'caste', 'residence', 'maritalStatus', 'employmentStatus', 'occupation'];
export const BOOLEAN_FACETS = ['minority', 'disability', 'isBpl', 'isEconomicDistress', 'isGovEmployee', 'isStudent'];
const UNRESTRICTED = new Set(['All', 'Both', 'No']);

export type Stage = 'listing' | 'facets' | 'ranges' | 'details';
export const ALL_STAGES: Stage[] = ['listing', 'facets', 'ranges', 'details'];

export interface ScrapeOptions {
  cacheDir: string;
  stages: Stage[];
  concurrency: number;
  /** Re-download details that are already cached. */
  refresh: boolean;
  /** Cached scheme pages older than this are fetched again (a refresh picks up edits;
   *  a resumed run skips what it fetched minutes ago). */
  maxAgeDays: number;
  /** Only fetch details for the first N schemes (by slug); for smoke tests. */
  limit?: number;
  log: (msg: string) => void;
}

export interface ScrapeFailure {
  slug: string;
  stage: string;
  error: string;
}

export interface ScrapeReport {
  startedAt: string;
  finishedAt?: string;
  stages: Stage[];
  requests: number;
  listed: number;
  facetQueries: number;
  detailsFetched: number;
  detailsCached: number;
  documentsFetched: number;
  failures: ScrapeFailure[];
}

export class MySchemeScraper {
  private report: ScrapeReport;

  constructor(
    private readonly client: MySchemeClient,
    private readonly opts: ScrapeOptions,
  ) {
    this.report = {
      startedAt: new Date().toISOString(),
      stages: opts.stages,
      requests: 0,
      listed: 0,
      facetQueries: 0,
      detailsFetched: 0,
      detailsCached: 0,
      documentsFetched: 0,
      failures: [],
    };
  }

  private file(name: string) {
    return path.join(this.opts.cacheDir, name);
  }

  async run(): Promise<ScrapeReport> {
    fs.mkdirSync(this.opts.cacheDir, { recursive: true });
    await this.client.init();

    let listing: { total: number; items: SearchHit[]; facets: Facet[] } | null = null;
    if (this.opts.stages.includes('listing')) listing = await this.listing();
    else listing = readJson(this.file('listing.json'));
    if (!listing) throw new Error('No listing.json in the cache; run the listing stage first.');
    this.report.listed = listing.items.length;

    if (this.opts.stages.includes('facets')) await this.facets(listing.facets);
    if (this.opts.stages.includes('ranges')) await this.ranges();
    if (this.opts.stages.includes('details')) await this.details(listing.items);

    this.report.finishedAt = new Date().toISOString();
    this.report.requests = this.client.requests;
    writeJson(this.file('scrape-report.json'), this.report);
    return this.report;
  }

  private async listing() {
    this.opts.log('listing: paging through every scheme');
    const res = await this.client.searchAll([]);
    res.items.sort((a, b) => a.fields.slug.localeCompare(b.fields.slug));
    writeJson(this.file('listing.json'), { fetchedAt: new Date().toISOString(), ...res });
    this.opts.log(`listing: ${res.items.length} of ${res.total} schemes`);
    if (res.items.length < res.total) {
      this.report.failures.push({ slug: '*', stage: 'listing', error: `got ${res.items.length} of ${res.total}` });
    }
    return res;
  }

  private async facets(facets: Facet[]) {
    const out: Record<string, Record<string, string[]>> = {};
    for (const identifier of [...CATEGORICAL_FACETS, ...BOOLEAN_FACETS]) {
      const facet = facets.find((f) => f.identifier === identifier);
      if (!facet) {
        this.opts.log(`facets: ${identifier} missing from the API response; skipped`);
        continue;
      }
      out[identifier] = {};
      const values = (facet.entries ?? []).map((e) => String(e.label)).filter((v) => !UNRESTRICTED.has(v));
      for (const value of values) {
        const res = await this.client.searchAll([{ identifier, value }]);
        this.report.facetQueries++;
        out[identifier][value] = res.items.map((h) => h.fields.slug).sort();
        this.opts.log(`facets: ${identifier}=${value} -> ${res.items.length}`);
      }
    }
    writeJson(this.file('facets.json'), { fetchedAt: new Date().toISOString(), facets: out });
  }

  private async ranges() {
    // Probing every boundary point makes every bound exact. That costs a few thousand
    // page requests for age, which a batch job can afford; approximate limits would
    // otherwise send citizens near an age limit to "please verify".
    const file = (n: string) => this.file(n);
    const age = await this.probeRange('age-general', file('range-age.json'), {
      floor: 0, ceil: 120, domainMax: 100, lowerBudget: Infinity, upperBudget: Infinity, upper: true,
    });
    writeJson(file('range-age.json'), age);
    const disability = await this.probeRange('disabilityPercentage', file('range-disability.json'), {
      floor: 0, ceil: 100, domainMax: 100, lowerBudget: Infinity, upperBudget: 0, upper: false,
    });
    writeJson(file('range-disability.json'), disability);
  }

  private async probeRange(
    identifier: string,
    cacheFile: string,
    o: { floor: number; ceil: number; domainMax: number; lowerBudget: number; upperBudget: number; upper: boolean },
  ): Promise<RangeProbeData> {
    // Counts and probe sets fetched within the last 12 hours (an interrupted or topped-up
    // run) are reused instead of being requested again.
    const previous = readJson<RangeProbeData>(cacheFile);
    const fresh =
      previous?.identifier === identifier &&
      !!previous.fetchedAt &&
      Date.now() - Date.parse(previous.fetchedAt) < 12 * 3600_000;
    const fetchedAt = fresh ? previous!.fetchedAt! : new Date().toISOString();

    const filter = (min: number, max: number): SearchFilter[] => [{ identifier, min, max }];
    const universe = fresh && previous!.universe.length
      ? previous!.universe
      : (await this.client.searchAll(filter(o.floor, o.ceil))).items.map((h) => h.fields.slug).sort();
    this.opts.log(`ranges: ${identifier} universe ${universe.length}${fresh ? ' (reused)' : ''}`);

    const domain = Array.from({ length: o.domainMax - o.floor + 1 }, (_, i) => o.floor + i);
    const fetchSide = async (side: 'lower' | 'upper', budget: number): Promise<SideData> => {
      const old = fresh ? previous![side] : null;
      const counts =
        old && old.counts.length === domain.length
          ? old.counts
          : await (async () => {
              const out: number[] = [];
              for (const v of domain) out.push(await this.client.count(side === 'lower' ? filter(o.floor, v) : filter(v, o.ceil)));
              return out;
            })();
      const picks = chooseProbes({ domain, counts }, side === 'lower' ? 'rise' : 'drop', budget);
      const known = new Map((old?.probes ?? []).map((p) => [p.at, p.slugs]));
      const probes: ProbeSet[] = [];
      for (const at of picks) {
        const cnt = counts[domain.indexOf(at)];
        if (cnt === universe.length) probes.push({ at, slugs: universe });
        else if (known.has(at)) probes.push({ at, slugs: known.get(at)! });
        else {
          const res = await this.client.searchAll(side === 'lower' ? filter(o.floor, at) : filter(at, o.ceil));
          probes.push({ at, slugs: res.items.map((h) => h.fields.slug).sort() });
        }
      }
      this.opts.log(`ranges: ${identifier} ${side} probes at [${picks.join(', ')}]`);
      return { domain, counts, probes };
    };

    const lower = await fetchSide('lower', o.lowerBudget);
    const upper = o.upper ? await fetchSide('upper', o.upperBudget) : { domain: [], counts: [], probes: [] };
    return { fetchedAt, identifier, floor: o.floor, ceil: o.ceil, universe, lower, upper };
  }

  private async details(items: SearchHit[]) {
    fs.mkdirSync(this.file('details'), { recursive: true });
    fs.mkdirSync(this.file('documents'), { recursive: true });
    const slugs = items.map((h) => h.fields.slug).sort();
    const todo = this.opts.limit ? slugs.slice(0, this.opts.limit) : slugs;
    let done = 0;
    const maxAgeMs = this.opts.maxAgeDays * 24 * 3600_000;
    const usable = (p: string) => {
      if (this.opts.refresh) return false;
      try {
        return Date.now() - fs.statSync(p).mtimeMs < maxAgeMs;
      } catch {
        return false;
      }
    };

    const work = async (slug: string) => {
      const detailPath = this.file(path.join('details', `${safe(slug)}.json`));
      const docsPath = this.file(path.join('documents', `${safe(slug)}.json`));
      let detail = usable(detailPath) ? readJson<any>(detailPath) : null;
      try {
        if (detail) this.report.detailsCached++;
        else {
          detail = await this.client.detail(slug);
          writeJson(detailPath, detail);
          this.report.detailsFetched++;
        }
      } catch (err) {
        this.report.failures.push({ slug, stage: 'detail', error: (err as Error).message.slice(0, 300) });
        return;
      }
      if (detail?._id && !usable(docsPath)) {
        try {
          writeJson(docsPath, await this.client.documents(detail._id));
          this.report.documentsFetched++;
        } catch (err) {
          this.report.failures.push({ slug, stage: 'documents', error: (err as Error).message.slice(0, 300) });
        }
      }
    };

    let next = 0;
    const workers = Array.from({ length: Math.max(1, this.opts.concurrency) }, async () => {
      while (next < todo.length) {
        const slug = todo[next++];
        await work(slug);
        done++;
        if (done % 100 === 0 || done === todo.length) {
          this.opts.log(
            `details: ${done}/${todo.length} (fetched ${this.report.detailsFetched}, cached ${this.report.detailsCached}, failed ${this.report.failures.length})`,
          );
          // Checkpoint so a crash mid-run still leaves a report behind.
          writeJson(this.file('scrape-report.json'), { ...this.report, requests: this.client.requests });
        }
      }
    });
    await Promise.all(workers);
  }
}

export function safe(slug: string) {
  return slug.replace(/[^A-Za-z0-9._-]/g, '_');
}

export function readJson<T = any>(file: string): T | null {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8')) as T;
  } catch {
    return null;
  }
}

export function writeJson(file: string, data: unknown) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data));
  fs.renameSync(tmp, file);
}
