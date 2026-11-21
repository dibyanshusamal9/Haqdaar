import { Injectable, NotFoundException } from '@nestjs/common';
import { Database } from '../db/database';
import { InjectDb } from '../db/database.module';

export interface SchemeQuery {
  q?: string;
  level?: 'central' | 'state';
  state?: string;
  category?: string;
  page: number;
  size: number;
}

export const SCHEME_CARD_COLUMNS = `s.slug, s.name, s.short_title as "shortTitle", s.level, s.states, s.categories,
  s.brief, s.benefit_type as "benefitType", to_char(s.close_date, 'YYYY-MM-DD') as "closeDate", s.source_url as "sourceUrl",
  s.ministry`;

@Injectable()
export class SchemesService {
  constructor(@InjectDb() private readonly db: Database) {}

  async list(q: SchemeQuery) {
    const params = [q.q?.trim() || null, q.level ?? null, q.state ?? null, q.category ?? null, q.size, (q.page - 1) * q.size];
    const rows = await this.db.query(
      `select ${SCHEME_CARD_COLUMNS}, count(*) over() as total
       from schemes s
       where s.withdrawn_at is null
         and ($1::text is null or s.search_doc @@ websearch_to_tsquery('english', $1))
         and ($2::text is null or s.level = $2)
         and ($3::text is null or $3 = any(s.states) or s.states = '{}')
         and ($4::text is null or $4 = any(s.categories))
       order by case when $1::text is null then 0 else ts_rank(s.search_doc, websearch_to_tsquery('english', $1)) end desc,
                s.name asc, s.slug asc
       limit $5 offset $6`,
      params,
    );
    const total = rows.length ? Number(rows[0].total) : 0;
    return {
      total,
      page: q.page,
      size: q.size,
      items: rows.map(({ total: _t, ...r }) => r),
    };
  }

  async get(slug: string) {
    const row = await this.db.one(
      `select ${SCHEME_CARD_COLUMNS}, s.scheme_type as "schemeType", s.scheme_for as "schemeFor", s.department,
              s.implementing_agency as "implementingAgency", s.sub_categories as "subCategories", s.tags,
              s.description_md as "descriptionMd", s.benefits_md as "benefitsMd", s.exclusions_md as "exclusionsMd",
              s.eligibility_md as "eligibilityMd", s.documents_md as "documentsMd", s.application_md as "applicationMd",
              s.application_modes as "applicationModes", s.apply_url as "applyUrl", s.references_json as "references",
              s.is_dbt as "isDbt", to_char(s.open_date, 'YYYY-MM-DD') as "openDate", s.rules,
              s.review_status as "reviewStatus", s.review_reasons as "reviewReasons", s.curator_note as "curatorNote",
              s.corpus_version as "corpusVersion", s.scraped_at as "scrapedAt", s.withdrawn_at as "withdrawnAt"
       from schemes s where s.slug = $1`,
      [slug],
    );
    if (!row) throw new NotFoundException(`No scheme with slug "${slug}"`);
    return row;
  }

  async stats() {
    const [totals] = await this.db.query(
      `select count(*)::int as total,
              count(*) filter (where level = 'central')::int as central,
              count(*) filter (where level = 'state')::int as state,
              count(*) filter (where jsonb_array_length(rules->'all') > 0)::int as "withRules",
              count(*) filter (where review_status = 'flagged')::int as flagged,
              coalesce(sum(jsonb_array_length(rules->'all')), 0)::int as predicates,
              haqdaar_corpus_version() as "corpusVersion"
       from schemes where withdrawn_at is null`,
    );
    const states = await this.db.query(
      `select st as state, count(*)::int as count
       from schemes, unnest(states) st where withdrawn_at is null group by st order by count desc, st`,
    );
    const categories = await this.db.query(
      `select c as category, count(*)::int as count
       from schemes, unnest(categories) c where withdrawn_at is null group by c order by count desc, c`,
    );
    const lastRun = await this.db.one(
      `select id, mode, status, started_at as "startedAt", finished_at as "finishedAt", listed, added, updated, flagged
       from ingest_runs where status = 'succeeded' order by id desc limit 1`,
    );
    // How many schemes carry each kind of condition (e.g. 4,022 have an age limit).
    const fields = await this.db.query<{ field: string; schemes: number }>(
      `select p->>'field' as field, count(distinct s.id)::int as schemes
       from schemes s, jsonb_array_elements(s.rules->'all') p
       where s.withdrawn_at is null group by 1 order by 2 desc`,
    );
    return { ...totals, states, categories, fields, lastRun };
  }
}
