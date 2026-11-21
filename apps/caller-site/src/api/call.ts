// Client for the phone-call demo (apps/api src/call): one IVR turn at a time.

import { API_URL, ApiError, MatchResponse, MatchResult } from "./haqdaar";

export type CallLanguage = "hi" | "en" | "bn" | "mr" | "od";

/** The language menu: key -> language, in the order the call reads it out. */
export const MENU_LANGUAGES: { key: string; language: CallLanguage; name: string }[] = [
  { key: "1", language: "hi", name: "हिन्दी" },
  { key: "2", language: "en", name: "English" },
  { key: "3", language: "bn", name: "বাংলা" },
  { key: "4", language: "mr", name: "मराठी" },
  { key: "5", language: "od", name: "ଓଡ଼ିଆ" },
];
export type CallField = "age" | "gender" | "state" | "residence" | "caste" | "interest" | "occupation" | "annual_income";
export const CALL_FIELDS: CallField[] = ["age", "gender", "state", "residence", "caste", "interest", "occupation", "annual_income"];

export interface CallState {
  asked: CallField | "intro" | null;
  attempt: number;
  profile: Record<string, unknown>;
  /** myscheme categories the caller wants help with */
  interests: string[];
  skipped: CallField[];
}

export interface CallReply extends CallState {
  /** what the agent says, as shown on screen */
  say: string;
  /** base64 WAV clips to play in order; null when the server has no voice */
  audio: string[] | null;
  /** what the browser's own voice should read if there is no audio */
  voice: { text: string; language: CallLanguage }[];
  filled: string[];
  done: boolean;
  match?: {
    matchId: string;
    counts: MatchResponse["counts"];
    durationMs: number;
    /** how many of the results are in the caller's area of interest */
    inInterest: number;
    results: MatchResult[];
    full: MatchResponse;
  };
}

export const NEW_CALL: CallState = { asked: null, attempt: 0, profile: {}, interests: [], skipped: [] };

async function post<T>(path: string, init: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}/api${path}`, { method: "POST", ...init });
  } catch {
    throw new ApiError("Network error", 0, null);
  }
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(`HTTP ${res.status}`, res.status, body);
  return body as T;
}

export function callTurn(
  stage: "menu" | "start" | "answer",
  language: CallLanguage,
  state: CallState,
  text = "",
): Promise<CallReply> {
  return post<CallReply>("/call/turn", {
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ stage, language, text, ...state }),
  });
}

/** One recorded answer -> its transcript. `available: false` means the speech service is down. */
export function callListen(audio: Blob, language: CallLanguage): Promise<{ text: string; available: boolean }> {
  const form = new FormData();
  form.append("audio", audio, audio.type.includes("ogg") ? "answer.ogg" : "answer.webm");
  form.append("language", language);
  return post("/call/listen", { body: form });
}
