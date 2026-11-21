import type { Metadata } from "next";
import { SignInForm } from "@/components/signin-form";
import { HaqdaarLogo } from "@/components/ui";
import { PLATFORM } from "@/lib/brand";

export const metadata: Metadata = { title: `Sign in · Haqdaar.ai ${PLATFORM}` };

export default function SignInPage({ searchParams }: {
  searchParams: { next?: string; reason?: string };
}) {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-4 py-12">
      <div className="mb-8 flex flex-col items-center text-center">
        <HaqdaarLogo size="lg" />
        <span className="eyebrow mt-5">{PLATFORM}</span>
      </div>
      <SignInForm next={searchParams.next ?? "/"} expired={searchParams.reason === "expired"} />
      <p className="mt-6 text-center text-xs text-ink-soft">
        For the Admin / Curator who runs the scraper and reviews scheme rules. The access code is
        ADMIN_ACCESS_CODE in the API&apos;s .env.
      </p>
    </main>
  );
}
