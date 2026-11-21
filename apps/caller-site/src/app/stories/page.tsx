"use client";

import { CSSProperties } from "react";
import Link from "next/link";
import EdPage from "@/components/layout/EdPage";
import Hero, { ILLUSTRATION } from "@/components/layout/Hero";
import Footer from "@/components/Footer";
import { useLanguage } from "@/i18n/LanguageContext";
import { EXAMPLES, EXAMPLES_COPY, EXAMPLES_HEADS as H } from "@/i18n/stories";

export default function SuccessStoriesPage() {
  const { language } = useLanguage();
  const c = EXAMPLES_COPY[language];

  return (
    <EdPage id="stories-page">
      <Hero dev={H.hero.dev} en={H.hero.en} sub={c.heroSub} cta={{ label: c.cta, href: "/check" }} />

      <section id="stories">
        <div className="wrap">
          <div className="kick rv">{H.kick}</div>
          <h2 className="rv"><span className="dev">{H.title.dev}</span>{H.title.en}</h2>
          <p className="lead rv d1 narrow">{c.intro}</p>
        </div>

        <div className="wrap" style={{ marginTop: 48 }}>
          {EXAMPLES.map((ex, i) => {
            const pic = (
              <div
                className="pic"
                role="img"
                aria-label={ex.summary[language]}
                style={{ "--pic": `url("${ILLUSTRATION(`example-${ex.id}`)}")` } as CSSProperties}
              />
            );
            return (
              <article key={ex.id} className={`story rv${i % 2 ? " rev" : ""}`}>
                {i % 2 === 0 && pic}
                <div className="txt">
                  <div className="name">{ex.name[language]}</div>
                  <div className="q">
                    <span className="dev" lang="hi">{ex.saidHi}</span>
                    {ex.saidEn}
                  </div>
                  <p className="note">{ex.explain[language]}</p>
                  <div className="path">
                    {ex.facts[language].map((f) => (
                      <span key={f} style={{ display: "contents" }}>
                        <b>{f}</b>
                        <span className="arw" aria-hidden>→</span>
                      </span>
                    ))}
                    {ex.matches.map((m) => <b key={m} className="ok">✓ {m}</b>)}
                    <b>{c.more}</b>
                  </div>
                  <div className="actions">
                    <Link className="cta" href={`/check?example=${ex.id}`}>{c.try} →</Link>
                  </div>
                </div>
                {i % 2 === 1 && pic}
              </article>
            );
          })}

          <p style={{ fontSize: 12.5, color: "#8a7c63", fontStyle: "italic", marginTop: 6 }}>{c.note}</p>
        </div>
      </section>

      <Footer />
    </EdPage>
  );
}
