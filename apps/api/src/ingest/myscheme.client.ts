/**
 * Thin client for the public JSON API behind www.myscheme.gov.in.
 *
 * The site's own frontend calls these endpoints from every visitor's browser with a
 * public x-api-key baked into its JS bundle; we discover that key the same way the
 * browser gets it. Every request goes through one global throttle (NFR-07) and is
 * retried with exponential backoff on 429 / 5xx / network errors.
 */

export interface SearchFilter {
  identifier: string;
  value?: string;
  min?: number;
  max?: number;
}

export interface SearchHit {
  id: string;
  fields: {
    slug: string;
    schemeName: string;
    schemeShortTitle?: string;
    level?: string;
    schemeFor?: string;
    nodalMinistryName?: string;
    beneficiaryState?: string[];
    schemeCategory?: string[];
    briefDescription?: string;
    schemeCloseDate?: string | null;
    tags?: string[];
    priority?: number;
  };
}

export interface FacetEntry {
  label: string | number;
  count: number;
}

export interface Facet {
  identifier: string;
  label: string;
  type: string;
  entries?: FacetEntry[];
}

export interface SearchPage {
  total: number;
  items: SearchHit[];
  facets: Facet[];
}

export interface ClientOptions {
  siteUrl: string;
  apiUrl: string;
  apiKey?: string;
  minIntervalMs: number;
  maxRetries: number;
  userAgent: string;
  log?: (msg: string) => void;
}

export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly url: string,
    body: string,
  ) {
    super(`HTTP ${status} for ${url}: ${body.slice(0, 200)}`);
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export class MySchemeClient {
  private apiKey: string | undefined;
  private nextSlot = 0;
  requests = 0;

  constructor(private readonly opts: ClientOptions) {
    this.apiKey = opts.apiKey || undefined;
  }

  private log(msg: string) {
    this.opts.log?.(msg);
  }

  /** Reads the public x-api-key out of the site's JS bundle, unless one was configured. */
  async init(): Promise<void> {
    if (this.apiKey) return;
    const html = await this.fetchText(`${this.opts.siteUrl}/search`);
    const scripts = [...new Set(html.match(/\/_next\/static\/[^"']+\.js/g) ?? [])];
    for (const src of scripts) {
      const url = src.startsWith('http') ? src : `${this.opts.siteUrl}${src}`;
      const js = await this.fetchText(url);
      const m = js.match(/"x-api-key"\s*:\s*"([A-Za-z0-9]{20,})"/);
      if (m) {
        this.apiKey = m[1];
        this.log(`discovered myscheme public API key from ${src}`);
        return;
      }
    }
    throw new Error(
      'Could not find the myscheme.gov.in public API key in the site bundle. Set MYSCHEME_API_KEY.',
    );
  }

  /** One global request slot every minIntervalMs, shared by all concurrent workers. */
  private async throttle() {
    const now = Date.now();
    const slot = Math.max(now, this.nextSlot);
    this.nextSlot = slot + this.opts.minIntervalMs;
    if (slot > now) await sleep(slot - now);
  }

  private async fetchText(url: string, headers: Record<string, string> = {}): Promise<string> {
    let attempt = 0;
    for (;;) {
      await this.throttle();
      this.requests++;
      try {
        const res = await fetch(url, {
          headers: { 'User-Agent': this.opts.userAgent, Accept: '*/*', ...headers },
          signal: AbortSignal.timeout(45_000),
        });
        const body = await res.text();
        if (res.ok) return body;
        const retryable = res.status === 429 || res.status >= 500;
        if (!retryable || attempt >= this.opts.maxRetries) throw new HttpError(res.status, url, body);
        const retryAfter = Number(res.headers.get('retry-after'));
        const wait = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : backoff(attempt);
        this.log(`HTTP ${res.status} on ${shorten(url)}; retry ${attempt + 1} in ${wait}ms`);
        await sleep(wait);
      } catch (err) {
        if (err instanceof HttpError || attempt >= this.opts.maxRetries) throw err;
        const wait = backoff(attempt);
        this.log(`network error on ${shorten(url)} (${(err as Error).message}); retry ${attempt + 1} in ${wait}ms`);
        await sleep(wait);
      }
      attempt++;
    }
  }

  private async getJson<T>(path: string): Promise<T> {
    if (!this.apiKey) await this.init();
    const body = await this.fetchText(`${this.opts.apiUrl}${path}`, {
      Accept: 'application/json',
      'x-api-key': this.apiKey!,
      Origin: this.opts.siteUrl,
      Referer: `${this.opts.siteUrl}/`,
    });
    const json = JSON.parse(body);
    if (json?.statusCode && json.statusCode !== 200) {
      throw new HttpError(json.statusCode, path, body);
    }
    return json as T;
  }

  async search(filters: SearchFilter[], from: number, size = 100, sort = 'schemename-asc'): Promise<SearchPage> {
    const q = encodeURIComponent(JSON.stringify(filters));
    const json = await this.getJson<any>(
      `/search/v6/schemes?lang=en&q=${q}&keyword=&sort=${sort}&from=${from}&size=${size}`,
    );
    const data = json.data;
    return { total: data.hits.page.total, items: data.hits.items, facets: data.facets ?? [] };
  }

  async count(filters: SearchFilter[]): Promise<number> {
    return (await this.search(filters, 0, 1)).total;
  }

  /**
   * Every hit for a filter set. Pages are sorted by name for stable paging; if the
   * union still comes up short of `total` we sweep again in reverse order.
   */
  async searchAll(filters: SearchFilter[]): Promise<{ total: number; items: SearchHit[]; facets: Facet[] }> {
    const seen = new Map<string, SearchHit>();
    let total = 0;
    let facets: Facet[] = [];
    for (const sort of ['schemename-asc', 'schemename-desc']) {
      for (let from = 0; ; from += 100) {
        const page = await this.search(filters, from, 100, sort);
        if (from === 0 && sort === 'schemename-asc') {
          total = page.total;
          facets = page.facets;
        }
        for (const hit of page.items) seen.set(hit.fields.slug, hit);
        if (page.items.length < 100 || from + 100 >= page.total) break;
      }
      if (seen.size >= total) break;
    }
    return { total, items: [...seen.values()], facets };
  }

  async detail(slug: string): Promise<any> {
    const json = await this.getJson<any>(`/schemes/v6/public/schemes?slug=${encodeURIComponent(slug)}&lang=en`);
    return json.data;
  }

  async documents(schemeId: string): Promise<any> {
    const json = await this.getJson<any>(`/schemes/v6/public/schemes/${encodeURIComponent(schemeId)}/documents?lang=en`);
    return json.data;
  }
}

function backoff(attempt: number) {
  return Math.min(60_000, 1000 * 2 ** attempt) + Math.floor(Math.random() * 500);
}

function shorten(url: string) {
  return url.length > 120 ? `${url.slice(0, 117)}...` : url;
}
