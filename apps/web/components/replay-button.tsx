"use client";
import { useState, useTransition } from "react";
import { replayMatch, type Replay } from "@/app/actions";

/** Re-runs a logged match and shows whether today's answer is the same (NFR-01). */
export function ReplayButton({ id }: { id: string }) {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<Replay | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = () =>
    start(async () => {
      setError(null);
      const res = await replayMatch(id);
      if (res.ok) setResult(res.data);
      else setError(res.error);
    });

  return (
    <div className="space-y-1">
      <button type="button" className="btn-ghost" onClick={run} disabled={pending}>
        {pending ? "Replaying…" : "Replay"}
      </button>
      {error && <p className="text-xs text-red-700">{error}</p>}
      {result && (
        <p className={result.identical ? "text-xs text-green-700" : "text-xs text-amber-800"} role="status">
          {result.identical
            ? `Identical: ${result.replayCount} schemes, same order.`
            : result.sameCorpus
              ? `Differs on the same corpus (v${result.currentCorpusVersion}): +${result.added.length} / −${result.removed.length}.`
              : `Corpus changed (v${result.loggedCorpusVersion} → v${result.currentCorpusVersion}): +${result.added.length} / −${result.removed.length}.`}
        </p>
      )}
    </div>
  );
}
