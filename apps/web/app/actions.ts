"use server";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { api, ApiFailure, HAQDAAR_API } from "@/lib/server-api";
import { NAME_COOKIE, SESSION_COOKIE } from "@/lib/session";

export type SignInResult = { error: string } | undefined;
export type ActionResult<T = unknown> = { ok: true; data: T } | { ok: false; error: string };

const EIGHT_HOURS = 8 * 60 * 60;

/** Checks the access code with the API, keeps it in an httpOnly cookie, and
 *  goes to the page the curator wanted. */
export async function signIn(form: FormData): Promise<SignInResult> {
  const name = String(form.get("name") ?? "").replace(/\s+/g, " ").trim();
  const code = String(form.get("code") ?? "").trim();
  if (!name) return { error: "Please enter your name." };
  if (!code) return { error: "Please enter the admin access code." };

  let r: Response;
  try {
    r = await fetch(`${HAQDAAR_API}/api/admin/session`, { headers: { "x-admin-code": code }, cache: "no-store" });
  } catch {
    return { error: "Can't reach the Haqdaar.ai API. Check that apps/api is running." };
  }
  if (r.status === 401) return { error: "That access code is not right." };
  if (!r.ok) {
    const body = await r.json().catch(() => null);
    return { error: typeof body?.message === "string" ? body.message : "Sign-in didn't work. Please try again." };
  }
  const secure = (headers().get("origin") ?? "").startsWith("https://");
  const opts = { httpOnly: true, sameSite: "lax" as const, path: "/", maxAge: EIGHT_HOURS, secure };
  cookies().set(SESSION_COOKIE, code, opts);
  cookies().set(NAME_COOKIE, name.slice(0, 80), opts);

  // Only ever a page on this site.
  const next = String(form.get("next") ?? "");
  redirect(/^\/(?!\/)/.test(next) && !next.startsWith("/signin") ? next : "/");
}

export async function signOut() {
  cookies().delete(SESSION_COOKIE);
  cookies().delete(NAME_COOKIE);
  redirect("/signin");
}

async function attempt<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (err) {
    if (err instanceof ApiFailure) return { ok: false, error: err.message };
    throw err; // redirects (expired session) and real bugs
  }
}

/** UC-06: start a scrape+ingest ("refresh") or a re-ingest of the cache. */
export async function startRun(mode: "refresh" | "ingest") {
  const res = await attempt(() => api<{ runId: number }>("/admin/runs", { method: "POST", body: JSON.stringify({ mode }) }));
  revalidatePath("/runs");
  revalidatePath("/");
  return res;
}

export type RuleEdit = { rules?: unknown[]; reviewStatus: "approved" | "edited" | "flagged"; note?: string };

/** UC-06 4a: a curator approves, flags or rewrites a scheme's rules. */
export async function editScheme(slug: string, edit: RuleEdit) {
  const res = await attempt(() =>
    api<{ reviewStatus: string; corpusVersion: number | null }>(`/admin/schemes/${encodeURIComponent(slug)}`, {
      method: "PATCH",
      body: JSON.stringify(edit),
    }),
  );
  revalidatePath("/review");
  revalidatePath("/");
  return res;
}

export type Replay = {
  identical: boolean;
  sameCorpus: boolean;
  loggedCorpusVersion: number;
  currentCorpusVersion: number;
  loggedCount: number;
  replayCount: number;
  added: string[];
  removed: string[];
};

/** NFR-01: re-run a logged match and compare. */
export async function replayMatch(id: string) {
  return attempt(() => api<Replay>(`/admin/matches/${encodeURIComponent(id)}/replay`));
}
