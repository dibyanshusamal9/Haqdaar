"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { LanguageCode } from "./types";
import { Dict, translations } from "./translations";

interface LanguageContextProps {
  language: LanguageCode;
  setLanguage: (lang: LanguageCode) => void;
  t: Dict;
}

const LanguageContext = createContext<LanguageContextProps | undefined>(undefined);
const STORAGE_KEY = "haqdaar_language";

export const LanguageProvider = ({ children }: { children: ReactNode }) => {
  const [language, setLanguageState] = useState<LanguageCode>("en");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY) as LanguageCode | null;
      if (saved && translations[saved]) setLanguageState(saved);
    } catch {
      /* storage blocked: stay on English */
    }
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted) {
      document.documentElement.lang = language;
      document.documentElement.dir = translations[language].direction;
    }
  }, [language, mounted]);

  const setLanguage = (lang: LanguageCode) => {
    setLanguageState(lang);
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch {
      /* ignore */
    }
  };

  const t = translations[language] || translations.en;

  if (!mounted) {
    return (
      <div style={{ position: "fixed", inset: 0, backgroundColor: "#1c1710", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <h2 className="brand-font" style={{ fontSize: "2rem", color: "white", margin: 0 }}>Haqdaar.ai</h2>
      </div>
    );
  }

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      <div className={`lang-${language} dir-${t.direction}`} style={{ display: "contents" }}>
        {children}
      </div>
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return context;
};
