import Link from "next/link";
import { PageHeader, Panel } from "@/components/ui";
import { ReplayButton } from "@/components/replay-button";
import { fmt, fmtDateTime } from "@/lib/format";
import { api } from "@/lib/server-api";

export const dynamic = "force-dynamic";

type MatchLog = {
  id: string;
  createdAt: string;
  corpusVersion: number;
  inputMode: "form" | "voice" | "text";
  eligible: number;
  likely: number;
  durationMs: number;
  state: string | null;
  age: string | null;
  gender: string | null;
};

const MODE = { form: "Form", voice: "Voice", text: "Text" } as const;

export default async function MatchesPage({ searchParams }: { searchParams: { page?: string } }) {
  const page = Math.max(1, Number(searchParams.page) || 1);
  const data = await api<{ total: number; size: number; items: MatchLog[] }>(`/admin/matches?page=${page}`);
  const pages = Math.max(1, Math.ceil(data.total / data.size));

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Audit" title="Match log">
        Every &quot;Find my schemes&quot; request is logged with the profile fields used and the corpus
        version it ran against (FR-11). No names, phone numbers, audio or transcripts are stored. Replay
        a match to check that the same profile still gives the same list (NFR-01).
      </PageHeader>

      <Panel title={`${fmt(data.total)} matches`}>
        <div className="-mx-5 overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="table-head">
                <th className="px-5 py-2.5">When</th>
                <th className="px-3 py-2.5">Input</th>
                <th className="px-3 py-2.5">Profile</th>
                <th className="px-3 py-2.5 text-right">Eligible</th>
                <th className="px-3 py-2.5 text-right">Check a detail</th>
                <th className="px-3 py-2.5 text-right">Time</th>
                <th className="px-3 py-2.5 text-right">Corpus</th>
                <th className="px-5 py-2.5">Reproducible?</th>
              </tr>
            </thead>
            <tbody>
              {data.items.length === 0 && (
                <tr><td colSpan={8} className="px-5 py-8 text-center text-ink-soft">No matches yet.</td></tr>
              )}
              {data.items.map((m) => (
                <tr key={m.id} className="table-row align-top">
                  <td className="px-5 py-3 text-ink-soft">{fmtDateTime(m.createdAt)}</td>
                  <td className="px-3 py-3"><span className="chip">{MODE[m.inputMode]}</span></td>
                  <td className="px-3 py-3 text-ink">{[m.age && `${m.age} yrs`, m.gender, m.state].filter(Boolean).join(" · ")}</td>
                  <td className="px-3 py-3 text-right tabular-nums">{fmt(m.eligible)}</td>
                  <td className="px-3 py-3 text-right tabular-nums">{fmt(m.likely)}</td>
                  <td className="px-3 py-3 text-right tabular-nums">{fmt(m.durationMs)} ms</td>
                  <td className="px-3 py-3 text-right tabular-nums">v{m.corpusVersion}</td>
                  <td className="px-5 py-3"><ReplayButton id={m.id} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      {pages > 1 && (
        <nav className="flex items-center justify-center gap-3 text-sm" aria-label="Pagination">
          {page > 1 ? <Link className="btn-ghost" href={`/matches?page=${page - 1}`}>Previous</Link> : <span />}
          <span className="text-ink-soft">Page {fmt(page)} of {fmt(pages)}</span>
          {page < pages ? <Link className="btn-ghost" href={`/matches?page=${page + 1}`}>Next</Link> : <span />}
        </nav>
      )}
    </div>
  );
}
