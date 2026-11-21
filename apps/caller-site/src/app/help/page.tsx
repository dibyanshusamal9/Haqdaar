"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import EdPage from "@/components/layout/EdPage";
import Hero from "@/components/layout/Hero";
import Footer from "@/components/Footer";
import { useLanguage } from "@/i18n/LanguageContext";
import { HELP, HELP_HEADS as H } from "@/i18n/help";
import { fmt } from "@/i18n/translations";
import { api, Stats } from "@/api/haqdaar";

export default function HelpPage() {
  const { language, t } = useLanguage();
  const h = HELP[language];
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    api.stats().then(setStats).catch(() => setStats(null));
  }, []);

  const n = (v: number | undefined) => (v === undefined ? "…" : v.toLocaleString(language === "hi" ? "hi-IN" : "en-IN"));
  const field = (f: string) => stats?.fields.find((x) => x.field === f)?.schemes ?? 0;
  const pct = (f: string) => (stats && stats.total ? Math.round((field(f) / stats.total) * 100) : 0);
  const statValues = [stats?.total, stats?.central, stats?.state, stats?.predicates];
  const bars = [
    { label: h.bars[0], value: pct("state") },
    { label: h.bars[1], value: pct("age") },
    { label: h.bars[2], value: pct("occupation"), green: true },
    { label: h.bars[3], value: pct("annual_income"), green: true },
  ];

  return (
    <EdPage id="help-page">
      <Hero dev={H.hero.dev} en={H.hero.en} sub={h.heroSub} cta={{ label: h.cta, href: "/check" }} />

      <section className="paper-sec" id="facts">
        <div className="wrap">
          <div className="kick rv">{H.evidenceKick}</div>
          <h2 className="rv"><span className="dev">{H.evidence.dev}</span>{H.evidence.en}</h2>
          <p className="lead rv d1 narrow">{h.evidenceLead}</p>
          <div className="stats rv d1" style={{ marginTop: 42 }}>
            {h.statLabels.map((s, i) => (
              <div className="s" key={s.title}>
                <div className="n">{n(statValues[i])}</div>
                <div className="l">
                  <b>{s.title}</b>
                  <br />
                  {s.detail}
                  <br />
                  <a className="cite" href="https://www.myscheme.gov.in" target="_blank" rel="noreferrer">
                    {h.statCite}{stats ? ` · v${stats.corpusVersion}` : ""}
                  </a>
                </div>
              </div>
            ))}
          </div>
          <div className="data-note rv">
            <span className="live">Live</span> {h.dataNote}
          </div>
        </div>
      </section>

      <section className="band" id="gap">
        <div className="wrap">
          <div className="kick rv">{H.gapKick}</div>
          <h2 className="rv"><span className="dev">{H.gap.dev}</span>{H.gap.en}</h2>
          <div className="bridge-compare rv d1">
            <article>
              <span className="bc-icon">◫</span>
              <h3>{h.gapLeftTitle}</h3>
              <ul>{h.gapLeft.map((x) => <li key={x}>{x}</li>)}</ul>
            </article>
            <div className="gap-orb">GAP</div>
            <article className="human">
              <span className="bc-icon">◉</span>
              <h3>{h.gapRightTitle}</h3>
              <ul>{h.gapRight.map((x) => <li key={x}>{x}</li>)}</ul>
            </article>
          </div>
          <div className="access-bars rv d1">
            {bars.map((b) => (
              <div key={b.label}>
                <span>{b.label}</span>
                <b>{stats ? `${b.value}%` : "…"}</b>
                <i><u className={b.green ? "green" : undefined} style={{ width: `${b.value}%` }} /></i>
                <a className="cite" href="https://www.myscheme.gov.in" target="_blank" rel="noreferrer">{h.barCite}</a>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="paper-sec" id="leaks">
        <div className="wrap">
          <div className="kick rv">{H.leakKick}</div>
          <h2 className="rv"><span className="dev">{H.leak.dev}</span>{H.leak.en}</h2>
          <div className="leakflow rv d1">
            {h.leak.map((s, i) => (
              <LeakStep key={s.title} index={i} last={i === h.leak.length - 1} {...s} />
            ))}
          </div>
        </div>
      </section>

      <section className="softblue" id="bridge">
        <div className="wrap">
          <div className="kick rv">{H.bridgeKick}</div>
          <h2 className="rv"><span className="dev">{H.bridge.dev}</span>{H.bridge.en}</h2>
          <p className="lead rv d1 narrow">{h.bridgeLead}</p>
          <div className="steps-flow rv d1">
            {H.walk.map((s, i) => (
              <WalkStep key={s.en} icon={s.icon} dev={s.dev} en={s.en} last={i === H.walk.length - 1} small={fmt(h.walkSmall[i], { n: n(stats?.total) })} />
            ))}
          </div>
          <div className="two rv d2" style={{ marginTop: 42 }}>
            <div className="fig outcome">
              <h3>{h.resultTitle}</h3>
              <p>{h.resultSub}</p>
              {h.resultRows.map((r) => (
                <div className="target" key={r.text}><b>{r.mark}</b><span>{r.text}</span></div>
              ))}
            </div>
            <div className="fig outcome">
              <h3>{h.guardTitle}</h3>
              <p>{h.guardSub}</p>
              {h.guards.map((g) => <div className="rule" key={g}>{g}</div>)}
            </div>
          </div>
        </div>
      </section>

      <section className="paper-sec" id="steps">
        <div className="wrap narrow">
          <div className="kick rv">{H.stepsKick}</div>
          <h2 className="rv"><span className="dev">{H.steps.dev}</span>{H.steps.en}</h2>
          <div className="journey">
            {H.stepTitles.map((s, i) => (
              <div className="jstep rv" key={s.en}>
                <div className="dot">{i + 1}</div>
                <h4><span className="dev">{s.dev}</span>{s.en}</h4>
                <p>{h.steps[i]}</p>
              </div>
            ))}
          </div>
          <Link href="/check" className="cta rv">{t.hero.cta} →</Link>
        </div>
      </section>

      <section className="paper-sec" id="faq" style={{ paddingTop: 24 }}>
        <div className="wrap narrow">
          <div className="kick rv">{H.faqKick}</div>
          <h2 className="rv"><span className="dev">{H.faq.dev}</span>{H.faq.en}</h2>
          <div className="faq rv d1">
            {h.faqs.map((f) => (
              <details key={f.q}>
                <summary>{f.q}</summary>
                <p>{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className="source-sec" id="sources">
        <div className="wrap">
          <div className="kick rv">{H.sourcesKick}</div>
          <h2 className="rv"><span className="dev">{H.sources.dev}</span>{H.sources.en}</h2>
          <div className="source-grid rv d1">
            {h.sources.map((s) => (
              <a key={s.title} href={s.href} target="_blank" rel="noreferrer"><b>{s.title}</b><span>{s.detail}</span></a>
            ))}
          </div>
          <p className="method rv">{h.method}</p>
        </div>
      </section>

      <Footer />
    </EdPage>
  );
}

function LeakStep({ index, title, body, loss, last }: { index: number; title: string; body: string; loss: string; last: boolean }) {
  return (
    <>
      <div>
        <b>{String(index + 1).padStart(2, "0")}</b>
        <h3>{title}</h3>
        <p>{body}</p>
        <em>{loss}</em>
      </div>
      {!last && <span aria-hidden>→</span>}
    </>
  );
}

function WalkStep({ icon, dev, en, small, last }: { icon: string; dev: string; en: string; small: string; last: boolean }) {
  return (
    <>
      <div>
        <b>{icon}</b>
        <strong><span className="dev">{dev}</span>{en}</strong>
        <small>{small}</small>
      </div>
      {!last && <i aria-hidden>→</i>}
    </>
  );
}
