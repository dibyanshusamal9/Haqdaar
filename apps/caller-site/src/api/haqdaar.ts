// Client for the Haqdaar.ai NestJS API (apps/api).

export const API_URL = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000").replace(/\/$/, "");

export type Gender = "female" | "male" | "transgender";

/** Form state: strings while editing; converted to the API profile on submit. */
export interface ProfileDraft {
  age: string;
  gender: string;
  state: string;
  residence: string;
  caste: string;
  annual_income: string;
  marital_status: string;
  occupation: string;
  employment_status: string;
  student: boolean;
  disability: boolean;
  disability_percent: string;
  minority: boolean;
  bpl: boolean;
  gov_employee: boolean;
  economic_distress: boolean;
}

export const EMPTY_DRAFT: ProfileDraft = {
  age: "", gender: "", state: "", residence: "", caste: "", annual_income: "", marital_status: "",
  occupation: "", employment_status: "", student: false, disability: false, disability_percent: "",
  minority: false, bpl: false, gov_employee: false, economic_distress: false,
};

export const REQUIRED: (keyof ProfileDraft)[] = ["age", "gender", "state", "residence", "caste"];

export interface Extraction {
  transcript: string;
  languageCode: string | null;
  fields: Partial<Record<keyof ProfileDraft, string | number | boolean>>;
  filled: (keyof ProfileDraft)[];
  missingRequired: (keyof ProfileDraft)[];
  extractor: "groq" | "rules";
  warning: string | null;
}

export interface MatchResult {
  slug: string;
  name: string;
  shortTitle: string | null;
  level: "central" | "state";
  states: string[];
  categories: string[];
  brief: string | null;
  benefitType: string | null;
  closeDate: string | null;
  closed: boolean;
  sourceUrl: string;
  status: "eligible" | "likely";
  score: number;
  reasons: { condition: string; why: string }[];
  verify: string[];
  conditionsChecked: number;
}

export interface MatchResponse {
  matchId: string;
  corpusVersion: number;
  durationMs: number;
  counts: { total: number; eligible: number; likely: number; central: number; state: number; open: number };
  categories: { name: string; count: number }[];
  results: MatchResult[];
}

export interface SchemeCard {
  slug: string;
  name: string;
  shortTitle: string | null;
  level: "central" | "state";
  states: string[];
  categories: string[];
  brief: string | null;
  benefitType: string | null;
  closeDate: string | null;
  sourceUrl: string;
  ministry: string | null;
}

export interface Predicate {
  id: string;
  field: string;
  op: string;
  value: unknown;
  strict?: unknown;
  strength?: "hard" | "soft";
  src: string;
  label: string;
}

export interface SchemeDetail extends SchemeCard {
  schemeType: string | null;
  department: string | null;
  implementingAgency: string | null;
  tags: string[];
  descriptionMd: string | null;
  benefitsMd: string | null;
  exclusionsMd: string | null;
  eligibilityMd: string | null;
  documentsMd: string | null;
  applicationMd: string | null;
  applicationModes: string[];
  applyUrl: string | null;
  references: { title: string; url: string }[];
  rules: { version: number; all: Predicate[] };
  scrapedAt: string | null;
}

export interface Stats {
  total: number;
  central: number;
  state: number;
  withRules: number;
  predicates: number;
  corpusVersion: number;
  states: { state: string; count: number }[];
  categories: { category: string; count: number }[];
  /** how many schemes carry each kind of condition */
  fields: { field: string; schemes: number }[];
}

export class ApiError extends Error {
  constructor(message: string, readonly status: number, readonly body: unknown) {
    super(message);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}/api${path}`, init);
  } catch {
    throw new ApiError("Network error", 0, null);
  }
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    const msg = (body && (body.message as string)) || `HTTP ${res.status}`;
    throw new ApiError(typeof msg === "string" ? msg : `HTTP ${res.status}`, res.status, body);
  }
  return body as T;
}

const json = (body: unknown): RequestInit => ({
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

export const api = {
  stats: () => request<Stats>("/schemes/stats"),
  capabilities: () => request<{ capabilities: { voice: boolean; llm: boolean } }>("/profile/schema"),
  extractText: (text: string) => request<Extraction>("/profile/extract", json({ text })),
  extractVoice: (audio: Blob, language: string) => {
    const form = new FormData();
    form.append("audio", audio, audio.type.includes("ogg") ? "speech.ogg" : "speech.webm");
    form.append("language", language);
    return request<Extraction>("/profile/voice", { method: "POST", body: form });
  },
  match: (profile: Record<string, unknown>, inputMode: "form" | "voice" | "text") =>
    request<MatchResponse>("/match", json({ profile, inputMode })),
  schemes: (q: { q?: string; level?: string; state?: string; category?: string; page?: number; size?: number }) => {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(q)) if (v !== undefined && v !== "") params.set(k, String(v));
    return request<{ total: number; page: number; size: number; items: SchemeCard[] }>(`/schemes?${params}`);
  },
  scheme: (slug: string) => request<SchemeDetail>(`/schemes/${encodeURIComponent(slug)}`),
};

/** Form strings -> the profile JSON the API validates. Empty optional fields are omitted. */
export function draftToProfile(d: ProfileDraft): Record<string, unknown> {
  const out: Record<string, unknown> = {
    student: d.student, disability: d.disability, minority: d.minority, bpl: d.bpl,
    gov_employee: d.gov_employee, economic_distress: d.economic_distress,
  };
  for (const k of ["gender", "state", "residence", "caste", "marital_status", "occupation", "employment_status"] as const) {
    if (d[k]) out[k] = d[k];
  }
  if (d.age.trim()) out.age = Number(d.age);
  if (d.annual_income.trim()) out.annual_income = Number(d.annual_income.replace(/[,\s₹]/g, ""));
  if (d.disability && d.disability_percent.trim()) out.disability_percent = Number(d.disability_percent);
  return out;
}

/** Merges extracted fields into the form, returning which fields changed. */
export function mergeExtraction(d: ProfileDraft, fields: Extraction["fields"]): { draft: ProfileDraft; changed: (keyof ProfileDraft)[] } {
  const next = { ...d };
  const changed: (keyof ProfileDraft)[] = [];
  for (const [k, v] of Object.entries(fields) as [keyof ProfileDraft, string | number | boolean][]) {
    if (!(k in next) || v === null || v === undefined) continue;
    const value = typeof next[k] === "boolean" ? Boolean(v) : String(v);
    if (next[k] !== value) {
      (next as Record<string, unknown>)[k] = value;
      changed.push(k);
    }
  }
  return { draft: next, changed };
}

export const STATES = [
  "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh", "Goa", "Gujarat", "Haryana",
  "Himachal Pradesh", "Jharkhand", "Karnataka", "Kerala", "Madhya Pradesh", "Maharashtra", "Manipur",
  "Meghalaya", "Mizoram", "Nagaland", "Odisha", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana",
  "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal", "Andaman and Nicobar Islands", "Chandigarh",
  "Dadra & Nagar Haveli and Daman & Diu", "Delhi", "Jammu and Kashmir", "Ladakh", "Lakshadweep", "Puducherry",
];
