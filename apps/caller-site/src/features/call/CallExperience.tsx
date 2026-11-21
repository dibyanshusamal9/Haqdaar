"use client";

import { KeyboardEvent, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Grid3x3, Loader2, Mic, MicOff, PhoneOff, Send, Volume2, X } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageContext";
import { fmt } from "@/i18n/translations";
import { EMPTY_DRAFT, mergeExtraction } from "@/api/haqdaar";
import { CALL_FIELDS, CallLanguage, CallReply, CallState, MENU_LANGUAGES, NEW_CALL, callListen, callTurn } from "@/api/call";

/**
 * The phone-line demo: an IVR call in the browser. The agent speaks (Sarvam's voice, or
 * the device's own when that is unavailable); after a question the mic listens by itself
 * and sends the answer when the caller pauses. A keypad handles the language menu and
 * digits, and typing always works. Answers are read and matched by the API, which asks
 * only for what it does not know yet.
 */

type Phase = "connecting" | "menu" | "live" | "ended";
type Line = { id: string; who: "agent" | "caller"; text: string };
type Clip = { url: string } | { text: string; language: CallLanguage };

const SILENCE_MS = 1700;       // pause that ends a spoken answer
const VAD_INTERVAL_MS = 100;   // how often the mic level is checked
const MIN_SPEECH_MS = 250;     // this much sound means the caller is speaking
const MAX_ANSWER_MS = 30000;   // longest single answer
const MENU_TIMEOUT_MS = 9000;  // no key pressed: continue in the site's language

const LOCALE: Record<CallLanguage, string> = { en: "en-IN", hi: "hi-IN", bn: "bn-IN", mr: "mr-IN", od: "or-IN" };
const DIGIT_PAUSE_MS = 2000; // keyed digits are sent once the caller stops pressing keys
const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "*", "0", "#"];
// DTMF tone pairs, so the keypad sounds like a phone's.
const DTMF: Record<string, [number, number]> = {
  "1": [697, 1209], "2": [697, 1336], "3": [697, 1477], "4": [770, 1209], "5": [770, 1336], "6": [770, 1477],
  "7": [852, 1209], "8": [852, 1336], "9": [852, 1477], "*": [941, 1209], "0": [941, 1336], "#": [941, 1477],
};
const CHECK_STORE = "haqdaar_check_v1";

function deviceVoice(language: CallLanguage): SpeechSynthesisVoice | null {
  if (typeof window === "undefined" || !window.speechSynthesis) return null;
  const want = LOCALE[language].toLowerCase();
  const tag = (v: SpeechSynthesisVoice) => v.lang.toLowerCase().replace("_", "-");
  const voices = window.speechSynthesis.getVoices();
  return voices.find((v) => tag(v) === want) || voices.find((v) => tag(v).startsWith(want.split("-")[0])) || null;
}

// The parts of the Web Speech API recogniser this screen uses (Chrome and Edge ship it).
interface Recognizer {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  abort(): void;
}

function browserRecognizer(): (new () => Recognizer) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: new () => Recognizer; webkitSpeechRecognition?: new () => Recognizer };
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

function newAudioContext(): AudioContext {
  const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  return new Ctor();
}

/**
 * Watches the mic level and calls `onEnd` once the caller has spoken and then paused
 * (or the answer runs too long). The noise floor adapts, so a fan or traffic is not speech.
 */
