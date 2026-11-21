"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "@/app/actions";
import { HaqdaarLogo } from "@/components/ui";
import { PLATFORM } from "@/lib/brand";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/", label: "Overview", on: (p: string) => p === "/" },
  { href: "/review", label: "Review queue", on: (p: string) => p.startsWith("/review") },
  { href: "/runs", label: "Scrape runs", on: (p: string) => p.startsWith("/runs") },
  { href: "/matches", label: "Match log", on: (p: string) => p.startsWith("/matches") },
];

// Logo on the left and the signed-in curator always on the right. On wide
// screens the links sit between them; otherwise they get a row of their own.
export function Nav({ curator }: { curator: string | null }) {
  const path = usePathname() || "/";
  return (
    <header className="mx-auto max-w-6xl px-4 pt-4 sm:pt-7">
      <nav
        aria-label="Main"
        className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-6 gap-y-3 rounded-2xl border border-line bg-white/80 py-3 pl-5 pr-3 shadow-card backdrop-blur-md xl:grid-cols-[auto_minmax(0,1fr)_auto]"
      >
        <Link href="/" className="col-start-1 row-start-1 min-w-0 self-center" aria-label={`Haqdaar.ai ${PLATFORM}: overview`}>
          <HaqdaarLogo tag={PLATFORM} />
        </Link>

        <div className="col-span-2 row-start-2 flex flex-wrap gap-1 text-sm xl:col-span-1 xl:col-start-2 xl:row-start-1 xl:justify-self-center">
          {LINKS.map((l) => {
            const current = l.on(path);
            return (
              <Link
                key={l.href}
                href={l.href}
                aria-current={current ? "page" : undefined}
                className={cn(
                  "rounded-full px-3.5 py-1.5 font-medium transition",
                  current ? "bg-violet-600 text-white shadow-glow" : "text-ink-soft hover:bg-violet-50 hover:text-ink",
                )}
              >
                {l.label}
              </Link>
            );
          })}
        </div>

        <div className="col-start-2 row-start-1 flex items-center gap-2.5 justify-self-end text-sm xl:col-start-3">
          {curator && (
            <span className="flex min-w-0 items-center gap-2 text-ink-soft" title={`Signed in as ${curator}`}>
              <span aria-hidden="true" className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-violet-100 font-semibold text-violet-700">
                {Array.from(curator)[0]?.toUpperCase()}
              </span>
              <span className="hidden max-w-[10rem] truncate sm:inline">
                <span className="sr-only">Signed in as </span>
                {curator}
              </span>
            </span>
          )}
          <form action={signOut}>
            <button type="submit" className="btn-ghost whitespace-nowrap">Sign out</button>
          </form>
        </div>
      </nav>
    </header>
  );
}
