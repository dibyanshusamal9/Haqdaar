"use client";
import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { editScheme } from "@/app/actions";
import { CITIZEN_SITE } from "@/lib/brand";
import { cn } from "@/lib/utils";

export type Predicate = {
  id: string;
  field: string;
  op: string;
  value: unknown;
  strict?: unknown;
  strength?: "hard" | "soft";
  src: string;
  label: string;
};

export type ReviewScheme = {
  slug: string;
  name: string;
  level: "central" | "state";
  states: string[];
  reviewStatus: "auto" | "flagged" | "approved" | "edited";
  reviewReasons: string[];
  rules: { version: number; all: Predicate[] };
  eligibilityMd: string | null;
  curatorNote: string | null;
  sourceUrl: string;
};

const STATUS_TAG: Record<ReviewScheme["reviewStatus"], string> = {
  auto: "chip",
  flagged: "chip tag-unk",
  approved: "chip tag-pass",
  edited: "chip tag-violet",
};

/** myscheme text carries HTML entities, sometimes double-escaped. */
function decode(s: string): string {
  let out = s;
  for (let i = 0; i < 3 && out.includes("&amp;"); i++) out = out.replace(/&amp;/g, "&");
  return out
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/<br\s*\/?>/gi, "\n");
}

/** Rules without their generated labels: what a curator edits. */
const editable = (rules: Predicate[]) => rules.map(({ label: _l, ...p }) => p);

export function ReviewItem({ s }: { s: ReviewScheme }) {
  const uid = useId();
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [json, setJson] = useState(() => JSON.stringify(editable(s.rules.all), null, 2));
  const [note, setNote] = useState(s.curatorNote ?? "");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  const save = (reviewStatus: "approved" | "edited" | "flagged", withRules: boolean) =>
    start(async () => {
      setMsg(null);
      let rules: unknown[] | undefined;
      if (withRules) {
        try {
          rules = JSON.parse(json);
          if (!Array.isArray(rules)) throw new Error("not a list");
        } catch {
          setMsg({ ok: false, text: "The rules must be a JSON list of predicates." });
          return;
        }
      }
      const res = await editScheme(s.slug, { reviewStatus, rules, note: note.trim() || undefined });
      if (res.ok) {
        const d = res.data as { reviewStatus: string; corpusVersion: number | null };
        setMsg({ ok: true, text: d.corpusVersion ? `Saved as corpus version v${d.corpusVersion}.` : `Marked ${d.reviewStatus}.` });
        setEditing(false);
        router.refresh();
      } else setMsg({ ok: false, text: res.error });
    });

  return (
    <article className="card space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="font-semibold text-ink">{s.name}</h2>
          <p className="text-xs text-ink-faint">
            {s.level === "central" ? "Central" : "State"} · {s.states.length ? s.states.join(", ") : "All India"} ·{" "}
            <a className="underline" href={`${CITIZEN_SITE}/schemes/${encodeURIComponent(s.slug)}`} target="_blank" rel="noreferrer">citizen view</a> ·{" "}
            <a className="underline" href={s.sourceUrl} target="_blank" rel="noreferrer">myscheme</a>
          </p>
        </div>
        <span className={STATUS_TAG[s.reviewStatus]}>{s.reviewStatus}</span>
      </div>

      {s.reviewReasons.length > 0 && (
        <ul className="list-disc space-y-1 pl-5 text-sm text-amber-900">
          {s.reviewReasons.map((r) => <li key={r}>{r}</li>)}
        </ul>
      )}

      <div>
        <div className="text-xs font-semibold uppercase tracking-wide text-ink-soft">Current rules</div>
        {s.rules.all.length === 0 ? (
          <p className="text-sm text-ink-soft">None: this scheme matches every profile in its area.</p>
        ) : (
          <ul className="mt-1 flex flex-wrap gap-1.5">
            {s.rules.all.map((p) => (
              <li key={p.id} className={cn("chip", p.strength === "soft" ? "tag-unk" : "")} title={`${p.field} ${p.op} ${JSON.stringify(p.value)} · ${p.src}`}>
                {p.label}
              </li>
            ))}
          </ul>
        )}
      </div>

      {s.eligibilityMd && (
        <details className="rounded-xl border border-line bg-canvas/60 px-3 py-2 text-sm">
          <summary className="cursor-pointer font-medium text-ink">Eligibility text as published</summary>
          <p className="mt-2 whitespace-pre-line text-ink-soft">{decode(s.eligibilityMd)}</p>
        </details>
      )}

      {editing && (
        <div className="space-y-2">
          <label htmlFor={`${uid}-rules`} className="label">Rules (JSON)</label>
          <textarea id={`${uid}-rules`} className="field min-h-[220px] font-mono text-xs" value={json} onChange={(e) => setJson(e.target.value)} spellCheck={false} />
          <p className="text-xs text-ink-faint">
            Each predicate: {"{"} &quot;field&quot;: age | gender | state | residence | caste | annual_income | occupation | … ,
            &quot;op&quot;: in | eq | gte | lte | between, &quot;value&quot;: … {"}"}. Labels are regenerated on save.
          </p>
        </div>
      )}

      <div>
        <label htmlFor={`${uid}-note`} className="label">Curator note</label>
        <input id={`${uid}-note`} className="field mt-1" value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} placeholder="Why these rules are right (optional)" />
      </div>

      <div className="flex flex-wrap gap-2">
        {editing ? (
          <>
            <button type="button" className="btn-primary" disabled={pending} onClick={() => save("edited", true)}>Save rules</button>
            <button type="button" className="btn-ghost" disabled={pending} onClick={() => setEditing(false)}>Cancel</button>
          </>
        ) : (
          <>
            <button type="button" className="btn-primary" disabled={pending} onClick={() => save("approved", false)}>Approve rules as they are</button>
            <button type="button" className="btn-ghost" disabled={pending} onClick={() => setEditing(true)}>Edit rules</button>
            {s.reviewStatus !== "flagged" && (
              <button type="button" className="btn-ghost" disabled={pending} onClick={() => save("flagged", false)}>Flag for review</button>
            )}
          </>
        )}
      </div>
      {msg && <p role="status" className={msg.ok ? "text-sm text-green-700" : "text-sm text-red-700"}>{msg.text}</p>}
    </article>
  );
}
