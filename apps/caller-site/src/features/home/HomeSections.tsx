"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useLanguage } from "@/i18n/LanguageContext";
import { api, Stats } from "@/api/haqdaar";
import EdPage from "@/components/layout/EdPage";
import Footer from "@/components/Footer";

const STEP_HEADS = [
  { dev: "बोलिए या लिखिए", en: "Speak or type" },
  { dev: "फ़ॉर्म जाँचिए", en: "Check the form" },
  { dev: "अपना हक़ देखिए", en: "See what's yours" },
];

const STEP_ICONS = [
  <svg key="mic" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M19 11a7 7 0 0 1-14 0" /><line x1="12" y1="18" x2="12" y2="22" /></svg>,
  <svg key="form" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="3" width="14" height="18" rx="2" /><line x1="9" y1="8" x2="15" y2="8" /><line x1="9" y1="12" x2="15" y2="12" /><path d="M9 16.5l1.6 1.6 3.4-3.4" /></svg>,
  <svg key="list" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M4 6l1.5 1.5L8 5" /><path d="M4 12l1.5 1.5L8 11" /><path d="M4 18l1.5 1.5L8 17" /><line x1="11" y1="6.5" x2="20" y2="6.5" /><line x1="11" y1="12.5" x2="20" y2="12.5" /><line x1="11" y1="18.5" x2="20" y2="18.5" /></svg>,
];

/** The home page below the scroll story, in the editorial page style. */
export default function HomeSections() {
  const { t, language } = useLanguage();
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    api.stats().then(setStats).catch(() => setStats(null));
  }, []);

  const n = (v: number | undefined) => (v === undefined ? "…" : v.toLocaleString(language === "hi" ? "hi-IN" : "en-IN"));

  return (
    <EdPage id="home-sections">
      <section className="paper-sec" id="how">
        <div className="wrap narrow" style={{ textAlign: "center" }}>
          <div className="kick rv">How it works · यह कैसे काम करता है</div>
          <h2 className="rv"><span className="dev">बोलिए, जाँचिए, अपना हक़ देखिए।</span>Speak, check, see what&apos;s yours.</h2>
          <p className="lead rv d1">{t.hero.beat2Body}</p>
        </div>
        <div className="wrap" style={{ marginTop: 56 }}>
          <div className="feat">
            {t.home.howSteps.map((s, i) => (
              <div key={s.title} className={`fcard rv${i ? ` d${i}` : ""}`}>
                <span className="em">{STEP_ICONS[i]}</span>
                <h3><span className="dev">{STEP_HEADS[i].dev}</span>{STEP_HEADS[i].en}</h3>
                <p>{s.body}</p>
              </div>
            ))}
          </div>
          <div style={{ textAlign: "center", marginTop: 40 }}>
            <Link href="/check" className="cta rv">{t.hero.cta} →</Link>
          </div>
        </div>
      </section>

      <section className="band" id="trust">
        <div className="wrap">
          <div className="kick rv">Why you can trust it · भरोसा क्यों</div>
          <h2 className="rv"><span className="dev">ऐसे जवाब जिन्हें जाँचा जा सके</span>Answers you can check.</h2>
          <p className="lead rv d1 narrow">{t.home.whyIntro}</p>
          <div className="compare rv d1">
            <div>
              <span>{t.home.compareHead[0]}</span>
              <span>{t.home.compareHead[1]}</span>
            </div>
            {t.home.compareRows.map(([before, after]) => (
              <div key={before}>
                <span>{before}</span>
                <span>{after}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="paper-sec" id="corpus">
        <div className="wrap">
          <div className="kick rv">The corpus · डेटा</div>
          <h2 className="rv"><span className="dev">आपके नतीजों के पीछे का डेटा</span>{t.home.statsTitle}</h2>
          <div className="stats rv d1" style={{ marginTop: 36 }}>
            {[
              { v: stats?.total, label: t.home.stats.schemes },
              { v: stats?.central, label: t.home.stats.central },
              { v: stats?.state, label: t.home.stats.state },
              { v: stats?.predicates, label: t.home.stats.conditions },
            ].map((s) => (
              <div className="s" key={s.label}>
                <div className="n">{n(s.v)}</div>
                <div className="l"><b>{s.label}</b></div>
              </div>
            ))}
          </div>
          <div className="data-note rv">
            <span className="live">Live</span> {t.home.statsSource}
            {stats ? ` · v${stats.corpusVersion}` : ""}{" "}
            <a className="cite" href="https://www.myscheme.gov.in" target="_blank" rel="noreferrer">myscheme.gov.in</a>
          </div>
        </div>
      </section>

      <Footer />
    </EdPage>
  );
}
