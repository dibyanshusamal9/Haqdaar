const inr = new Intl.NumberFormat("en-IN");

/** 803988 → "8,03,988" */
export const fmt = (n: number) => inr.format(n);

export function fmtDateTime(s: string | null) {
  if (!s) return "—";
  return new Date(s).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
}
