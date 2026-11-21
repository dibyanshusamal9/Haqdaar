"use client";

import Link from "next/link";
import { useLanguage } from "@/i18n/LanguageContext";
import { useCall } from "@/features/call/CallProvider";

/** Call-to-action strip and footer, in the original RAAHI page layout. Render inside .ed. */
export default function Footer({ callbar = true }: { callbar?: boolean }) {
  const { t } = useLanguage();
  const { openCall } = useCall();
  return (
    <>
      {callbar && (
        <div className="callbar">
          <span className="dev" lang="hi">जानिए आपका हक़ क्या है</span> — {t.footer.callbar}{" "}
          <Link href="/check">{t.nav.check} →</Link>
          <button type="button" className="callbar-call" onClick={openCall}>{t.call.callbarCta}</button>
        </div>
      )}
      <footer>
        <div className="wrap">
          <div className="fgrid">
            <div>
              <h4>हक़दार · Haqdaar.ai</h4>
              <p>{t.footer.line}</p>
              <p style={{ marginTop: 12 }}>{t.footer.course}</p>
            </div>
            <div>
              <h4>{t.footer.sourcesTitle}</h4>
              <div className="reflist">
                <a href="https://www.myscheme.gov.in" target="_blank" rel="noreferrer">myscheme.gov.in · {t.footer.srcSchemes}</a>
                <a href="https://www.sarvam.ai" target="_blank" rel="noreferrer">Sarvam AI · {t.footer.srcSpeech}</a>
                <a href="https://groq.com" target="_blank" rel="noreferrer">Groq · Llama 3 · {t.footer.srcFields}</a>
                <a href="https://www.postgresql.org/docs/current/datatype-json.html" target="_blank" rel="noreferrer">PostgreSQL JSONB · {t.footer.srcRules}</a>
              </div>
            </div>
            <div>
              <h4>{t.footer.exploreTitle}</h4>
              <div className="reflist">
                <Link href="/check">{t.nav.check}</Link>
                <Link href="/schemes">{t.nav.schemes}</Link>
                <Link href="/stories">{t.nav.examples}</Link>
                <Link href="/help">{t.nav.help}</Link>
                <Link href="/about">{t.nav.about}</Link>
              </div>
            </div>
          </div>
          <hr className="frule" />
          <p style={{ fontSize: 12, color: "#8a7c63" }}>© 2026 Team Haqdaar.ai · {t.home.disclaimer}</p>
          <p style={{ fontSize: 12, color: "#8a7c63", marginTop: 6 }}>{t.footer.aiCredit}</p>
        </div>
      </footer>
    </>
  );
}
