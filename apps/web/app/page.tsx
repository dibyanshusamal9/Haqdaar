import Link from "next/link";
import { api } from "@/lib/utils";
import { type Beneficiary } from "@/components/beneficiaries-view";

export const dynamic = "force-dynamic";

const DISTRICTS = [
  { id: "Nalanda", state: "Bihar" },
  { id: "Bhagalpur", state: "Bihar" },
  { id: "Jhabua", state: "Madhya Pradesh" },
];

export default async function Home() {
  const { beneficiaries } = await api<{ beneficiaries: Beneficiary[] }>(
    "/admin/beneficiaries"
  ).catch(() => ({ beneficiaries: [] as Beneficiary[] }));

  const total = beneficiaries.length;
  const states = new Set(beneficiaries.map((b) => b.state).filter(Boolean)).size;
  const districts = new Set(beneficiaries.map((b) => b.district).filter(Boolean)).size;
  const today = new Date().toDateString();
  const seenToday = beneficiaries.filter(
    (b) => new Date(b.updated_at).toDateString() === today
  ).length;

  // top interests across everyone counselled
  const domainCount = new Map<string, number>();
  for (const b of beneficiaries) {
    const d = (b.domain || "unspecified").toString();
    domainCount.set(d, (domainCount.get(d) || 0) + 1);
  }
  const topDomains = [...domainCount.entries()]
    .sort((a, b) => b[1] - a[1]).slice(0, 6);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Officer dashboard</h1>
        <p className="text-neutral-600 mt-1">
          Live counselling activity across the pilot, and demand-vs-supply gaps
          by district.
        </p>
      </header>

      {/* live counts */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Stat label="Beneficiaries counselled" value={total} />
        <Stat label="Seen today" value={seenToday} />
        <Stat label="States" value={states} />
        <Stat label="Districts reached" value={districts} />
      </div>

      {/* top interests */}
      {topDomains.length > 0 && (
        <div className="card">
          <div className="text-sm text-neutral-500 mb-2">Most-wanted skills (all beneficiaries)</div>
          <div className="flex flex-wrap gap-2">
            {topDomains.map(([d, n]) => (
              <span key={d} className="chip capitalize">{d} · {n}</span>
            ))}
          </div>
        </div>
      )}

      <div>
        <div className="text-sm text-neutral-500 mb-2">Pilot districts — demand-vs-supply, funnel, leads</div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {DISTRICTS.map((d) => (
            <Link key={d.id} href={`/districts/${d.id}`} className="card hover:shadow-md">
              <div className="text-sm text-neutral-500">{d.state}</div>
              <div className="text-xl font-semibold mt-1">{d.id}</div>
              <div className="mt-2 text-xs font-mono text-neutral-500">→ open</div>
            </Link>
          ))}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Link href="/beneficiaries" className="card hover:shadow-md">
          <div className="text-sm text-neutral-500">Records</div>
          <div className="text-lg font-semibold mt-1">All beneficiaries ({total})</div>
        </Link>
        <Link href="/leads" className="card hover:shadow-md">
          <div className="text-sm text-neutral-500">Mobiliser queue</div>
          <div className="text-lg font-semibold mt-1">Stalled enrollments</div>
        </Link>
        <a href="http://localhost:8000/ui/mic.html" target="_blank" rel="noreferrer" className="card hover:shadow-md">
          <div className="text-sm text-neutral-500">Try it</div>
          <div className="text-lg font-semibold mt-1">Voice counsellor demo</div>
        </a>
      </div>
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
