import { api } from "@/lib/utils";

type Beneficiary = {
  id: string;
  name: string;
  district: string | null;
  state: string | null;
  age: number | null;
  education_note: string | null;
  education_class: number | null;
  interests: string[] | null;
  aspiration: string | null;
  mobility_km: number | null;
  has_smartphone: boolean | null;
  self_employ_ok: boolean | null;
  social_category: string | null;
  language: string | null;
  domain: string;
  top3: any[] | null;
  recommended_at: string | null;
  updated_at: string;
};

function fmtTime(s: string | null) {
  if (!s) return "—";
  const d = new Date(s);
  return d.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
}

export default async function BeneficiariesPage() {
  const { beneficiaries, count } = await api<{ beneficiaries: Beneficiary[]; count: number }>(
    "/admin/beneficiaries"
  ).catch(() => ({ beneficiaries: [], count: 0 }));

  // Group by domain (job/interest), then within each domain sort by district
  // then most-recent time (the API already sorts, we just bucket here).
  const groups = new Map<string, Beneficiary[]>();
  for (const b of beneficiaries) {
    const key = (b.domain || "Unspecified").toString();
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(b);
  }
  for (const [, list] of groups) {
    list.sort((a, b) => {
      const d = (a.district || "").localeCompare(b.district || "");
      if (d !== 0) return d;
      return (b.updated_at || "").localeCompare(a.updated_at || "");
    });
  }
  const domains = [...groups.keys()].sort();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Beneficiaries</h1>
        <p className="text-neutral-600 text-sm">
          Everyone counselled so far ({count} total) — grouped by job / domain,
          then district, newest first. This is the full history, not just the
          latest session.
        </p>
      </div>

      {domains.length === 0 && (
        <div className="card p-8 text-center text-neutral-500">
          No beneficiaries yet. Complete an interview at the voice line and it
          will appear here.
        </div>
      )}

      {domains.map((domain) => {
        const list = groups.get(domain)!;
        return (
          <div key={domain} className="space-y-2">
            <div className="flex items-baseline gap-2">
              <h2 className="text-lg font-semibold capitalize">{domain}</h2>
              <span className="chip">{list.length}</span>
            </div>
            <div className="card p-0 overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-neutral-50 text-neutral-500">
                  <tr>
                    <th className="text-left px-4 py-2">Name</th>
                    <th className="text-left px-4 py-2">District</th>
                    <th className="text-right px-4 py-2">Age</th>
                    <th className="text-left px-4 py-2">Education</th>
                    <th className="text-left px-4 py-2">Category</th>
                    <th className="text-left px-4 py-2">Top pathway</th>
                    <th className="text-left px-4 py-2">Seen</th>
                  </tr>
                </thead>
                <tbody>
                  {list.map((b) => {
                    const top = Array.isArray(b.top3) && b.top3.length
                      ? (b.top3[0].qualification_name || b.top3[0].qp_code || "—")
                      : "—";
                    const edu = b.education_note
                      || (b.education_class != null ? `Class ${b.education_class}` : "—");
                    return (
                      <tr key={b.id} className="border-t border-neutral-100">
                        <td className="px-4 py-2 font-medium">{b.name}</td>
                        <td className="px-4 py-2">
                          {b.district || "—"}
                          {b.state ? <span className="text-neutral-400"> · {b.state}</span> : null}
                        </td>
                        <td className="px-4 py-2 text-right">{b.age ?? "—"}</td>
                        <td className="px-4 py-2">{edu}</td>
                        <td className="px-4 py-2">{b.social_category || "—"}</td>
                        <td className="px-4 py-2">{top}</td>
                        <td className="px-4 py-2 text-neutral-500 whitespace-nowrap">
                          {fmtTime(b.recommended_at || b.updated_at)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}
    </div>
  );
}
