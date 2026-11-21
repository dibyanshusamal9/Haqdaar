"use client";

import { useRef } from "react";
import Link from "next/link";
import { motion, useScroll, useTransform, MotionValue } from "framer-motion";
import { ArrowRight, ChevronDown, Phone } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageContext";
import { useCall } from "@/features/call/CallProvider";
import { useScrollFrames } from "./useScrollFrames";

/**
 * Home landing: a scroll-driven film (the camera pushes in from the village to a woman
 * on her porch, phone in hand, a stack of forms beside her). The village and the woman
 * stay on the left of every frame, so all copy sits on the right.
 */

type Beat = { dev: string; en: string; body?: string; cta?: boolean };

function Copy({ beat, opacity, y, cta, note }: { beat: Beat; opacity: MotionValue<number>; y: MotionValue<number>; cta: string; note: string }) {
  const visibility = useTransform(opacity, (value) => value > 0 ? "visible" : "hidden");
  const { t } = useLanguage();
  const { openCall } = useCall();

  return (
    <motion.div className="film-copy" style={{ visibility }}>
    <motion.div style={{ opacity, y }}>
      <h2 className="htitle">
        <span className="dev" lang="hi">{beat.dev}</span>
        <span className="en">{beat.en}</span>
      </h2>
      {beat.body && <p className="hsub">{beat.body}</p>}
      {beat.cta && (
        <>
          <div className="cta-row">
            <Link href="/check" className="cta">
              {cta} <ArrowRight size={18} aria-hidden />
            </Link>
            <button type="button" className="cta ghost" onClick={openCall}>
              <Phone size={17} aria-hidden /> {t.call.heroCta}
            </button>
          </div>
          <span className="hnote">{note}</span>
        </>
      )}
    </motion.div>
    </motion.div>
  );
}

export default function ScrollSequence() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const skipRef = useRef<HTMLButtonElement>(null);
  const { t, language } = useLanguage();

  const { scrollYProgress } = useScroll({ target: containerRef, offset: ["start start", "end end"] });
  const loaded = useScrollFrames(canvasRef, skipRef, scrollYProgress);

  // Four beats, each fading in and out on the right.
  // Hold the opening copy at zero through the end of the scroll timeline.
  // Otherwise the native scroll animation can interpolate it back to opacity 1.
  const o0 = useTransform(scrollYProgress, [0, 0.12, 0.17, 1], [1, 1, 0, 0]);
  const y0 = useTransform(scrollYProgress, [0, 0.17], [0, -40]);
  const o1 = useTransform(scrollYProgress, [0.18, 0.24, 0.38, 0.44], [0, 1, 1, 0]);
  const y1 = useTransform(scrollYProgress, [0.18, 0.24, 0.38, 0.44], [40, 0, 0, -40]);
  const o2 = useTransform(scrollYProgress, [0.46, 0.52, 0.66, 0.72], [0, 1, 1, 0]);
  const y2 = useTransform(scrollYProgress, [0.46, 0.52, 0.66, 0.72], [40, 0, 0, -40]);
  const o3 = useTransform(scrollYProgress, [0.76, 0.84, 1], [0, 1, 1]);
  const y3 = useTransform(scrollYProgress, [0.76, 0.84], [40, 0]);

  const beats: Beat[] = [
    { dev: "आपका हक़, आपकी भाषा में", en: "Know every scheme you're entitled to", body: t.hero.landingSub, cta: true },
    { dev: "हज़ारों योजनाएँ। पन्नों भर कानूनी भाषा।", en: "Thousands of schemes. Pages of legal prose.", body: t.hero.beat1Body },
    { dev: "एक बार बोलिए, अपने शब्दों में।", en: "Say it once. In your own words.", body: t.hero.beat2Body },
    { dev: "जानिए आपका हक़ क्या है", en: "Find the schemes you're entitled to", body: t.hero.finalSub, cta: true },
  ];

  const skip = () => {
    const el = containerRef.current;
    if (el) window.scrollTo({ top: el.offsetTop + el.offsetHeight, behavior: "smooth" });
  };

  return (
    <div ref={containerRef} className="ed" style={{ height: "640vh", position: "relative", background: "var(--ink)" }}>
      <div className="film">
        {!loaded && (
          <div className="film-loading">
            <h2 style={{ fontFamily: "var(--font-yatra-one)", fontSize: "2.4rem", marginBottom: "0.5rem" }}>हक़दार.ai</h2>
            <div style={{ fontSize: "1.05rem", color: "rgba(255,255,255,0.85)" }}>{t.loading.preparing}</div>
          </div>
        )}

        <canvas ref={canvasRef} aria-hidden />
        <div className="film-veil" />

        <Copy beat={beats[0]} opacity={o0} y={y0} cta={t.hero.cta} note={t.hero.ctaSub} />
        <Copy beat={beats[1]} opacity={o1} y={y1} cta={t.hero.cta} note={t.hero.ctaSub} />
        <Copy beat={beats[2]} opacity={o2} y={y2} cta={t.hero.cta} note={t.hero.ctaSub} />
        <Copy beat={beats[3]} opacity={o3} y={y3} cta={t.hero.cta} note={t.hero.ctaSub} />

        <button ref={skipRef} type="button" className="film-skip" onClick={skip} style={{ opacity: loaded ? 1 : 0 }} lang={language} aria-label={t.hero.skipLabel}>
          <ChevronDown size={18} aria-hidden />
          {t.hero.skip}
        </button>
      </div>
    </div>
  );
}
