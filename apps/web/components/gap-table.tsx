type Row = { sector: string; demand_90d: number | null; supply_quarter: number; last_evidence: string | null };

export function GapTable({ rows }: { rows: Row[] }) {
  if (!rows?.length) return <div className="card text-neutral-500">No demand rows in the last 180 days.</div>;
  return (
    <div className="card p-0 overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-neutral-50 text-neutral-500">
          <tr>
            <th className="text-left px-4 py-2">Sector</th>
            <th className="text-right px-4 py-2">Demand 90d</th>
            <th className="text-right px-4 py-2">Supply (quarter)</th>
            <th className="text-right px-4 py-2">Gap</th>
            <th className="text-right px-4 py-2">Last evidence</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const gap = (r.demand_90d ?? 0) - r.supply_quarter;
            return (
              <tr key={r.sector} className="border-t border-neutral-100">
                <td className="px-4 py-2">{r.sector}</td>
                <td className="px-4 py-2 text-right font-mono">{r.demand_90d ?? "—"}</td>
                <td className="px-4 py-2 text-right font-mono">{r.supply_quarter}</td>
                <td className={`px-4 py-2 text-right font-mono ${gap > 0 ? "text-ember" : "text-moss"}`}>
                  {gap > 0 ? `+${gap}` : gap}
                </td>
                <td className="px-4 py-2 text-right text-neutral-500">{r.last_evidence ?? "—"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
