"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ExternalLink, Pencil } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageContext";
import { fmt } from "@/i18n/translations";
import { MatchResponse, MatchResult } from "@/api/haqdaar";

const PAGE = 20;

export function SchemeResultCard({ r }: { r: MatchResult }) {
  const { t } = useLanguage();
  const where = r.level === "central" || r.states.length === 0 ? t.results.allIndia : r.states.join(", ");
  return (
    <article className="hq-card hq-result">
      <div className="hq-row" style={{ gap: 8 }}>
        <span className={`hq-badge ${r.status}`}>{r.status === "eligible" ? `✓ ${t.results.eligible}` : `? ${t.results.likely}`}</span>
        <span className={`hq-badge ${r.level}`}>{r.level === "central" ? t.results.central : t.results.state}</span>
        <span className="hq-muted hq-small">{where}</span>
      </div>
      <h3 className="hq-result-title">
        <Link href={`/schemes/${encodeURIComponent(r.slug)}`}>{r.name}</Link>
      </h3>
      {r.brief && <p className="hq-muted" style={{ fontSize: "0.98rem" }}>{r.brief}</p>}

      {r.reasons.length > 0 ? (
        <div>
          <div className="hq-eyebrow" style={{ color: "var(--green)", marginBottom: 6 }}>{t.results.why}</div>
          <ul className="hq-reasons">
            {r.reasons.map((x) => (
              <li key={x.condition} title={x.condition}>
                <span className="tick" aria-hidden>✓</span>
                <span>{x.why}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="hq-small hq-muted">{t.results.noRules}</p>
      )}

      {r.verify.length > 0 && (
        <div>
          <div className="hq-eyebrow" style={{ color: "var(--likely)", marginBottom: 6 }}>{t.results.verify}</div>
          <ul className="hq-reasons">
            {r.verify.map((v) => (
              <li key={v}>
                <span className="q" aria-hidden>?</span>
                <span>{v}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {r.closed && r.closeDate && <p className="hq-notice err hq-small">{fmt(t.results.closed, { date: r.closeDate })}</p>}

      <div className="hq-result-actions">
        <Link className="hq-btn-ghost" href={`/schemes/${encodeURIComponent(r.slug)}`}>{t.results.details}</Link>
        <a className="hq-btn-ghost" href={r.sourceUrl} target="_blank" rel="noreferrer">
          {t.results.official} <ExternalLink size={16} aria-hidden />
        </a>
      </div>
    </article>
  );
}

export default function Results({ data, onEdit }: { data: MatchResponse; onEdit: () => void }) {
  const { t, language } = useLanguage();
  const [level, setLevel] = useState<"all" | "central" | "state">("all");
  const [eligibleOnly, setEligibleOnly] = useState(false);
  const [category, setCategory] = useState("");
  const [q, setQ] = useState("");
  const [shown, setShown] = useState(PAGE);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return data.results.filter(
      (r) =>
        (level === "all" || r.level === level) &&
        (!eligibleOnly || r.status === "eligible") &&
        (!category || r.categories.includes(category)) &&
        (!needle || r.name.toLowerCase().includes(needle) || (r.brief ?? "").toLowerCase().includes(needle)),
    );
  }, [data.results, level, eligibleOnly, category, q]);

  const n = (v: number) => v.toLocaleString(language === "hi" ? "hi-IN" : "en-IN");
  const reset = () => setShown(PAGE);

  return (
    <section aria-labelledby="results-title" className="hq-stack">
      <h2 id="results-title" className="hq-h3">{t.check.step3}</h2>

      <div className="hq-summary" role="status">
        <strong>{fmt(t.results.summary, { total: n(data.counts.total) })}</strong>
        <span>{fmt(t.results.eligibleCount, { n: n(data.counts.eligible) })}</span>
        <span style={{ opacity: 0.8 }}>{fmt(t.results.likelyCount, { n: n(data.counts.likely) })}</span>
        <button type="button" onClick={onEdit} className="hq-btn-ghost" style={{ marginLeft: "auto", color: "#fff", borderColor: "rgba(255,255,255,0.4)" }}>
          <Pencil size={16} aria-hidden /> {t.results.edit}
        </button>
      </div>

      {data.counts.total === 0 ? (
        <p className="hq-notice warn">{t.results.none}</p>
      ) : (
        <>
          <div className="hq-row" style={{ gap: 8 }}>
            {(["all", "central", "state"] as const).map((l) => (
              <button key={l} type="button" className="hq-chip" aria-pressed={level === l} onClick={() => { setLevel(l); reset(); }}>
                {l === "all" ? t.results.filterAll : l === "central" ? `${t.results.filterCentral} · ${n(data.counts.central)}` : `${t.results.filterState} · ${n(data.counts.state)}`}
              </button>
            ))}
            <button type="button" className="hq-chip" aria-pressed={eligibleOnly} onClick={() => { setEligibleOnly(!eligibleOnly); reset(); }}>
              ✓ {t.results.filterEligible}
            </button>
            <select aria-label={t.results.filterCategory} className="hq-select" style={{ width: "auto", minHeight: 40, borderRadius: 999 }} value={category} onChange={(e) => { setCategory(e.target.value); reset(); }}>
              <option value="">{t.results.allCategories}</option>
              {data.categories.map((c) => (
                <option key={c.name} value={c.name}>{c.name} ({c.count})</option>
              ))}
            </select>
            <input aria-label={t.results.searchWithin} className="hq-input" style={{ flex: "1 1 220px", minHeight: 40, borderRadius: 999 }} placeholder={t.results.searchWithin} value={q} onChange={(e) => { setQ(e.target.value); reset(); }} />
          </div>

          {filtered.length === 0 ? (
            <p className="hq-notice warn">{t.results.noneFiltered}</p>
          ) : (
            <div style={{ display: "grid", gap: 16 }}>
              {filtered.slice(0, shown).map((r) => (
                <SchemeResultCard key={r.slug} r={r} />
              ))}
            </div>
          )}
          {shown < filtered.length && (
            <div style={{ textAlign: "center" }}>
              <button type="button" className="hq-btn-ghost" onClick={() => setShown(shown + PAGE)}>
                {t.results.showMore} ({n(filtered.length - shown)})
              </button>
            </div>
          )}
        </>
      )}

      <p className="hq-muted hq-small">{fmt(t.results.corpus, { v: data.corpusVersion, ms: data.durationMs })}</p>
      <p className="hq-muted hq-small">{t.results.informational}</p>
    </section>
  );
}
