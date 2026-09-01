import Link from "next/link";

export function Nav() {
  return (
    <nav className="border-b border-neutral-200 bg-white">
      <div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between">
        <Link href="/" className="text-sm font-mono">
          livelihood_setu <span className="text-neutral-400">/ officer</span>
        </Link>
        <div className="flex gap-4 text-sm text-neutral-600">
          <Link href="/">Districts</Link>
          <Link href="/leads">Leads</Link>
        </div>
      </div>
    </nav>
  );
}
