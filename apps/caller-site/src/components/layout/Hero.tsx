import Link from "next/link";
import { CSSProperties, ReactNode } from "react";

export const ILLUSTRATION = (name: string) => `/assets/illustrations/${name}.jpg`;

interface Props {
  /** Devanagari line, shown large */
  dev: string;
  /** English line, shown under it in gold */
  en: string;
  sub?: ReactNode;
  /** href may be a page or an in-page anchor such as "#start" */
  cta?: { label: string; href: string };
  /** Shorter hero (scheme detail only); the five main pages use the full-height one. */
  short?: boolean;
  image?: string;
  hint?: boolean;
  /** language of the main line; Hindi unless it carries something like an English scheme name */
  devLang?: string;
}

const CtaIcon = () => (
  <svg className="cta-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <circle cx="12" cy="12" r="8" />
    <circle cx="12" cy="12" r="4" fill="currentColor" stroke="none" />
  </svg>
);

/**
 * Full-bleed painted hero with the bilingual title, as on the original RAAHI pages. Every
 * main page uses the same type (.htitle / .hsub), so the landings read identically.
 */
export default function Hero({ dev, en, sub, cta, short, image = ILLUSTRATION("hero"), hint = !short, devLang = "hi" }: Props) {
  return (
    <header className={`hero${short ? " short" : ""}`}>
      <div className="bgimg">
        <div className="art" style={{ "--hero-art": `url("${image}")` } as CSSProperties} aria-hidden />
      </div>
      <div className="veil"></div>
      <div className="inner">
        <div className="wrap">
          <h1 className="htitle">
            <span className="dev" lang={devLang}>{dev}</span>
            <span className="en">{en}</span>
          </h1>
          {sub && <p className="hsub">{sub}</p>}
          {cta &&
            (cta.href.startsWith("#") ? (
              <a className="cta" href={cta.href}>
                <CtaIcon />
                {cta.label}
              </a>
            ) : (
              <Link className="cta" href={cta.href}>
                <CtaIcon />
                {cta.label}
              </Link>
            ))}
        </div>
      </div>
      {hint && <div className="scrollhint dev" aria-hidden>नीचे देखें ↓</div>}
    </header>
  );
}
