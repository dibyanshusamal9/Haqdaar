const ORDER = ["counselled","enrolled","in_training","certified","placed","dropped"];

export function Funnel({ counts }: { counts: { state: string; n: number }[] }) {
  const map = Object.fromEntries(counts.map((c) => [c.state, c.n]));
  const max = Math.max(1, ...ORDER.map((s) => map[s] || 0));
  return (
    <div className="card">
      <div className="font-semibold mb-3">Cohort funnel</div>
      <div className="space-y-2">
        {ORDER.map((s) => {
          const n = map[s] || 0;
          return (
            <div key={s}>
              <div className="flex justify-between text-xs text-neutral-500">
                <span className="uppercase font-mono">{s}</span>
                <span>{n}</span>
              </div>
              <div className="h-2 bg-neutral-100 rounded">
                <div className="h-2 bg-moss rounded"
                     style={{ width: `${(n / max) * 100}%` }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
