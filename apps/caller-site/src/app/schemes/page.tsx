"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ExternalLink, Search } from "lucide-react";
import Footer from "@/components/Footer";
import EdPage from "@/components/layout/EdPage";
import Hero from "@/components/layout/Hero";
import { useLanguage } from "@/i18n/LanguageContext";
import { fmt } from "@/i18n/translations";
import { api, SchemeCard, STATES, Stats } from "@/api/haqdaar";

const SIZE = 24;

export default function SchemesPage() {
  const { t, language } = useLanguage();
  const [q, setQ] = useState("");
  const [query, setQuery] = useState("");
  const [level, setLevel] = useState("");
  const [state, setState] = useState("");
  const [category, setCategory] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<{ total: number; items: SchemeCard[] } | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    api.stats().then(setStats).catch(() => {});
  }, []);

  useEffect(() => {
    let cancelled = false;
    setError(false);
    api
      .schemes({ q: query, level, state, category, page, size: SIZE })
      .then((d) => !cancelled && setData(d))
      .catch(() => !cancelled && setError(true));
    return () => {
      cancelled = true;
    };
  }, [query, level, state, category, page]);

  const n = (v: number) => v.toLocaleString(language === "hi" ? "hi-IN" : "en-IN");
  const pages = data ? Math.max(1, Math.ceil(data.total / SIZE)) : 1;

  return (
    <EdPage id="schemes-page">
      <Hero dev="सभी योजनाएँ" en="Browse every scheme" sub={t.schemes.intro} cta={{ label: t.schemes.heroCta, href: "#browse" }} />
      <section className="tool-sec" id="browse">
      <div className="wrap hq-stack">

        <form
          className="hq-card"
          role="search"
          onSubmit={(e) => {
            e.preventDefault();
            setPage(1);
            setQuery(q);
          }}
          style={{ display: "grid", gap: 12 }}
        >
          <div className="hq-row">
            <input aria-label={t.schemes.search} className="hq-input" style={{ flex: "1 1 320px" }} placeholder={t.schemes.search} value={q} onChange={(e) => setQ(e.target.value)} />
            <button type="submit" className="hq-btn"><Search size={20} aria-hidden /> {t.schemes.searchButton}</button>
          </div>
          <div className="hq-row">
            <select aria-label={t.schemes.level} className="hq-select" style={{ width: "auto" }} value={level} onChange={(e) => { setLevel(e.target.value); setPage(1); }}>
              <option value="">{t.schemes.level}: {t.results.filterAll}</option>
              <option value="central">{t.results.central}</option>
              <option value="state">{t.results.state}</option>
            </select>
            <select aria-label={t.schemes.state} className="hq-select" style={{ width: "auto" }} value={state} onChange={(e) => { setState(e.target.value); setPage(1); }}>
              <option value="">{t.schemes.allStates}</option>
              {STATES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <select aria-label={t.schemes.category} className="hq-select" style={{ width: "auto", maxWidth: "100%" }} value={category} onChange={(e) => { setCategory(e.target.value); setPage(1); }}>
              <option value="">{t.results.allCategories}</option>
              {stats?.categories.map((c) => <option key={c.category} value={c.category}>{c.category} ({n(c.count)})</option>)}
            </select>
          </div>
        </form>

        {error && <p className="hq-notice err">{t.schemes.loadError}</p>}
        {data && <p className="hq-muted" aria-live="polite">{fmt(t.schemes.count, { n: n(data.total) })}</p>}

        {!data && !error && (
          <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))" }}>
            {Array.from({ length: 6 }, (_, i) => <div key={i} className="hq-skeleton" style={{ height: 180 }} />)}
          </div>
        )}

        {data && data.items.length === 0 && <p className="hq-notice warn">{t.schemes.empty}</p>}

        {data && data.items.length > 0 && (
          <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))" }}>
            {data.items.map((s) => (
              <article key={s.slug} className="hq-card hq-result">
                <div className="hq-row" style={{ gap: 8 }}>
                  <span className={`hq-badge ${s.level}`}>{s.level === "central" ? t.results.central : t.results.state}</span>
                  <span className="hq-muted hq-small">{s.states.length ? s.states.join(", ") : t.results.allIndia}</span>
                </div>
                <h2 className="hq-result-title" style={{ fontSize: "1.12rem" }}>
                  <Link href={`/schemes/${encodeURIComponent(s.slug)}`}>{s.name}</Link>
                </h2>
                {s.brief && <p className="hq-muted hq-small">{s.brief.length > 200 ? `${s.brief.slice(0, 197)}…` : s.brief}</p>}
                <div className="hq-result-actions" style={{ marginTop: "auto" }}>
                  <Link className="hq-btn-ghost" href={`/schemes/${encodeURIComponent(s.slug)}`}>{t.results.details}</Link>
                  <a className="hq-btn-ghost" href={s.sourceUrl} target="_blank" rel="noreferrer">myscheme <ExternalLink size={14} aria-hidden /></a>
                </div>
              </article>
            ))}
          </div>
        )}

        {data && pages > 1 && (
          <nav className="hq-row" style={{ justifyContent: "center" }} aria-label="Pagination">
            <button type="button" className="hq-btn-ghost" disabled={page <= 1} onClick={() => setPage(page - 1)}>{t.schemes.prev}</button>
            <span className="hq-muted">{fmt(t.schemes.page, { p: n(page), n: n(pages) })}</span>
            <button type="button" className="hq-btn-ghost" disabled={page >= pages} onClick={() => setPage(page + 1)}>{t.schemes.next}</button>
          </nav>
        )}
      </div>
      </section>
      <Footer />
    </EdPage>
  );
}
