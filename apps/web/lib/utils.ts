import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
export function cn(...inputs: ClassValue[]) { return twMerge(clsx(inputs)); }

export const VOICE_API =
  process.env.VOICE_API_URL || "http://localhost:8000";

export async function api<T>(path: string): Promise<T> {
  const r = await fetch(`${VOICE_API}${path}`, { cache: "no-store" });
  if (!r.ok) throw new Error(`${path} → ${r.status}`);
  return r.json() as Promise<T>;
}
