"use client";

import EdPage from "@/components/layout/EdPage";
import Hero from "@/components/layout/Hero";
import Footer from "@/components/Footer";
import { useLanguage } from "@/i18n/LanguageContext";
import { ABOUT, ABOUT_HEADS as H, TEAM } from "@/i18n/about";

const ICONS = [
  // microphone
  <svg key="mic" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M19 11a7 7 0 0 1-14 0" /><line x1="12" y1="18" x2="12" y2="22" /></svg>,
  // scales
  <svg key="scale" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="3" x2="12" y2="21" /><line x1="5" y1="7" x2="19" y2="7" /><path d="M5 7l-3 6a3 3 0 0 0 6 0z" /><path d="M19 7l-3 6a3 3 0 0 0 6 0z" /><line x1="8" y1="21" x2="16" y2="21" /></svg>,
  // speech bubble with tick
  <svg key="explain" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M4 5h16v11H9l-5 4z" /><path d="M8.5 10.5l2.2 2.2 4.8-4.8" /></svg>,
];

export default function AboutPage() {
  const { language } = useLanguage();
  const a = ABOUT[language];

  return (
    <EdPage id="about-page">
      <Hero dev={H.hero.dev} en={H.hero.en} sub={a.heroSub} cta={{ label: a.cta, href: "/check" }} />

      <section id="about" className="paper-sec">
        <div className="wrap narrow" style={{ textAlign: "center" }}>
          <div className="kick rv">{H.introKick}</div>
          <h2 className="rv"><span className="dev">{H.intro.dev}</span>{H.intro.en}</h2>
          <p className="lead rv d1">{a.lead}</p>
          <p className="body rv d2">{a.body}</p>
        </div>
        <div className="wrap" style={{ marginTop: 64 }}>
          <div className="feat">
            {H.features.map((f, i) => (
              <div key={f.en} className={`fcard rv${i ? ` d${i}` : ""}`}>
                <span className="em">{ICONS[i]}</span>
                <h3><span className="dev">{f.dev}</span>{f.en}</h3>
                <p>{a.features[i]}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="band" id="why">
        <div className="wrap">
          <div className="kick rv">{H.gapKick}</div>
          <h2 className="rv"><span className="dev">{H.gap.dev}</span>{H.gap.en}</h2>
          <div className="bridge-compare rv d1">
            <article>
              <span className="bc-icon">◫</span>
              <h3>{a.gapLeftTitle}</h3>
              <ul>{a.gapLeft.map((x) => <li key={x}>{x}</li>)}</ul>
            </article>
            <div className="gap-orb">GAP</div>
            <article className="human">
              <span className="bc-icon">◉</span>
              <h3>{a.gapRightTitle}</h3>
              <ul>{a.gapRight.map((x) => <li key={x}>{x}</li>)}</ul>
            </article>
          </div>
        </div>
      </section>

      <section className="softblue" id="built">
        <div className="wrap">
          <div className="kick rv">{H.builtKick}</div>
          <h2 className="rv"><span className="dev">{H.built.dev}</span>{H.built.en}</h2>
          <p className="lead rv d1 narrow">{a.builtLead}</p>
          <div className="steps-flow rv d1">
            {H.flow.map((s, i) => (
              <FlowStep key={s.en} last={i === H.flow.length - 1} icon={s.icon} dev={s.dev} en={s.en} small={a.flowSmall[i]} />
            ))}
          </div>
          <div className="two rv d2" style={{ marginTop: 42 }}>
            <div className="fig outcome">
              <h3>{a.promiseTitle}</h3>
              <p>{a.promiseSub}</p>
              {a.promises.map((r) => <div key={r} className="rule">{r}</div>)}
            </div>
            <div className="fig outcome">
              <h3>{a.notTitle}</h3>
              <p>{a.notSub}</p>
              {a.nots.map((r) => <div key={r} className="rule">{r}</div>)}
            </div>
          </div>
        </div>
      </section>

      <section className="mv-sec" id="mission-vision">
        <div className="wrap">
          <div className="mv-head rv">
            <div className="kick">{H.mvKick}</div>
            <h2><span className="dev">{H.mv.dev}</span>{H.mv.en}</h2>
            <p className="lead" style={{ color: "#e7ddca" }}>{a.mvLead}</p>
          </div>
          <div className="mv-grid">
            <article className="mv-card rv d1">
              <div className="mv-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><path d="M15.3 8.7 12.8 13l-4.3 2.3 2.5-4.3z" fill="currentColor" stroke="none" /></svg>
              </div>
              <h3><span className="dev">{H.mission.dev}</span>{H.mission.en}</h3>
              <p>{a.mission}</p>
            </article>
            <article className="mv-card vision rv d2">
              <div className="mv-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="13" r="4.1" /><line x1="3" y1="19" x2="21" y2="19" /><line x1="12" y1="4" x2="12" y2="6.2" /><line x1="5.6" y1="7.6" x2="7.1" y2="9.1" /><line x1="18.4" y1="7.6" x2="16.9" y2="9.1" /></svg>
              </div>
              <h3><span className="dev">{H.vision.dev}</span>{H.vision.en}</h3>
              <p>{a.vision}</p>
            </article>
          </div>
        </div>
      </section>

      <section className="paper-sec" id="team">
        <div className="wrap">
          <div className="kick rv">{H.teamKick}</div>
          <h2 className="rv"><span className="dev">{H.team.dev}</span>{H.team.en}</h2>
          <div className="two rv d1" style={{ marginTop: 36 }}>
            <div className="fig">
              <p className="body" style={{ marginTop: 0 }}>{a.teamIntro}</p>
              <div className="sdg" style={{ justifyContent: "flex-start" }}>
                {TEAM.map((m) => <b key={m}>{m}</b>)}
              </div>
            </div>
            <div className="fig">
              <h3 style={{ fontSize: 18, marginBottom: 8 }}>{a.dataTitle}</h3>
              <p className="body" style={{ marginTop: 0 }}>{a.data}</p>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </EdPage>
  );
}

function FlowStep({ icon, dev, en, small, last }: { icon: string; dev: string; en: string; small: string; last: boolean }) {
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
