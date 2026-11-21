"use client";
import React, { useEffect, useState } from "react";
import { useLanguage } from "@/i18n/LanguageContext";

/** Brief branded cover while a page's heavy media starts loading. */
export default function PageLoader() {
  const [loaded, setLoaded] = useState(false);
  const { t } = useLanguage();

  useEffect(() => {
    const timer = setTimeout(() => setLoaded(true), 400);
    return () => clearTimeout(timer);
  }, []);

  if (loaded) return null;

  return (
    <div style={{ position: "fixed", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "white", zIndex: 9999, backgroundColor: "#1c1710" }}>
      <h2 style={{ fontFamily: "var(--font-yatra-one)", fontSize: "2.4rem", marginBottom: "0.5rem" }}>हक़दार.ai</h2>
      <div style={{ fontFamily: "var(--font-hind)", fontSize: "1.1rem", color: "rgba(255,255,255,0.85)" }}>{t.loading.preparing}</div>
    </div>
  );
}
