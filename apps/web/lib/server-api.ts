// Server-side access to the Haqdaar.ai API as the signed-in curator.
// Server components and actions only (reads the session cookie).
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { NAME_COOKIE, SESSION_COOKIE } from "@/lib/session";

export const HAQDAAR_API = (process.env.HAQDAAR_API_URL || "http://localhost:4000").replace(/\/$/, "");

export class ApiFailure extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

/** Calls /api/admin/... (or any /api path) with the curator's access code. */
export async function adminFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const code = cookies().get(SESSION_COOKIE)?.value;
  let r: Response;
  try {
    r = await fetch(`${HAQDAAR_API}/api${path}`, {
      ...init,
      cache: "no-store",
      headers: {
        ...(init.body ? { "Content-Type": "application/json" } : {}),
        ...(code ? { "x-admin-code": code } : {}),
      },
    });
  } catch {
    throw new ApiFailure("Can't reach the Haqdaar.ai API. Check that apps/api is running.", 0);
  }
  if (r.status === 401) redirect("/signin?reason=expired");
  return r;
}

async function message(r: Response): Promise<string> {
  const body = await r.json().catch(() => null);
  const m = body?.message;
  if (typeof m === "string") {
    const errs = Array.isArray(body?.errors) ? body.errors.map((e: { field: string; message: string }) => `${e.field}: ${e.message}`).join("; ") : "";
    return errs ? `${m}: ${errs}` : m;
  }
  return `Request failed (${r.status}).`;
}

/** GET (or send) and parse JSON; throws ApiFailure with the API's message. */
export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const r = await adminFetch(path, init);
  if (!r.ok) throw new ApiFailure(await message(r), r.status);
  return r.json() as Promise<T>;
}

/** The signed-in curator's name, for display only. */
export function curatorName(): string | null {
  return cookies().get(NAME_COOKIE)?.value ?? null;
}
