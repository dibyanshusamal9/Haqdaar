"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { startRun } from "@/app/actions";

/** UC-06 trigger: a full scrape + ingest, or a quick re-ingest of the cached scrape. */
export function RunButtons({ running }: { running: boolean }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const router = useRouter();

  const run = (mode: "refresh" | "ingest") =>
    start(async () => {
      setMsg(null);
      const res = await startRun(mode);
      if (res.ok) {
        setMsg({ ok: true, text: `Started run #${(res.data as { runId: number }).runId}. It continues in the background; refresh to follow it.` });
        router.refresh();
      } else setMsg({ ok: false, text: res.error });
    });

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn-primary" disabled={pending || running} onClick={() => run("refresh")}>
          Scrape myscheme.gov.in + ingest
        </button>
        <button type="button" className="btn-ghost" disabled={pending || running} onClick={() => run("ingest")}>
          Re-ingest the cached scrape
        </button>
      </div>
      <p className="text-xs text-ink-soft">
        A full scrape makes roughly 10,000 polite requests (about an hour). Re-ingest only re-runs the
        normaliser on the files already downloaded, in seconds.
      </p>
      {running && <p className="text-sm text-amber-800">A run is in progress.</p>}
      {msg && <p role="status" className={msg.ok ? "text-sm text-green-700" : "text-sm text-red-700"}>{msg.text}</p>}
    </div>
  );
}
