"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, ExternalLink } from "lucide-react";
import Footer from "@/components/Footer";
import EdPage from "@/components/layout/EdPage";
import Hero from "@/components/layout/Hero";
import Markdown from "@/components/Markdown";
import { useLanguage } from "@/i18n/LanguageContext";
import { fmt } from "@/i18n/translations";
import { api, ApiError, SchemeDetail } from "@/api/haqdaar";

export default function SchemePage() {
  const { slug } = useParams<{ slug: string }>();
  const router = useRouter();
  const { t, language } = useLanguage();
  const [s, setS] = useState<SchemeDetail | null>(null);
  const [error, setError] = useState<"missing" | "network" | null>(null);

  useEffect(() => {
    if (!slug) return;
    api
      .scheme(decodeURIComponent(slug))
      .then(setS)
      .catch((e) => setError(e instanceof ApiError && e.status === 404 ? "missing" : "network"));
  }, [slug]);

  const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <section className="hq-card" style={{ display: "grid", gap: 10 }}>
      <h2 className="hq-h3">{title}</h2>
      {children}
    </section>
  );

  return (
    <EdPage id="scheme-page">
      <Hero
        short
        devLang={s ? "en" : "hi"}
        dev={s ? s.name : error ? t.scheme.notFound : "योजना का विवरण"}
        en={s ? (s.level === "central" ? "केंद्रीय योजना · Central scheme" : `राज्य योजना · State scheme${s.states.length ? ` · ${s.states.join(", ")}` : ""}`) : "Scheme details"}
        sub={s?.brief ?? undefined}
      />
      <section className="tool-sec">
      <div className="wrap hq-stack" style={{ maxWidth: 900 }}>
        <button type="button" className="hq-btn-ghost" onClick={() => (history.length > 1 ? router.back() : router.push("/schemes"))} style={{ justifySelf: "start" }}>
          <ArrowLeft size={18} aria-hidden /> {t.scheme.back}
        </button>

        {error && <p className="hq-notice err">{error === "missing" ? t.scheme.notFound : t.schemes.loadError}</p>}
        {!s && !error && <div className="hq-skeleton" style={{ height: 260 }} />}

        {s && (
          <>
            <header className="hq-stack">
              <div className="hq-row" style={{ gap: 8 }}>
                <span className={`hq-badge ${s.level}`}>{s.level === "central" ? t.results.central : t.results.state}</span>
                <span className="hq-muted hq-small">{s.states.length ? s.states.join(", ") : t.results.allIndia}</span>
                {s.categories.map((c) => <span key={c} className="hq-badge state">{c}</span>)}
              </div>
              <dl className="hq-muted hq-small" style={{ display: "grid", gridTemplateColumns: "max-content 1fr", gap: "4px 14px" }}>
                {s.ministry && (<><dt>{t.scheme.ministry}</dt><dd>{s.ministry}</dd></>)}
                {s.department && (<><dt>{t.scheme.department}</dt><dd>{s.department}</dd></>)}
              </dl>
              {s.closeDate && s.closeDate < new Date().toISOString().slice(0, 10) && (
                <p className="hq-notice err">{fmt(t.results.closed, { date: s.closeDate })}</p>
              )}
              <div className="hq-row">
                {s.applyUrl && (
                  <a className="hq-btn" href={s.applyUrl} target="_blank" rel="noreferrer">
                    {t.scheme.applyOnline} <ExternalLink size={18} aria-hidden />
                  </a>
                )}
                <a className="hq-btn-ghost" href={s.sourceUrl} target="_blank" rel="noreferrer">
                  {t.results.official} (myscheme.gov.in) <ExternalLink size={16} aria-hidden />
                </a>
              </div>
            </header>

            {s.benefitsMd && <Section title={t.scheme.benefits}><Markdown text={s.benefitsMd} /></Section>}
            {s.eligibilityMd && <Section title={t.scheme.eligibility}><Markdown text={s.eligibilityMd} /></Section>}

            <Section title={t.scheme.rules}>
              <p className="hq-muted hq-small">{t.scheme.rulesNote}</p>
              {s.rules.all.length === 0 ? (
                <p className="hq-notice warn">{t.scheme.noRules}</p>
              ) : (
                <ul className="hq-reasons">
                  {s.rules.all.map((p) => (
                    <li key={p.id}>
                      <span className="tick" aria-hidden>•</span>
                      <span>
                        {p.label}{" "}
                        <span className="hq-badge state" style={{ marginLeft: 4 }}>{t.scheme.sourceTag[p.src] ?? p.src}</span>
                        {p.strict !== undefined && <span className="hq-badge likely" style={{ marginLeft: 4 }}>{t.scheme.approx}</span>}
                        {p.strength === "soft" && <span className="hq-badge likely" style={{ marginLeft: 4 }}>{t.scheme.soft}</span>}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Section>

            {s.exclusionsMd && <Section title={t.scheme.exclusions}><Markdown text={s.exclusionsMd} /></Section>}
            {s.documentsMd && <Section title={t.scheme.documents}><Markdown text={s.documentsMd} /></Section>}
            {s.applicationMd && <Section title={t.scheme.apply}><Markdown text={s.applicationMd} /></Section>}

            {s.references.length > 0 && (
              <Section title={t.scheme.references}>
                <ul className="hq-prose" style={{ marginLeft: "1.2rem" }}>
                  {s.references.map((r) => (
                    <li key={r.url}><a href={r.url} target="_blank" rel="noreferrer">{r.title}</a></li>
                  ))}
                </ul>
              </Section>
            )}

            <p className="hq-muted hq-small">
              {t.scheme.source}: <a href={s.sourceUrl} target="_blank" rel="noreferrer" style={{ textDecoration: "underline" }}>{s.sourceUrl}</a>
              {s.scrapedAt && <> · {fmt(t.scheme.scraped, { date: new Date(s.scrapedAt).toLocaleDateString(language === "hi" ? "hi-IN" : "en-IN") })}</>}
            </p>
            <p>
              <Link href="/check" className="hq-btn">{t.hero.cta}</Link>
            </p>
          </>
        )}
      </div>
      </section>
      <Footer />
    </EdPage>
  );
}
