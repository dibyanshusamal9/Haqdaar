import { api } from "@/lib/utils";

type Leads = { leads: any[] };

export default async function LeadsPage() {
  const { leads } = await api<Leads>("/admin/leads").catch(() => ({ leads: [] }));
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Mobiliser queue</h1>
      <p className="text-neutral-600 text-sm">
        Enrollments that haven&apos;t advanced in the expected window (d2, d7, d30).
      </p>
      <div className="card p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 text-neutral-500">
            <tr>
              <th className="text-left px-4 py-2">Enrollment</th>
              <th className="text-left px-4 py-2">State</th>
              <th className="text-right px-4 py-2">Days in state</th>
              <th className="text-left px-4 py-2">Bucket</th>
              <th className="text-left px-4 py-2">Owner</th>
            </tr>
          </thead>
          <tbody>
            {leads.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-neutral-500">
                No stalled enrollments. Everything is moving.
              </td></tr>
            )}
            {leads.map((l: any) => (
              <tr key={l.id} className="border-t border-neutral-100">
                <td className="px-4 py-2 font-mono text-xs">{l.id.slice(0, 8)}…</td>
                <td className="px-4 py-2">{l.state}</td>
                <td className="px-4 py-2 text-right font-mono">{l.days_in_state}</td>
                <td className="px-4 py-2">
                  <span className="chip">{l.bucket}</span>
                </td>
                <td className="px-4 py-2">{l.owner || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
