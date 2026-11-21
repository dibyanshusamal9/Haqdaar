"use client";

import { useEffect, useRef, useState } from "react";
import { Mic, Square, Loader2, Wand2 } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageContext";
import { VOICE_LANGUAGES } from "@/i18n/types";

const MAX_RECORDING_MS = 60_000;

function pickMimeType(): string {
  if (typeof MediaRecorder === "undefined") return "";
  for (const t of ["audio/webm;codecs=opus", "audio/ogg;codecs=opus", "audio/webm", "audio/mp4"]) {
    if (MediaRecorder.isTypeSupported(t)) return t;
  }
  return "";
}

interface Props {
  text: string;
  onTextChange: (v: string) => void;
  onAudio: (audio: Blob, language: string) => Promise<void>;
  onFillFromText: () => Promise<void>;
  busy: "voice" | "text" | null;
  voiceAvailable: boolean;
}

/** UC-02: speak or type. Whatever was heard lands in an editable box (FR-04). */
export default function DescribeCard({ text, onTextChange, onAudio, onFillFromText, busy, voiceAvailable }: Props) {
  const { t, language } = useLanguage();
  const [voiceLang, setVoiceLang] = useState<string>(language === "en" ? "en" : "hi");
  const [recording, setRecording] = useState(false);
  const [micError, setMicError] = useState<string | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    recorderRef.current?.stream.getTracks().forEach((tr) => tr.stop());
  }, []);

  const start = async () => {
    setMicError(null);
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setMicError(t.check.voiceUnavailable);
      return;
    }
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setMicError(t.check.micDenied);
      return;
    }
    const mimeType = pickMimeType();
    const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    const chunks: Blob[] = [];
    recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    recorder.onstop = () => {
      stream.getTracks().forEach((tr) => tr.stop());
      setRecording(false);
      if (timerRef.current) clearTimeout(timerRef.current);
      const blob = new Blob(chunks, { type: recorder.mimeType || "audio/webm" });
      if (blob.size > 0) void onAudio(blob, voiceLang);
    };
    recorderRef.current = recorder;
    recorder.start();
    setRecording(true);
    timerRef.current = setTimeout(() => recorder.state === "recording" && recorder.stop(), MAX_RECORDING_MS);
  };

  const stop = () => recorderRef.current?.state === "recording" && recorderRef.current.stop();

  const micLabel = busy === "voice" ? t.check.processing : recording ? t.check.stop : t.check.record;

  return (
    <section className="hq-card" aria-labelledby="describe-title">
      <h2 id="describe-title" className="hq-h3" style={{ marginBottom: 6 }}>{t.check.step1}</h2>
      <div className="hq-split" style={{ marginTop: 14, alignItems: "start" }}>
        <div style={{ display: "grid", justifyItems: "center", gap: 14, textAlign: "center", padding: "8px 0" }}>
          <span className="hq-eyebrow">{t.check.voiceTitle}</span>
          <button
            type="button"
            className={`hq-mic ${recording ? "is-recording" : ""}`}
            onClick={recording ? stop : start}
            disabled={!voiceAvailable || busy !== null}
            aria-pressed={recording}
            aria-label={micLabel}
          >
            {busy === "voice" ? <Loader2 size={42} className="spin" aria-hidden /> : recording ? <Square size={38} aria-hidden /> : <Mic size={46} aria-hidden />}
          </button>
          <div aria-live="polite" style={{ fontWeight: 600, minHeight: 26 }}>
            {busy === "voice" ? t.check.processing : recording ? t.check.listening : micLabel}
          </div>
          <label className="hq-label" style={{ justifyContent: "center", fontWeight: 500 }}>
            {t.check.voiceLang}
            <select className="hq-select" style={{ width: "auto", minHeight: 44 }} value={voiceLang} onChange={(e) => setVoiceLang(e.target.value)} disabled={recording}>
              {VOICE_LANGUAGES.map((l) => (
                <option key={l.code} value={l.code} lang={l.code}>{l.nativeName}</option>
              ))}
            </select>
          </label>
          {(micError || !voiceAvailable) && <p className="hq-notice warn" role="status">{micError ?? t.check.voiceUnavailable}</p>}
          <p className="hq-muted hq-small" style={{ maxWidth: 380 }}>{t.check.voiceHint}</p>
        </div>

        <div style={{ display: "grid", gap: 10 }}>
          <label htmlFor="describe-text" className="hq-eyebrow">{text && busy !== "text" ? t.check.transcriptLabel : t.check.textTitle}</label>
          <textarea
            id="describe-text"
            className="hq-textarea"
            style={{ minHeight: 190 }}
            placeholder={t.check.textPlaceholder}
            value={text}
            onChange={(e) => onTextChange(e.target.value)}
            maxLength={4000}
          />
          <div>
            <button type="button" className="hq-btn" onClick={onFillFromText} disabled={!text.trim() || busy !== null}>
              {busy === "text" ? <Loader2 size={20} className="spin" aria-hidden /> : <Wand2 size={20} aria-hidden />}
              {t.check.fillFromText}
            </button>
          </div>
        </div>
      </div>
      <style>{`.spin{animation:hq-spin 1s linear infinite}@keyframes hq-spin{to{transform:rotate(360deg)}}`}</style>
    </section>
  );
}
