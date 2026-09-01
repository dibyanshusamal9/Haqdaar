"use client";

type Signal = { key: string; score: number };

export function ReasonTree({
  top,
  profile,
  demandEvidence,
}: {
  top: any;
  profile: any;
  demandEvidence: any[];
}) {
  const signals: Signal[] = [
    { key: "aspiration",   score: Number(top.score_aspiration) },
    { key: "demand",       score: Number(top.score_demand) },
    { key: "mobility",     score: Number(top.score_mobility) },
    { key: "gap",          score: Number(top.score_gap) },
    { key: "centre_hist",  score: Number(top.score_history) },
  ].sort((a, b) => b.score - a.score);

  return (
    <div className="space-y-4">
      <div className="card">
        <div className="text-sm text-neutral-500">Chosen pathway</div>
        <div className="text-lg font-semibold">{top.qualification_name}</div>
        <div className="text-sm text-neutral-500">
          {top.sector} · L{top.nsqf_level} · {top.duration_hours}h
        </div>
        <div className="mt-3 flex gap-2 flex-wrap">
          <span className={`chip ${top.hard_filter === "PASS" ? "tag-pass" : top.hard_filter === "FAIL" ? "tag-fail" : "tag-unk"}`}>
            {top.hard_filter}
          </span>
          <span className="chip">total {Number(top.total_score).toFixed(3)}</span>
          {top.distance_km != null && <span className="chip">{top.distance_km} km</span>}
        </div>
      </div>

      <div className="card">
        <div className="font-semibold mb-2">Per-signal scores</div>
        <div className="space-y-1.5">
          {signals.map((s) => (
            <div key={s.key} className="flex items-center gap-3 text-sm">
              <div className="w-32 font-mono text-neutral-500">{s.key}</div>
              <div className="flex-1 h-2 bg-neutral-100 rounded">
                <div className="h-2 bg-ember rounded" style={{ width: `${s.score * 100}%` }} />
              </div>
              <div className="w-14 text-right font-mono">{s.score.toFixed(2)}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <div className="font-semibold mb-2">Profile snapshot at recommendation time</div>
        <pre className="text-xs bg-neutral-50 rounded p-3 overflow-auto max-h-64">
{JSON.stringify(profile, null, 2)}
        </pre>
      </div>

      <div className="card">
        <div className="font-semibold mb-2">Demand evidence used</div>
        {demandEvidence?.length ? (
          <ul className="text-sm space-y-2">
            {demandEvidence.map((d: any) => (
              <li key={d.id} className="flex items-start gap-3">
                <span className="chip">{d.qp_code || d.sector}</span>
                <div>
                  <div>{d.role_title} — <span className="font-mono">{d.vacancies_90d}</span> vacancies (90d)</div>
                  <div className="text-xs text-neutral-500">
                    {d.district} · {d.evidence_date} ·{" "}
                    <a href={d.source_url} target="_blank" rel="noreferrer" className="underline">source</a>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <div className="text-sm text-neutral-500">No demand rows contributed to this recommendation.</div>
        )}
      </div>
    </div>
  );
}
