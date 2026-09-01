import { api } from "@/lib/utils";
import { GapTable } from "@/components/gap-table";
import { Funnel } from "@/components/funnel";

type Gaps = { gaps: any[] };
type Funn = { counts: { state: string; n: number }[] };

export default async function DistrictPage({ params }: { params: { id: string } }) {
  const [gaps, funnel] = await Promise.all([
    api<Gaps>(`/admin/districts/${encodeURIComponent(params.id)}/gap`).catch(() => ({ gaps: [] })),
    api<Funn>(`/admin/districts/${encodeURIComponent(params.id)}/funnel`).catch(() => ({ counts: [] })),
  ]);
  return (
    <div className="space-y-6">
      <header className="flex items-baseline justify-between">
        <h1 className="text-2xl font-semibold">{params.id}</h1>
        <span className="chip">district view</span>
      </header>
      <section className="space-y-3">
        <h2 className="font-semibold">Demand vs supply by sector</h2>
        <GapTable rows={gaps.gaps as any} />
      </section>
      <section className="grid gap-4 lg:grid-cols-2">
        <Funnel counts={funnel.counts as any} />
        <div className="card">
          <div className="font-semibold mb-2">Placement scorecard</div>
          <p className="text-sm text-neutral-500">
            Ships in V1.1 (FR-15). Preview shows counselled → enrolled → placed
            once the pilot cohort accrues.
          </p>
        </div>
      </section>
    </div>
  );
}
