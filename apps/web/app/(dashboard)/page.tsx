import Link from "next/link";
import { BarList } from "@/components/charts/bar-list";
import { PageHeader, Panel, Stat } from "@/components/ui";
import { RunStatus, type Run } from "@/components/run-status";
import { fmt, fmtDateTime } from "@/lib/format";
import { api } from "@/lib/server-api";

type Overview = {
  stats: {
    total: number;
    central: number;
    state: number;
    withRules: number;
    flagged: number;
    predicates: number;
    corpusVersion: number;
    states: { state: string; count: number }[];
    categories: { category: string; count: number }[];
  };
  review: { status: string; count: number }[];
  matches: { total: number; last7Days: number; avgDurationMs: number; avgResults: number; voice: number; text: number; form: number };
  runs: Run[];
};

export const dynamic = "force-dynamic";

const REVIEW_LABEL: Record<string, string> = {
  auto: "Normalised automatically",
  flagged: "Flagged for review",
  approved: "Approved by a curator",
  edited: "Edited by a curator",
};

export default async function OverviewPage() {
  const o = await api<Overview>("/admin/overview");
  const s = o.stats;
  const lastRun = o.runs.find((r) => r.status === "succeeded");

  return (
    <div className="space-y-8">
      <PageHeader eyebrow="Overview" title="The scheme corpus">
        Every scheme scraped from myscheme.gov.in, the eligibility rules derived from it, and how
        citizens are using the matcher. Corpus version <strong className="text-ink">v{s.corpusVersion}</strong>
        {lastRun && <> · last successful run {fmtDateTime(lastRun.finishedAt)}</>}.
      </PageHeader>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <Stat label="Schemes in the corpus" value={s.total} note={`${fmt(s.central)} central · ${fmt(s.state)} state/UT`} />
        <Stat label="Schemes with structured rules" value={s.withRules} note={`${fmt(s.predicates)} conditions in total`} />
        <Stat label="Flagged for review" value={s.flagged} note="eligibility text the normaliser could not turn into rules" />
        <Stat label="Matches run" value={o.matches.total} note={`${fmt(o.matches.last7Days)} in the last 7 days · avg ${fmt(o.matches.avgDurationMs)} ms`} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel
          title="Review status"
          subtitle="FR-08: schemes the normaliser could not fully handle wait here for a curator."
          action={<Link href="/review" className="btn-ghost">Open the queue</Link>}
        >
          <BarList measure="calls" empty="No schemes yet. Run a scrape." rows={o.review.map((r) => ({ label: REVIEW_LABEL[r.status] ?? r.status, value: r.count, href: `/review?status=${r.status}` }))} />
        </Panel>

        <Panel title="How citizens gave their details" subtitle={`Average ${fmt(o.matches.avgResults)} schemes returned per match.`}>
          <BarList
            measure="calls"
            empty="No matches yet."
            rows={[
              { label: "Typed form", value: o.matches.form },
              { label: "Voice", value: o.matches.voice },
              { label: "Free text", value: o.matches.text },
            ]}
          />
        </Panel>

        <Panel title="Scheme categories" subtitle="A scheme can sit in several categories.">
          <BarList measure="calls" empty="No schemes yet." rows={s.categories.slice(0, 10).map((c) => ({ label: c.category, value: c.count }))} />
        </Panel>

        <Panel title="States with the most state schemes" subtitle="Central schemes (open across India) are not counted here.">
          <BarList measure="calls" empty="No state schemes yet." rows={s.states.slice(0, 10).map((st) => ({ label: st.state, value: st.count }))} />
        </Panel>
      </div>

      <Panel title="Recent runs" subtitle="Scrapes, re-ingests and curator edits. Each run that changed rows is a new corpus version." action={<Link href="/runs" className="btn-ghost">All runs</Link>}>
        {o.runs.length === 0 ? (
          <p className="py-6 text-center text-sm text-ink-soft">No runs yet.</p>
        ) : (
          <ul className="divide-y divide-line">
            {o.runs.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
                <span className="flex items-center gap-2">
                  <RunStatus status={r.status} />
                  <span className="font-medium text-ink">#{r.id} · {r.mode}</span>
                  <span className="text-ink-faint">{fmtDateTime(r.startedAt)}</span>
                </span>
                <span className="text-ink-soft">
                  +{fmt(r.added)} added · {fmt(r.updated)} updated · {fmt(r.flagged)} flagged
                  {r.corpusVersion ? ` · v${r.corpusVersion}` : ""}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
