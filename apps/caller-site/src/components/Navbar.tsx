"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Phone } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageContext";
import { LANGUAGES } from "@/i18n/types";
import { useCall } from "@/features/call/CallProvider";

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const { language, setLanguage, t } = useLanguage();
  const { openCall } = useCall();
  const pathname = usePathname();
  // Every page opens on a dark painted hero, so the bar stays clear until the page scrolls.
  const solid = scrolled;

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener("scroll", handleScroll);
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    setMenuOpen(false);
    // Client-side navigation leaves the clicked link focused, which draws a box around it.
    const el = document.activeElement as HTMLElement | null;
    if (el && el.closest("#global-nav-container")) el.blur();
  }, [pathname]);

  const links = [
    { href: "/check", label: t.nav.check },
    { href: "/schemes", label: t.nav.schemes },
    { href: "/stories", label: t.nav.examples },
    { href: "/help", label: t.nav.help },
    { href: "/about", label: t.nav.about },
  ];
  const other = LANGUAGES.find((l) => l.code !== language)!;

  return (
    <>
      <div className="navbar-scrim"></div>
      <header id="global-nav-container" className={`nav-container ${solid ? "scrolled" : ""}`}>
        <Link href="/" className="nav-logo-link" aria-label="Haqdaar.ai home">
          <div className="text-fluid-logo">हक़दार</div>
          <div className="text-fluid-logo-sub">Haqdaar.ai · {t.brand.tagline}</div>
        </Link>
        <button
          className="mobile-menu-btn"
          onClick={() => setMenuOpen(!menuOpen)}
          aria-expanded={menuOpen}
          aria-controls="nav-links"
          aria-label="Menu"
          style={{ background: "transparent", border: "none" }}
        >
          ☰
        </button>
        <nav className={`nav-links ${menuOpen ? "open" : ""}`} id="nav-links">
          {links.map((l) => (
            <Link key={l.href} href={l.href} className={pathname?.startsWith(l.href) ? "active" : ""}>
              <span className="text-fluid-nav">{l.label}</span>
            </Link>
          ))}
          <button type="button" className="nav-call-btn" onClick={() => { setMenuOpen(false); openCall(); }}>
            <Phone size={16} aria-hidden />
            <span>{t.call.navButton}</span>
          </button>
          <button
            onClick={() => setLanguage(other.code)}
            aria-label={`Switch to ${other.name}`}
            lang={other.code}
            style={{
              background: "transparent",
              border: "1px solid rgba(255,255,255,0.45)",
              color: "white",
              padding: "0.45rem 1rem",
              borderRadius: "100px",
              cursor: "pointer",
              fontFamily: "var(--font-hind)",
              fontSize: "1rem",
              fontWeight: 600,
            }}
          >
            {other.nativeName}
          </button>
        </nav>
      </header>
    </>
  );
}