function watchForPause(analyser: AnalyserNode, onEnd: (spoke: boolean) => void): ReturnType<typeof setInterval> {
  const samples = new Float32Array(analyser.fftSize);
  const startedAt = performance.now();
  let lastSound = startedAt;
  let soundMs = 0;
  let spoke = false;
  let noise = 0.01;
  return setInterval(() => {
    analyser.getFloatTimeDomainData(samples);
    let sum = 0;
    for (let i = 0; i < samples.length; i++) sum += samples[i] * samples[i];
    const level = Math.sqrt(sum / samples.length);
    const now = performance.now();
    if (level > Math.max(0.02, noise * 3)) {
      soundMs += VAD_INTERVAL_MS;
      lastSound = now;
      if (soundMs >= MIN_SPEECH_MS) spoke = true;
    } else {
      noise = noise * 0.95 + level * 0.05;
      if (!spoke) soundMs = 0;
    }
    if ((spoke && now - lastSound > SILENCE_MS) || now - startedAt > MAX_ANSWER_MS) onEnd(spoke);
  }, VAD_INTERVAL_MS);
}

const formatTime = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

export default function CallExperience({ onClose }: { onClose: () => void }) {
  const { t, language: siteLanguage } = useLanguage();
  const c = t.call;

  const [phase, setPhase] = useState<Phase>("connecting");
  const [callLang, setCallLang] = useState<CallLanguage>(siteLanguage === "en" ? "en" : "hi");
  const [seconds, setSeconds] = useState(0);
  const [lines, setLines] = useState<Line[]>([]);
  const [caption, setCaption] = useState("");
  const [state, setState] = useState<CallState>(NEW_CALL);
  const [flash, setFlash] = useState<string[]>([]);
  const [match, setMatch] = useState<CallReply["match"] | null>(null);
  const [input, setInput] = useState("");
  const [keypad, setKeypad] = useState(false);
  const [busy, setBusy] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [listening, setListening] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [micOn, setMicOn] = useState(true);
  const [micSupported, setMicSupported] = useState(true);
  const [notice, setNotice] = useState<{ kind: "warn" | "err"; text: string } | null>(null);
  // Read once on open (this screen only renders in the browser).
  const [reduceMotion] = useState(() => window.matchMedia("(prefers-reduced-motion: reduce)").matches);

  // Values read from callbacks that outlive a render (audio, recorder, timers).
  const langRef = useRef<CallLanguage>(callLang);
  const stateRef = useRef<CallState>(NEW_CALL);
  const liveRef = useRef(true);
  const busyRef = useRef(false);
  const micOnRef = useRef(true);
  const awaitingRef = useRef(false);   // the agent's last line asked something
  const wantListenRef = useRef(false);
  const queueRef = useRef<Clip[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const utterRef = useRef<SpeechSynthesisUtterance | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const vadRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const browserSttRef = useRef(false);
  const recognitionRef = useRef<Recognizer | null>(null);
  const menuTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const digitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const keyedRef = useRef("");
  const transcriptRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  const say = (who: Line["who"], text: string) =>
    setLines((prev) => [...prev, { id: `${Date.now()}-${prev.length}`, who, text }]);

  // ---------------------------------------------------------------- tones & voice

  const tone = (key: string) => {
    try {
      const ctx = ctxRef.current ?? newAudioContext();
      ctxRef.current = ctx;
      const gain = ctx.createGain();
      gain.gain.value = 0.06;
      gain.connect(ctx.destination);
      for (const f of DTMF[key] ?? [440, 480]) {
        const osc = ctx.createOscillator();
        osc.frequency.value = f;
        osc.connect(gain);
        osc.start();
        osc.stop(ctx.currentTime + 0.12);
      }
    } catch {
      /* no audio context: the keypress still counts */
    }
  };

  const stopAudio = () => {
    queueRef.current = [];
    const audio = audioRef.current;
    audioRef.current = null;
    if (audio) {
      audio.onended = null;
      audio.onerror = null;
      audio.pause();
    }
    if (utterRef.current) {
      utterRef.current = null;
      window.speechSynthesis.cancel();
    }
    setSpeaking(false);
  };

  // Clips play one after another; when the last ends and a question was asked, listen.
  const playNext = (): void => {
    if (audioRef.current || utterRef.current) return;
    const clip = queueRef.current.shift();
    if (!clip) {
      setSpeaking(false);
      if (awaitingRef.current) fns.current.startListening();
      return;
    }
    setSpeaking(true);
    if ("text" in clip) {
      const voice = deviceVoice(clip.language);
      if (!voice) {
        fns.current.playNext();
        return;
      }
      const u = new SpeechSynthesisUtterance(clip.text);
      u.voice = voice;
      u.lang = voice.lang;
      utterRef.current = u;
      const done = () => {
        if (utterRef.current !== u) return;
        utterRef.current = null;
        fns.current.playNext();
      };
      u.onend = done;
      u.onerror = done;
      window.speechSynthesis.speak(u);
      return;
    }
    const audio = new Audio(clip.url);
    audioRef.current = audio;
    const done = () => {
      if (audioRef.current !== audio) return;
      audioRef.current = null;
      fns.current.playNext();
    };
    audio.onended = done;
    audio.onerror = done;
    audio.play().catch(done);
  };

  const queueVoice = (reply: Pick<CallReply, "audio" | "voice">) => {
    if (reply.audio?.length) {
      for (const clip of reply.audio) queueRef.current.push({ url: `data:audio/wav;base64,${clip}` });
    } else {
      // No recording from the server: the device reads each sentence (long utterances get
      // cut off in some browsers); with no voice for the language, the caller reads.
      let spoken = false;
      for (const part of reply.voice) {
        if (!deviceVoice(part.language)) continue;
        spoken = true;
        for (const sentence of part.text.split(/(?<=[.!?।])\s+/)) {
          if (sentence.trim()) queueRef.current.push({ text: sentence.trim(), language: part.language });
        }
      }
      if (!spoken) setNotice({ kind: "warn", text: c.voiceOff });
    }
    fns.current.playNext();
  };

  // ---------------------------------------------------------------- microphone

  const stopListening = () => {
    wantListenRef.current = false;
    if (vadRef.current) clearInterval(vadRef.current);
    vadRef.current = null;
    const recorder = recorderRef.current;
    recorderRef.current = null;
    if (recorder) {
      recorder.onstop = null;
      try { recorder.stop(); } catch { /* already stopped */ }
    }
    chunksRef.current = [];
    const recognition = recognitionRef.current;
    recognitionRef.current = null;
    if (recognition) {
      try { recognition.abort(); } catch { /* already stopped */ }
    }
    setListening(false);
  };

  const releaseMic = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    analyserRef.current = null;
  };

  const micOff = (text: string) => {
    setNotice({ kind: "err", text });
    micOnRef.current = false;
    setMicOn(false);
    wantListenRef.current = false;
  };

  const startListening = () => {
    if (!micOnRef.current || !liveRef.current || busyRef.current || wantListenRef.current) return;
    wantListenRef.current = true;
    void fns.current.startRecording();
  };

  // Record, notice from the mic level when the caller has spoken and paused, then have
  // Sarvam transcribe the answer in the call's language.
  const startRecording = async (): Promise<void> => {
    if (browserSttRef.current) {
      fns.current.startBrowserRecognition();
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia || typeof window.MediaRecorder === "undefined") {
      setMicSupported(false);
      micOnRef.current = false;
      setMicOn(false);
      return;
    }
    try {
      if (!streamRef.current) {
        streamRef.current = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        });
      }
      if (!ctxRef.current) ctxRef.current = newAudioContext();
      if (!analyserRef.current) {
        const analyser = ctxRef.current.createAnalyser();
        analyser.fftSize = 2048;
        ctxRef.current.createMediaStreamSource(streamRef.current).connect(analyser);
        analyserRef.current = analyser;
      }
      if (ctxRef.current.state === "suspended") await ctxRef.current.resume();
    } catch (err) {
      micOff((err as DOMException)?.name === "NotAllowedError" ? c.micBlocked : c.micMissing);
      return;
    }
    if (!wantListenRef.current || recorderRef.current || !streamRef.current || !analyserRef.current) return;

    const mimeType = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus"].find((m) => MediaRecorder.isTypeSupported(m));
    const recorder = mimeType ? new MediaRecorder(streamRef.current, { mimeType }) : new MediaRecorder(streamRef.current);
    chunksRef.current = [];
    recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
    recorderRef.current = recorder;
    recorder.start(250);
    setListening(true);

    vadRef.current = watchForPause(analyserRef.current, (spoke) => fns.current.finishRecording(spoke));
  };

  const finishRecording = (send: boolean) => {
    if (vadRef.current) clearInterval(vadRef.current);
    vadRef.current = null;
    const recorder = recorderRef.current;
    recorderRef.current = null;
    setListening(false);
    if (!recorder) return;
    recorder.onstop = async () => {
      const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
      chunksRef.current = [];
      if (!wantListenRef.current) return;
      if (!send) return void fns.current.startRecording();
      setTranscribing(true);
      let heard = { text: "", available: true };
      try {
        heard = await callListen(blob, langRef.current);
      } catch {
        heard = { text: "", available: false };
      } finally {
        setTranscribing(false);
      }
      if (!wantListenRef.current) return;
      if (heard.text) fns.current.answer(heard.text);
      else if (!heard.available) {
        if (browserRecognizer()) {
          browserSttRef.current = true;
          setNotice({ kind: "warn", text: c.sttFallback });
          void fns.current.startRecording();
        } else micOff(c.sttOff);
      } else {
        setNotice({ kind: "warn", text: c.notCaught });
        void fns.current.startRecording();
      }
    };
    try { recorder.stop(); } catch { /* already stopped */ }
  };

  // Fallback when Sarvam can't transcribe: the browser's recogniser hears one answer.
  const startBrowserRecognition = (): void => {
    const Recognition = browserRecognizer();
    if (!wantListenRef.current || recognitionRef.current) return;
    if (!Recognition) return micOff(c.sttOff);
    const recognition = new Recognition();
    recognition.lang = LOCALE[langRef.current];
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognitionRef.current = recognition;
    let heard = "";
    recognition.onresult = (e) => { heard = (e.results?.[0]?.[0]?.transcript || "").trim(); };
    recognition.onerror = (e) => {
      if (e.error === "no-speech" || e.error === "aborted") return;
      recognitionRef.current = null;
      setListening(false);
      browserSttRef.current = false;
      micOff(e.error === "not-allowed" ? c.micBlocked : c.sttOff);
    };
    recognition.onend = () => {
      if (recognitionRef.current !== recognition) return;
      recognitionRef.current = null;
      setListening(false);
      if (!wantListenRef.current) return;
      if (heard) fns.current.answer(heard);
      else setTimeout(() => fns.current.startRecording(), 300);
    };
    try {
      recognition.start();
      setListening(true);
    } catch {
      recognitionRef.current = null;
      micOff(c.sttOff);
    }
  };

  // ---------------------------------------------------------------- the call

  const endCall = () => {
    liveRef.current = false;
    awaitingRef.current = false;
    if (menuTimerRef.current) clearTimeout(menuTimerRef.current);
    stopListening();
    stopAudio();
    releaseMic();
    setPhase("ended");
  };

  const apply = (reply: CallReply) => {
    const next: CallState = { asked: reply.asked, attempt: reply.attempt, profile: reply.profile, interests: reply.interests ?? [], skipped: reply.skipped };
    stateRef.current = next;
    setState(next);
    setFlash(reply.filled);
    setCaption(reply.say);
    say("agent", reply.say);
    if (reply.match) setMatch(reply.match);
    awaitingRef.current = !reply.done;
    if (reply.done) {
      liveRef.current = false;
      stopListening();
      releaseMic();
      setPhase("ended");
    }
    queueVoice(reply);
  };

  const send = async (stage: "start" | "answer", text = "") => {
    awaitingRef.current = false;
    busyRef.current = true;
    setBusy(true);
    try {
      apply(await callTurn(stage, langRef.current, stateRef.current, text));
    } catch {
      say("agent", c.serverError);
      setNotice({ kind: "err", text: c.serverError });
      awaitingRef.current = true;
    } finally {
      busyRef.current = false;
      setBusy(false);
      if (awaitingRef.current && !audioRef.current && !utterRef.current && !queueRef.current.length) startListening();
    }
  };

  const chooseLanguage = (lang: CallLanguage) => {
    if (menuTimerRef.current) clearTimeout(menuTimerRef.current);
    menuTimerRef.current = null;
    stopAudio();
    langRef.current = lang;
    setCallLang(lang);
    setPhase("live");
    void fns.current.send("start");
  };

  // A spoken or typed answer.
  const answer = (text: string) => {
    if (!text || busyRef.current || !liveRef.current) return;
    stopListening();
    stopAudio();
    setNotice(null);
    say("caller", text);
    void fns.current.send("answer", text);
  };

  // The latest version of each step, for callbacks that outlive a render (audio, recorder, timers).
  const fns = useRef({ playNext, startListening, startRecording, finishRecording, startBrowserRecognition, answer, send });
  useEffect(() => {
    fns.current = { playNext, startListening, startRecording, finishRecording, startBrowserRecognition, answer, send };
  });

  // Ring, then the language menu. (Safe to run twice: development mounts effects twice.)
  useEffect(() => {
    liveRef.current = true;
    window.speechSynthesis?.getVoices(); // voices load lazily; ask early
    const ring = setTimeout(async () => {
      if (!liveRef.current) return;
      setPhase("menu");
      try {
        const reply = await callTurn("menu", langRef.current, NEW_CALL);
        if (!liveRef.current) return;
        setCaption(reply.say);
        say("agent", reply.say);
        queueVoice(reply);
      } catch {
        say("agent", c.serverError);
        setNotice({ kind: "err", text: c.serverError });
      }
      menuTimerRef.current = setTimeout(() => {
        if (liveRef.current) chooseLanguage(langRef.current);
      }, MENU_TIMEOUT_MS);
    }, 1600);
    const clock = setInterval(() => { if (liveRef.current) setSeconds((s) => s + 1); }, 1000);
    return () => {
      clearTimeout(ring);
      clearInterval(clock);
      liveRef.current = false;
      if (menuTimerRef.current) clearTimeout(menuTimerRef.current);
      if (digitTimerRef.current) clearTimeout(digitTimerRef.current);
      wantListenRef.current = false;
      if (vadRef.current) clearInterval(vadRef.current);
      try { recorderRef.current?.stop(); } catch { /* stopped */ }
      recorderRef.current = null;
      try { recognitionRef.current?.abort(); } catch { /* stopped */ }
      recognitionRef.current = null;
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      ctxRef.current?.close().catch(() => undefined);
      ctxRef.current = null;
      analyserRef.current = null;
      audioRef.current?.pause();
      audioRef.current = null;
      queueRef.current = [];
      window.speechSynthesis?.cancel();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Escape closes; focus starts inside the dialog.
  useEffect(() => {
    dialogRef.current?.focus();
    const onKey = (e: globalThis.KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    transcriptRef.current?.scrollTo({ top: transcriptRef.current.scrollHeight, behavior: "smooth" });
  }, [lines]);

  useEffect(() => {
    if (!flash.length) return;
    const id = setTimeout(() => setFlash([]), 1400);
    return () => clearTimeout(id);
  }, [flash]);

  // ---------------------------------------------------------------- controls

  const menuChoice = (key: string) => MENU_LANGUAGES.find((m) => m.key === key)?.language;

  // Keyed digits go once the caller stops pressing keys (no # needed); # sends at once.
  const sendKeyed = () => {
    if (digitTimerRef.current) clearTimeout(digitTimerRef.current);
    digitTimerRef.current = null;
    const typed = keyedRef.current;
    keyedRef.current = "";
    setInput("");
    if (typed) fns.current.answer(typed);
  };

  const press = (key: string) => {
    tone(key);
    if (phase === "menu") {
      const language = menuChoice(key);
      if (language) chooseLanguage(language);
      return;
    }
    if (phase !== "live") return;
    if (wantListenRef.current) stopListening();
    if (digitTimerRef.current) clearTimeout(digitTimerRef.current);
    if (key === "#") return sendKeyed();
    keyedRef.current = key === "*" ? "" : keyedRef.current + key;
    setInput(keyedRef.current);
    if (keyedRef.current) digitTimerRef.current = setTimeout(sendKeyed, DIGIT_PAUSE_MS);
  };

  const submitTyped = () => {
    const text = input.trim();
    if (!text) return;
    if (phase === "menu") {
      const language = menuChoice(text);
      if (language) chooseLanguage(language);
      setInput("");
      return;
    }
    if (digitTimerRef.current) clearTimeout(digitTimerRef.current);
    keyedRef.current = "";
    setInput("");
    answer(text);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => { if (e.key === "Enter") submitTyped(); };

  const onType = (value: string) => {
    if (wantListenRef.current) stopListening();
    // Typing takes over from keyed digits.
    if (digitTimerRef.current) clearTimeout(digitTimerRef.current);
    keyedRef.current = "";
    setInput(value);
  };

  // The big mic button: interrupt the agent and answer, or mute / unmute.
  const onMic = () => {
    if (!micSupported || phase !== "live") return;
    if (speaking) {
      stopAudio();
      micOnRef.current = true;
      setMicOn(true);
      awaitingRef.current = true;
      startListening();
      return;
    }
    if (micOn) {
      micOnRef.current = false;
      setMicOn(false);
      stopListening();
    } else {
      micOnRef.current = true;
      setMicOn(true);
      setNotice(null);
      if (awaitingRef.current) startListening();
    }
  };

  // The full results, with reasons, open on the check page as if the form had been used.
  const seeAll = () => {
    if (!match) return;
    const { draft, changed } = mergeExtraction(EMPTY_DRAFT, stateRef.current.profile as Record<string, string | number | boolean>);
    try {
      sessionStorage.setItem(CHECK_STORE, JSON.stringify({ draft, filled: changed, text: "", mode: "voice", result: match.full }));
    } catch {
      /* storage blocked: the check page opens empty */
    }
    // A full page load, so the check page reads the stored results even if it is already open.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.assign("/check#results");
  };

  const micStatus = !micSupported ? c.micUnsupported
    : phase === "menu" ? c.menuHint
    : speaking ? c.speaking
    : transcribing ? c.recognising
    : busy ? c.thinking
    : !micOn ? c.micOff
    : listening ? c.listening
    : c.micOn;

  const fieldLabel = (f: string) => (f === "interest" ? c.interest : (t.check.fields as Record<string, string>)[f] ?? f);
  const fieldValue = (f: string): string | null => {
    if (f === "interest") return state.interests.length ? state.interests.join(", ") : null;
    const v = state.profile[f];
    if (v === undefined || v === null || v === "") return null;
    if (f === "annual_income") return `₹${Number(v).toLocaleString("en-IN")}`;
    if (f === "age" || f === "state") return String(v);
    return t.options[f]?.[String(v)] ?? String(v);
  };

  const statusLabel = phase === "connecting" ? c.connecting : phase === "ended" ? c.ended : c.live;

  return (
    <motion.div
      ref={dialogRef}
      className="hq-call"
      role="dialog"
      aria-modal="true"
      aria-label={c.title}
      tabIndex={-1}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <div className="hq-call-bg" aria-hidden />
      <button type="button" className="hq-call-close" onClick={onClose} aria-label={c.close}>
        <X size={22} aria-hidden />
      </button>

      <div className="hq-call-grid">
        {/* Transcript */}
        <motion.section
          className="hq-call-panel hq-call-transcript"
          aria-label={c.transcript}
          initial={{ opacity: 0, x: -24 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.6, duration: 0.6 }}
        >
          <h3 className="hq-call-eyebrow">{c.transcript}</h3>
          <div ref={transcriptRef} className="hq-call-lines">
            {lines.map((l) => (
              <motion.div key={l.id} className={`hq-call-line ${l.who}`} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                <span className="who">{l.who === "agent" ? c.agent : c.you}</span>
                <p>{l.text}</p>
              </motion.div>
            ))}
          </div>
        </motion.section>

        {/* Phone */}
        <motion.div
          className="hq-phone"
          initial={reduceMotion ? false : { y: 120, scale: 0.92, opacity: 0 }}
          animate={{ y: 0, scale: 1, opacity: 1 }}
          transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className="hq-phone-notch" aria-hidden />
          <div className={`hq-phone-screen ${keypad || phase === "menu" ? "compact" : ""}`}>
            <div className="hq-phone-status">
              <span className={`dot ${phase}`} aria-hidden />
              <span>{statusLabel}</span>
              {phase !== "connecting" && <span className="time">{formatTime(seconds)}</span>}
            </div>

            <div className="hq-phone-id">
              <motion.div
                className={`hq-phone-avatar ${phase === "live" ? "live" : ""}`}
                animate={phase === "live" && !reduceMotion ? { scale: [1, 1.05, 1] } : { scale: 1 }}
                transition={{ repeat: Infinity, duration: 2.2, ease: "easeInOut" }}
              >
                <span lang="hi">ह</span>
              </motion.div>
              <strong>{c.title}</strong>
              <small>{c.subtitle}</small>
            </div>

            <div className="hq-phone-caption" aria-live="polite" lang={phase === "menu" ? undefined : callLang}>
              {caption}
            </div>

            {phase !== "ended" ? (
              <div className="hq-phone-controls">
                <AnimatePresence>
                  {notice && (
                    <motion.p
                      className={`hq-phone-notice ${notice.kind}`}
                      role="status"
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                    >
                      {notice.text}
                    </motion.p>
                  )}
                </AnimatePresence>

                {(keypad || phase === "menu") && (
                  <div className="hq-keypad" role="group" aria-label={c.keypad}>
                    {KEYS.map((k) => (
                      <button
                        key={k}
                        type="button"
                        onClick={() => press(k)}
                        className={phase === "menu" && menuChoice(k) ? "hot" : ""}
                        disabled={phase === "live" && busy}
                      >
                        {k}
                        {phase === "menu" && MENU_LANGUAGES.filter((m) => m.key === k).map((m) => (
                          <small key={m.key} lang={m.language === "od" ? "or" : m.language}>{m.name}</small>
                        ))}
                      </button>
                    ))}
                  </div>
                )}

                {phase === "live" && (
                  <div className="hq-phone-mic">
                    <div className="ring">
                      {listening && !reduceMotion && (
                        <motion.span
                          className="pulse"
                          animate={{ scale: [1, 1.5], opacity: [0.45, 0] }}
                          transition={{ repeat: Infinity, duration: 1.4, ease: "easeOut" }}
                          aria-hidden
                        />
                      )}
                      <button
                        type="button"
                        onClick={onMic}
                        disabled={!micSupported}
                        aria-label={`${c.mute}. ${micStatus}`}
                        className={speaking ? "speaking" : listening ? "listening" : micOn ? "on" : "off"}
                      >
                        {speaking ? <Volume2 size={26} aria-hidden />
                          : busy || transcribing ? <Loader2 size={26} className="hq-spin" aria-hidden />
                          : micOn && micSupported ? <Mic size={26} aria-hidden /> : <MicOff size={26} aria-hidden />}
                      </button>
                    </div>
                  </div>
                )}
                <span className={`hq-phone-hint ${listening ? "on" : ""}`} aria-live="polite">
                  {keypad && phase === "live" ? c.keypadHint : micStatus}
                </span>

                <div className={`hq-phone-input ${listening ? "listening" : ""}`}>
                  <input
                    type="text"
                    value={input}
                    onChange={(e) => onType(e.target.value)}
                    onKeyDown={onKeyDown}
                    placeholder={c.typePlaceholder}
                    disabled={busy || phase === "connecting"}
                    aria-label={c.typePlaceholder}
                    lang={callLang}
                  />
                  <button type="button" onClick={submitTyped} disabled={!input.trim() || busy} aria-label={c.send}>
                    <Send size={15} aria-hidden />
                  </button>
                </div>

                <div className="hq-phone-actions">
                  <button
                    type="button"
                    className={`hq-phone-round ${keypad ? "active" : ""}`}
                    onClick={() => setKeypad((k) => !k)}
                    disabled={phase !== "live"}
                    aria-pressed={keypad}
                    aria-label={c.keypad}
                  >
                    <Grid3x3 size={20} aria-hidden />
                  </button>
                  <button type="button" className="hq-phone-round end" onClick={endCall} aria-label={c.endCall}>
                    <PhoneOff size={22} aria-hidden />
                  </button>
                </div>
              </div>
            ) : (
              <div className="hq-phone-controls ended">
                {match && match.counts.total > 0 && (
                  <button type="button" className="hq-phone-primary" onClick={seeAll}>
                    {fmt(c.seeAll, { n: match.counts.total })}
                  </button>
                )}
                <button type="button" className="hq-phone-secondary" onClick={onClose}>{c.close}</button>
              </div>
            )}
          </div>
        </motion.div>

        {/* What has been understood, then the results */}
        <motion.section
          className="hq-call-panel hq-call-side"
          aria-label={c.understood}
          initial={{ opacity: 0, x: 24 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.6, duration: 0.6 }}
        >
          <h3 className="hq-call-eyebrow">{c.understood}</h3>
          <div className="hq-call-fields">
            {CALL_FIELDS.map((f) => {
              const value = fieldValue(f);
              const skipped = state.skipped.includes(f);
              return (
                <div key={f} className={`hq-call-field ${value ? "set" : ""} ${state.asked === f && phase === "live" ? "asking" : ""}`}>
                  <span>{fieldLabel(f)}</span>
                  <strong>{value ?? (skipped ? c.skipped : "—")}</strong>
                  <AnimatePresence>
                    {flash.includes(f) && (
                      <motion.i className="flash" initial={{ opacity: 1 }} animate={{ opacity: 0 }} transition={{ duration: 1.2 }} aria-hidden />
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>

          <AnimatePresence>
            {match && (
              <motion.div
                className="hq-call-results"
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ type: "spring", stiffness: 110, damping: 20 }}
              >
                <div className="head">
                  <h3 className="hq-call-eyebrow">{c.results}</h3>
                  <span>{fmt(c.counts, { e: match.counts.eligible, l: match.counts.likely })}</span>
                </div>
                {match.results.length === 0 && <p className="empty">{c.none}</p>}
                {match.results.slice(0, 3).map((r) => (
                  <a key={r.slug} className="hq-call-scheme" href={`/schemes/${r.slug}`} target="_blank" rel="noreferrer">
                    <span className={`chip ${r.status}`}>{r.status === "eligible" ? c.eligible : c.likely}</span>
                    <strong>{r.name}</strong>
                    {r.reasons[0] && <small>{r.reasons[0].why}</small>}
                  </a>
                ))}
                {match.counts.total > 0 && (
                  <button type="button" className="hq-call-all" onClick={seeAll}>
                    {fmt(c.seeAll, { n: match.counts.total })} →
                  </button>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </motion.section>
      </div>

      <p className="hq-call-note">{c.demoNote} {c.privacy}</p>
    </motion.div>
  );
}
