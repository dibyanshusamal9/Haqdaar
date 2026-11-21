import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { Database } from '../db/database';
import { SearchHit } from './myscheme.client';
import { FacetIndex, normaliseScheme, SchemeRecord } from './normaliser';
import { RangeProbeData, resolveRanges } from './range-probe';
import { readJson, safe, ScrapeReport } from './scraper';

/**
 * Turns the raw scrape cache into database rows (UC-06 steps 4-6):
 * normalise -> upsert keyed on source URL (FR-09) -> withdraw schemes myscheme no longer
 * lists -> write the run report. Re-running on an unchanged cache changes nothing and
 * leaves the corpus version where it was.
 */

export interface IngestSummary {
  runId: number;
  corpusVersion: number;
  listed: number;
  added: number;
  updated: number;
  unchanged: number;
  withdrawn: number;
  failed: number;
  flagged: number;
  missingDetails: number;
}

export function loadRecords(cacheDir: string): { records: SchemeRecord[]; listingComplete: boolean; scrape: ScrapeReport | null } {
  const listing = readJson<{ total: number; items: SearchHit[] }>(path.join(cacheDir, 'listing.json'));
  if (!listing) throw new Error(`No listing.json in ${cacheDir}. Run "npm run scrape" first.`);
  const facetsRaw = readJson<{ facets: Record<string, Record<string, string[]>> }>(path.join(cacheDir, 'facets.json'));
  const facets: FacetIndex = {};
  for (const [id, byValue] of Object.entries(facetsRaw?.facets ?? {})) {
    facets[id] = Object.fromEntries(Object.entries(byValue).map(([v, slugs]) => [v, new Set(slugs)]));
  }
  const ageData = readJson<RangeProbeData>(path.join(cacheDir, 'range-age.json'));
  const disData = readJson<RangeProbeData>(path.join(cacheDir, 'range-disability.json'));
  const ages = ageData ? resolveRanges(ageData) : new Map();
  const disabilities = disData ? resolveRanges(disData) : new Map();

  const records = listing.items.map((hit) => {
    const slug = hit.fields.slug;
    return normaliseScheme({
      hit,
      detail: readJson(path.join(cacheDir, 'details', `${safe(slug)}.json`)),
      documents: readJson(path.join(cacheDir, 'documents', `${safe(slug)}.json`)),
      facets,
      age: ages.get(slug),
      disability: disabilities.get(slug),
    });
  });
  return {
    records,
    // Only withdraw schemes when we know the listing was complete.
    listingComplete: listing.items.length >= listing.total - 5,
    scrape: readJson<ScrapeReport>(path.join(cacheDir, 'scrape-report.json')),
  };
}

export function contentHash(r: SchemeRecord): string {
  return createHash('sha256').update(JSON.stringify(r)).digest('hex');
}

