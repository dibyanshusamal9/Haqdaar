import { api } from "@/lib/utils";
import { ReasonTree } from "@/components/reason-tree";

export default async function RecPage({ params }: { params: { id: string } }) {
  const data = await api<any>(`/admin/explain/${params.id}`).catch(() => null);
  if (!data) return <div className="card">Recommendation not found.</div>;
  const rec = data.recommendation;
  const top = (rec.top3 as any[])[0];
  return (
    <div className="space-y-6">
      <header>
        <div className="text-sm text-neutral-500">Recommendation</div>
        <h1 className="text-2xl font-semibold font-mono">{rec.id.slice(0, 8)}…</h1>
        <div className="text-sm text-neutral-500">
          made {new Date(rec.created_at).toLocaleString()}
        </div>
      </header>

      <ReasonTree
        top={top}
        profile={rec.profile_snapshot}
        demandEvidence={data.demand_evidence}
      />

      <section className="card">
        <div className="font-semibold mb-2">Composer transcript</div>
        <p className="text-sm whitespace-pre-wrap">{rec.composer_text}</p>
      </section>

      <section className="card">
        <div className="font-semibold mb-2">Session turns</div>
        <ol className="space-y-2 text-sm">
          {(data.session_turns || []).map((t: any) => (
            <li key={t.turn_no} className="flex gap-3">
              <span className="chip">t{t.turn_no}</span>
              <div className="flex-1">
                <div className="text-neutral-500">asked</div>
                <div>{t.asked}</div>
                <div className="text-neutral-500 mt-1">
                  heard <span className="chip">{t.stt_provider}</span>
                </div>
                <div>{t.heard_text}</div>
              </div>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
