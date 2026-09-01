import Link from "next/link";

const DISTRICTS = [
  { id: "Nalanda", state: "Bihar" },
  { id: "Bhagalpur", state: "Bihar" },
  { id: "Jhabua", state: "Madhya Pradesh" },
];

export default function Home() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Officer dashboard</h1>
        <p className="text-neutral-600 mt-1">
          Pick a pilot district to see demand-vs-supply gaps, the counselling
          funnel, and the mobiliser leads queue.
        </p>
      </header>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {DISTRICTS.map((d) => (
          <Link key={d.id} href={`/districts/${d.id}`} className="card hover:shadow-md">
            <div className="text-sm text-neutral-500">{d.state}</div>
            <div className="text-xl font-semibold mt-1">{d.id}</div>
            <div className="mt-2 text-xs font-mono text-neutral-500">→ open</div>
          </Link>
        ))}
      </div>
      <div className="pt-6 grid gap-4 sm:grid-cols-2">
        <Link href="/leads" className="card">
          <div className="text-sm text-neutral-500">Mobiliser queue</div>
          <div className="text-lg font-semibold mt-1">Stalled enrollments (d2 / d7 / d30)</div>
        </Link>
        <a href="http://localhost:8000/health" target="_blank" rel="noreferrer" className="card">
          <div className="text-sm text-neutral-500">System</div>
          <div className="text-lg font-semibold mt-1">Voice API health</div>
        </a>
      </div>
    </div>
  );
}
