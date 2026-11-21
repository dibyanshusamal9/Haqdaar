"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, RotateCcw, Search } from "lucide-react";
import DescribeCard from "@/features/check/DescribeCard";
import ProfileForm from "@/features/check/ProfileForm";
import Results from "@/features/check/Results";
import Footer from "@/components/Footer";
import EdPage from "@/components/layout/EdPage";
import Hero from "@/components/layout/Hero";
import { useLanguage } from "@/i18n/LanguageContext";
import { fmt } from "@/i18n/translations";
import { EXAMPLES } from "@/i18n/stories";
import {
  api, ApiError, draftToProfile, EMPTY_DRAFT, Extraction, MatchResponse, mergeExtraction, ProfileDraft, REQUIRED,
} from "@/api/haqdaar";

type Key = keyof ProfileDraft;
type Notice = { kind: "ok" | "warn" | "err" | "info"; text: string };

const STORE = "haqdaar_check_v1";

interface Saved {
  draft: ProfileDraft;
  filled: Key[];
  text: string;
  mode: "form" | "voice" | "text";
  result: MatchResponse | null;
}

export default function CheckPage() {
  const { t } = useLanguage();
  const [draft, setDraft] = useState<ProfileDraft>(EMPTY_DRAFT);
  const [filled, setFilled] = useState<Set<Key>>(new Set());
  const [text, setText] = useState("");
  const [mode, setMode] = useState<"form" | "voice" | "text">("form");
  const [busy, setBusy] = useState<"voice" | "text" | null>(null);
  const [matching, setMatching] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [result, setResult] = useState<MatchResponse | null>(null);
  const [voiceAvailable, setVoiceAvailable] = useState(true);
  const [restored, setRestored] = useState(false);
  const resultsRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLDivElement>(null);

  // Restore an earlier session, or open an example profile (?example=id).
  useEffect(() => {
    const example = new URLSearchParams(window.location.search).get("example");
    const ex = example ? EXAMPLES.find((e) => e.id === example) : undefined;
    if (ex) {
      setDraft(ex.draft);
      // Opened from a success story: go straight to the pre-filled form.
      setTimeout(() => document.getElementById("start")?.scrollIntoView({ behavior: "smooth" }), 350);
      setText("");
      setFilled(new Set());
      setResult(null);
    } else {
      try {
        const saved = JSON.parse(sessionStorage.getItem(STORE) ?? "null") as Saved | null;
        if (saved) {
          setDraft({ ...EMPTY_DRAFT, ...saved.draft });
          setFilled(new Set(saved.filled));
          setText(saved.text);
          setMode(saved.mode);
          setResult(saved.result);
          // Opened from the phone-call demo: go straight to the results.
          if (saved.result && window.location.hash === "#results") {
            setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 350);
          }
        }
      } catch {
        /* nothing saved */
      }
    }
    setRestored(true);
    api.capabilities().then((c) => setVoiceAvailable(c.capabilities.voice)).catch(() => setVoiceAvailable(false));
  }, []);

  useEffect(() => {
    if (!restored) return;
    try {
      const saved: Saved = { draft, filled: [...filled], text, mode, result };
      sessionStorage.setItem(STORE, JSON.stringify(saved));
    } catch {
      /* quota or blocked storage: the page still works */
    }
  }, [draft, filled, text, mode, result, restored]);

  const applyExtraction = useCallback(
    (ex: Extraction, via: "voice" | "text") => {
      const { draft: next, changed } = mergeExtraction(draft, ex.fields);
      setDraft(next);
      setFilled((prev) => new Set([...prev, ...changed]));
      setMode(via);
      setResult(null);
      const recognized = Object.keys(ex.fields).length;
      setNotice({
        kind: recognized ? "ok" : "warn",
        text: recognized ? fmt(t.check.filledNote, { n: recognized }) : t.check.nothingFilled,
      });
      formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    },
    [draft, t],
  );

  const onAudio = async (audio: Blob, language: string) => {
    setBusy("voice");
    setNotice(null);
    try {
      const ex = await api.extractVoice(audio, language);
      setText(ex.transcript);
      if (!ex.transcript) setNotice({ kind: "warn", text: ex.warning ?? t.check.nothingFilled });
      else applyExtraction(ex, "voice");
    } catch (err) {
      // NFR-03: speech failing never blocks the typed path.
      setNotice({ kind: "warn", text: err instanceof ApiError && err.status === 503 ? t.check.voiceUnavailable : `${t.check.voiceUnavailable} (${(err as Error).message})` });
    } finally {
      setBusy(null);
    }
  };

  const onFillFromText = async () => {
    setBusy("text");
    setNotice(null);
    try {
      applyExtraction(await api.extractText(text), "text");
    } catch (err) {
      setNotice({ kind: "err", text: err instanceof ApiError && err.status === 0 ? t.schemes.loadError : (err as Error).message });
    } finally {
      setBusy(null);
    }
  };

  const onChange = (k: Key, value: string | boolean) => {
    setDraft((d) => ({ ...d, [k]: value }));
    // An edited value is the citizen's own now, not an auto-filled guess.
    setFilled((prev) => {
      if (!prev.has(k)) return prev;
      const next = new Set(prev);
      next.delete(k);
      return next;
    });
  };

  const find = async () => {
    const missing = REQUIRED.filter((k) => !String(draft[k]).trim());
    if (missing.length) {
      const f = t.check.fields as Record<string, string>;
      setNotice({ kind: "err", text: fmt(t.check.missing, { fields: missing.map((k) => f[k]).join(", ") }) });
      formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    setMatching(true);
    setNotice(null);
    try {
      const res = await api.match(draftToProfile(draft), mode);
      setResult(res);
      requestAnimationFrame(() => resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
    } catch (err) {
      const body = err instanceof ApiError ? (err.body as { missing?: string[] } | null) : null;
      setNotice({ kind: "err", text: err instanceof ApiError && err.status === 0 ? t.schemes.loadError : body?.missing?.length ? fmt(t.check.missing, { fields: body.missing.join(", ") }) : (err as Error).message });
    } finally {
      setMatching(false);
    }
  };

  const reset = () => {
    setDraft(EMPTY_DRAFT);
    setFilled(new Set());
    setText("");
    setMode("form");
    setResult(null);
    setNotice(null);
    window.history.replaceState(null, "", "/check");
  };

  return (
    <EdPage id="check-page">
      <Hero dev="जानिए, आप किन योजनाओं के हक़दार हैं" en="Find the schemes you're entitled to" sub={t.check.intro} cta={{ label: t.check.heroCta, href: "#start" }} />
      <section className="tool-sec" id="start">
      <div className="wrap hq-stack">
        <DescribeCard text={text} onTextChange={setText} onAudio={onAudio} onFillFromText={onFillFromText} busy={busy} voiceAvailable={voiceAvailable} />

        <section ref={formRef} className="hq-card" aria-labelledby="form-title" style={{ scrollMarginTop: 128 }}>
          <div className="hq-row" style={{ justifyContent: "space-between" }}>
            <h2 id="form-title" className="hq-h3">{t.check.step2}</h2>
            <button type="button" className="hq-btn-ghost" onClick={reset}>
              <RotateCcw size={16} aria-hidden /> {t.check.reset}
            </button>
          </div>
          {notice && (
            <p className={`hq-notice ${notice.kind}`} role={notice.kind === "err" ? "alert" : "status"} style={{ marginTop: 14 }}>
              {notice.text}
            </p>
          )}
          <ProfileForm draft={draft} filled={filled} onChange={onChange} />
          <div style={{ marginTop: 28, display: "flex", justifyContent: "flex-end" }}>
            <button type="button" className="hq-btn hq-btn-lg" onClick={find} disabled={matching || busy !== null}>
              {matching ? <Loader2 size={22} className="spin" aria-hidden /> : <Search size={22} aria-hidden />}
              {matching ? t.check.finding : t.check.find}
            </button>
          </div>
        </section>

        <div ref={resultsRef} style={{ scrollMarginTop: 128 }}>
          {result && <Results data={result} onEdit={() => formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })} />}
        </div>
      </div>
      </section>
      <Footer callbar={false} />
      <style>{`.spin{animation:hq-spin 1s linear infinite}@keyframes hq-spin{to{transform:rotate(360deg)}}`}</style>
    </EdPage>
  );
}
