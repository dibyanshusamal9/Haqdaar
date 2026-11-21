import { PageHeader, Panel } from "@/components/ui";
import { RunButtons } from "@/components/run-buttons";
import { RunStatus, type Run } from "@/components/run-status";
import { fmt, fmtDateTime } from "@/lib/format";
import { api } from "@/lib/server-api";

export const dynamic = "force-dynamic";

const MODE: Record<Run["mode"], string> = {
  "scrape+ingest": "Scrape + ingest",
  ingest: "Re-ingest",
  curator: "Curator edit",
};

export default async function RunsPage() {
  const runs = await api<Run[]>("/admin/runs");
  const running = runs.some((r) => r.status === "running");

  return (
    <div className="space-y-8">
      <PageHeader eyebrow="Data ingestion" title="Scrape runs">
        The batch scraper reads myscheme.gov.in&apos;s public API, caches every scheme, and the
        normaliser turns it into JSONB rules. Re-running is idempotent: schemes are upserted on their
        source URL, so nothing is duplicated (FR-09).
      </PageHeader>

      <Panel title="Start a run">
        <RunButtons running={running} />
      </Panel>

      <Panel title="History" subtitle="Each run that changes rows becomes the new corpus version that matches are logged against.">
        <div className="-mx-5 overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="table-head">
                <th className="px-5 py-2.5">Run</th>
                <th className="px-3 py-2.5">Status</th>
                <th className="px-3 py-2.5">Started</th>
                <th className="px-3 py-2.5 text-right">Listed</th>
                <th className="px-3 py-2.5 text-right">Added</th>
                <th className="px-3 py-2.5 text-right">Updated</th>
                <th className="px-3 py-2.5 text-right">Withdrawn</th>
                <th className="px-3 py-2.5 text-right">Flagged</th>
                <th className="px-3 py-2.5 text-right">Fetch failures</th>
                <th className="px-5 py-2.5 text-right">Version</th>
              </tr>
            </thead>
            <tbody>
              {runs.length === 0 && (
                <tr><td colSpan={10} className="px-5 py-8 text-center text-ink-soft">No runs yet. Start one above, or run <code>npm run scrape</code> then <code>npm run ingest</code> in apps/api.</td></tr>
              )}
              {runs.map((r) => (
                <tr key={r.id} className="table-row align-top">
                  <td className="px-5 py-3">
                    <div className="font-medium text-ink">#{r.id} · {MODE[r.mode]}</div>
                    <div className="text-xs text-ink-faint">by {r.triggeredBy}{r.requests ? ` · ${fmt(r.requests)} requests` : ""}</div>
                    {r.error && <div className="mt-1 max-w-xs text-xs text-red-700">{r.error}</div>}
                  </td>
                  <td className="px-3 py-3"><RunStatus status={r.status} /></td>
                  <td className="px-3 py-3 text-ink-soft">{fmtDateTime(r.startedAt)}</td>
                  <td className="px-3 py-3 text-right tabular-nums">{fmt(r.listed)}</td>
                  <td className="px-3 py-3 text-right tabular-nums">{fmt(r.added)}</td>
                  <td className="px-3 py-3 text-right tabular-nums">{fmt(r.updated)}</td>
                  <td className="px-3 py-3 text-right tabular-nums">{fmt(r.withdrawn)}</td>
                  <td className="px-3 py-3 text-right tabular-nums">{fmt(r.flagged)}</td>
                  <td className="px-3 py-3 text-right tabular-nums">{fmt(r.failed)}</td>
                  <td className="px-5 py-3 text-right tabular-nums">{r.corpusVersion ? `v${r.corpusVersion}` : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}
