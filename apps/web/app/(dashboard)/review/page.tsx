import Link from "next/link";
import { PageHeader } from "@/components/ui";
import { ReviewItem, type ReviewScheme } from "@/components/review-item";
import { fmt } from "@/lib/format";
import { api } from "@/lib/server-api";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const STATUSES = [
  { value: "flagged", label: "Flagged" },
  { value: "edited", label: "Edited" },
  { value: "approved", label: "Approved" },
  { value: "auto", label: "Automatic" },
  { value: "all", label: "All" },
];

export default async function ReviewPage({ searchParams }: { searchParams: { status?: string; page?: string; q?: string } }) {
  const status = STATUSES.some((s) => s.value === searchParams.status) ? searchParams.status! : "flagged";
  const page = Math.max(1, Number(searchParams.page) || 1);
  const q = searchParams.q?.trim() ?? "";
  const params = new URLSearchParams({ status, page: String(page), ...(q ? { q } : {}) });
  const data = await api<{ total: number; page: number; size: number; items: ReviewScheme[] }>(`/admin/review?${params}`);
  const pages = Math.max(1, Math.ceil(data.total / data.size));
  const link = (p: Record<string, string>) => `/review?${new URLSearchParams({ status, ...(q ? { q } : {}), ...p })}`;

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Rule normalisation" title="Review queue">
        Schemes whose eligibility text could not be normalised cleanly are flagged here (FR-08). Approve
        the rules Haqdaar.ai derived, or correct them. Edited rules survive later scrapes, and every change
        becomes a new corpus version.
      </PageHeader>

      <div className="flex flex-wrap items-center gap-2">
        {STATUSES.map((s) => (
          <Link
            key={s.value}
            href={`/review?status=${s.value}${q ? `&q=${encodeURIComponent(q)}` : ""}`}
            aria-current={status === s.value ? "page" : undefined}
            className={cn("rounded-full px-3.5 py-1.5 text-sm font-medium", status === s.value ? "bg-violet-600 text-white" : "border border-line bg-white text-ink-soft hover:text-ink")}
          >
            {s.label}
          </Link>
        ))}
        <form className="ml-auto flex gap-2" action="/review">
          <input type="hidden" name="status" value={status} />
          <input name="q" defaultValue={q} className="field w-60" placeholder="Search schemes…" aria-label="Search schemes" />
          <button type="submit" className="btn-ghost">Search</button>
        </form>
      </div>

      <p className="text-sm text-ink-soft">{fmt(data.total)} schemes</p>

      <div className="space-y-4">
        {data.items.length === 0 && <p className="card text-center text-sm text-ink-soft">Nothing here.</p>}
        {data.items.map((s) => <ReviewItem key={s.slug} s={s} />)}
      </div>

      {pages > 1 && (
        <nav className="flex items-center justify-center gap-3 text-sm" aria-label="Pagination">
          {page > 1 ? <Link className="btn-ghost" href={link({ page: String(page - 1) })}>Previous</Link> : <span />}
          <span className="text-ink-soft">Page {fmt(page)} of {fmt(pages)}</span>
          {page < pages ? <Link className="btn-ghost" href={link({ page: String(page + 1) })}>Next</Link> : <span />}
        </nav>
      )}
    </div>
  );
}