export async function ingest(
  db: Database,
  cacheDir: string,
  opts: { mode: 'scrape+ingest' | 'ingest'; triggeredBy: string; runId?: number; log: (m: string) => void },
): Promise<IngestSummary> {
  const runId =
    opts.runId ??
    (await db.one<{ id: number }>('insert into ingest_runs (mode, triggered_by) values ($1, $2) returning id', [opts.mode, opts.triggeredBy]))!.id;

  try {
    const { records, listingComplete, scrape } = loadRecords(cacheDir);
    opts.log(`ingest: normalised ${records.length} schemes from ${cacheDir}`);
    const scrapedAt = scrape?.finishedAt ?? scrape?.startedAt ?? new Date().toISOString();
    const summary = await db.tx(async (c) => {
      const existing = new Map(
        (
          await c.query<{ slug: string; id: number; content_hash: string; review_status: string; withdrawn_at: Date | null }>(
            'select slug, id, content_hash, review_status, withdrawn_at from schemes',
          )
        ).rows.map((r) => [r.slug, r]),
      );
      let added = 0, updated = 0, unchanged = 0, flagged = 0;
      const seen = new Set<string>();

      for (const r of records) {
        seen.add(r.slug);
        const hash = contentHash(r);
        const prev = existing.get(r.slug);
        const autoStatus = r.reviewReasons.length ? 'flagged' : 'auto';
        if (r.reviewReasons.length) flagged++;
        if (prev && prev.content_hash === hash && !prev.withdrawn_at) {
          unchanged++;
          continue;
        }
        const cols = [
          r.sourceUrl, r.slug, r.myschemeId, r.name, r.shortTitle, r.level, r.schemeType, r.schemeFor, r.states,
          r.ministry, r.department, r.implementingAgency, r.categories, r.subCategories, r.tags, r.brief,
          r.descriptionMd, r.benefitsMd, r.exclusionsMd, r.eligibilityMd, r.documentsMd, r.applicationMd,
          r.applicationModes, r.applyUrl, JSON.stringify(r.references), r.benefitType, r.isDbt, r.openDate,
          r.closeDate, JSON.stringify(r.rules), r.reviewReasons, hash, runId, scrapedAt,
        ];
        if (!prev) {
          await c.query(
            `insert into schemes (source_url, slug, myscheme_id, name, short_title, level, scheme_type, scheme_for, states,
               ministry, department, implementing_agency, categories, sub_categories, tags, brief, description_md,
               benefits_md, exclusions_md, eligibility_md, documents_md, application_md, application_modes, apply_url,
               references_json, benefit_type, is_dbt, open_date, close_date, rules, review_reasons, content_hash,
               corpus_version, scraped_at, review_status)
             values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,
                     $26,$27,$28,$29,$30,$31,$32,$33,$34,$35)`,
            [...cols, autoStatus],
          );
          added++;
        } else {
          // A curator's edited rules survive re-scrapes; an approval does not survive a rule change.
          await c.query(
            `update schemes set source_url=$1, myscheme_id=$3, name=$4, short_title=$5, level=$6, scheme_type=$7,
               scheme_for=$8, states=$9, ministry=$10, department=$11, implementing_agency=$12, categories=$13,
               sub_categories=$14, tags=$15, brief=$16, description_md=$17, benefits_md=$18, exclusions_md=$19,
               eligibility_md=$20, documents_md=$21, application_md=$22, application_modes=$23, apply_url=$24,
               references_json=$25, benefit_type=$26, is_dbt=$27, open_date=$28, close_date=$29,
               rules = case when review_status = 'edited' then rules else $30::jsonb end,
               review_reasons = case when review_status = 'edited' then review_reasons else $31 end,
               review_status = case when review_status = 'edited' then 'edited'
                                    when review_status = 'approved' and rules = $30::jsonb then 'approved'
                                    else $35 end,
               content_hash=$32, corpus_version=$33, scraped_at=$34, updated_at=now(), withdrawn_at=null
             where slug=$2`,
            [...cols, autoStatus],
          );
          updated++;
        }
      }

      let withdrawn = 0;
      if (listingComplete) {
        const gone = [...existing.values()].filter((e) => !seen.has(e.slug) && !e.withdrawn_at).map((e) => e.id);
        if (gone.length) {
          await c.query('update schemes set withdrawn_at = now(), corpus_version = $2 where id = any($1)', [gone, runId]);
          withdrawn = gone.length;
        }
      }

      const changed = added + updated + withdrawn > 0;
      const previous = (await c.query<{ v: number }>('select haqdaar_corpus_version() as v')).rows[0].v;
      const corpusVersion = changed ? runId : previous;
      const missingDetails = records.filter((r) => !r.myschemeId).length;
      const failed = scrape?.failures?.length ?? 0;
      await c.query(
        `update ingest_runs set status='succeeded', finished_at=now(), corpus_version=$2, listed=$3, added=$4,
           updated=$5, unchanged=$6, withdrawn=$7, failed=$8, flagged=$9, report=$10 where id=$1`,
        [runId, corpusVersion, records.length, added, updated, unchanged, withdrawn, failed, flagged,
         JSON.stringify({ scrape, missingDetails, cacheDir: path.basename(cacheDir) })],
      );
      return { runId, corpusVersion, listed: records.length, added, updated, unchanged, withdrawn, failed, flagged, missingDetails };
    });
    opts.log(
      `ingest: run ${runId} -> corpus v${summary.corpusVersion}: +${summary.added} added, ${summary.updated} updated, ` +
        `${summary.unchanged} unchanged, ${summary.withdrawn} withdrawn, ${summary.flagged} flagged for review`,
    );
    return summary;
  } catch (err) {
    await db.query("update ingest_runs set status='failed', finished_at=now(), error=$2 where id=$1", [
      runId,
      (err as Error).message.slice(0, 2000),
    ]);
    throw err;
  }
}

export function cacheExists(cacheDir: string) {
  return fs.existsSync(path.join(cacheDir, 'listing.json'));
}
