"use client";
import { useMemo, useState } from "react";

export type Beneficiary = {
  id: string;
  name: string;
  district: string | null;
  state: string | null;
  age: number | null;
  education_note: string | null;
  education_class: number | null;
  interests: string[] | null;
  aspiration: string | null;
  social_category: string | null;
  language: string | null;
  domain: string;
  top3: any[] | null;
  recommended_at: string | null;
  updated_at: string;
};

function fmtTime(s: string | null) {
  if (!s) return "—";
  return new Date(s).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
}
const LANG: Record<string, string> = {
  hi: "Hindi", bn: "Bengali", ta: "Tamil", mr: "Marathi", en: "English",
  te: "Telugu", kn: "Kannada", ml: "Malayalam", gu: "Gujarati", pa: "Punjabi",
  or: "Odia", as: "Assamese", ur: "Urdu",
};

export function BeneficiariesView({ rows }: { rows: Beneficiary[] }) {
  const [qtext, setQ] = useState("");
  const [stateFilter, setStateFilter] = useState("");

  const states = useMemo(
    () => [...new Set(rows.map((r) => r.state).filter(Boolean))].sort() as string[],
    [rows]
  );

  const filtered = useMemo(() => {
    const needle = qtext.trim().toLowerCase();
    return rows.filter((r) => {
      if (stateFilter && r.state !== stateFilter) return false;
      if (!needle) return true;
      const hay = [
        r.name, r.district, r.state, r.domain, r.aspiration,
        (r.interests || []).join(" "), r.social_category,
      ].join(" ").toLowerCase();
      return hay.includes(needle);
    });
  }, [rows, qtext, stateFilter]);

  // group by STATE, then the API already sorts district → interest → time
  const groups = useMemo(() => {
    const m = new Map<string, Beneficiary[]>();
    for (const b of filtered) {
      const k = b.state || "Unknown state";
      (m.get(k) || m.set(k, []).get(k)!).push(b);
    }
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [filtered]);

  const totalDistricts = useMemo(
    () => new Set(filtered.map((r) => r.district).filter(Boolean)).size,
    [filtered]
  );

  return (
    <div className="space-y-5">
      {/* summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Stat label="Beneficiaries" value={filtered.length} />
        <Stat label="States" value={groups.length} />
        <Stat label="Districts" value={totalDistricts} />
        <Stat label="Languages" value={new Set(filtered.map((r) => r.language).filter(Boolean)).size} />
      </div>

      {/* controls */}
      <div className="flex flex-wrap gap-3 items-center">
        <input
          value={qtext}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search name, district, interest…"
          className="flex-1 min-w-[220px] rounded-xl border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-500"
        />
        <select
          value={stateFilter}
          onChange={(e) => setStateFilter(e.target.value)}
          className="rounded-xl border border-neutral-300 px-3 py-2 text-sm bg-white"
        >
          <option value="">All states</option>
          {states.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        {(qtext || stateFilter) && (
          <button onClick={() => { setQ(""); setStateFilter(""); }}
            className="text-sm text-neutral-500 underline">clear</button>
        )}
      </div>

      {groups.length === 0 && (
        <div className="card text-center text-neutral-500 py-10">
          No beneficiaries match. Complete an interview on the voice line and it appears here.
        </div>
      )}

      {groups.map(([state, list]) => (
        <details key={state} open className="card p-0 overflow-hidden">
          <summary className="cursor-pointer select-none px-4 py-3 bg-neutral-50 flex items-center gap-2">
            <span className="font-semibold">{state}</span>
            <span className="chip">{list.length}</span>
          </summary>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-neutral-500 border-t border-neutral-100">
                <tr>
                  {["Name", "District", "Interest", "Age", "Education", "Category", "Top pathway", "Language", "Seen"].map((h) => (
                    <th key={h} className="text-left px-4 py-2 font-medium whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {list.map((b) => {
                  const top = Array.isArray(b.top3) && b.top3.length
                    ? (b.top3[0].qualification_name || b.top3[0].qp_code || "—") : "—";
                  const edu = b.education_note || (b.education_class != null ? `Class ${b.education_class}` : "—");
                  return (
                    <tr key={b.id} className="border-t border-neutral-100 hover:bg-neutral-50/60">
                      <td className="px-4 py-2 font-medium">{b.name}</td>
                      <td className="px-4 py-2">{b.district || "—"}</td>
                      <td className="px-4 py-2">
                        <span className="chip capitalize">{b.domain}</span>
                      </td>
                      <td className="px-4 py-2">{b.age ?? "—"}</td>
                      <td className="px-4 py-2 whitespace-nowrap">{edu}</td>
                      <td className="px-4 py-2">{b.social_category || "—"}</td>
                      <td className="px-4 py-2">{top}</td>
                      <td className="px-4 py-2 text-neutral-500">{LANG[b.language || ""] || b.language || "—"}</td>
                      <td className="px-4 py-2 text-neutral-500 whitespace-nowrap">{fmtTime(b.recommended_at || b.updated_at)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </details>
      ))}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="card py-3">
      <div className="text-2xl font-semibold">{value}</div>
      <div className="text-xs uppercase tracking-wide text-neutral-500">{label}</div>
    </div>
  );
}
