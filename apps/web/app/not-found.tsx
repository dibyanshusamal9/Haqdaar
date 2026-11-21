import Link from "next/link";
import { HaqdaarLogo } from "@/components/ui";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-4 text-center">
      <HaqdaarLogo size="lg" />
      <div className="card mt-8 w-full">
        <h1 className="text-lg font-semibold tracking-tight text-ink">We couldn&apos;t find that page</h1>
        <p className="mt-1 text-sm text-ink-soft">The scheme or record may have been renamed or withdrawn.</p>
        <Link href="/" className="btn-primary mt-4">Go to the overview</Link>
      </div>
    </main>
  );
}
