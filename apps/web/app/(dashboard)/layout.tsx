import { Nav } from "@/components/nav";
import { curatorName } from "@/lib/server-api";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Nav curator={curatorName()} />
      <main className="mx-auto max-w-6xl px-4 pb-20">{children}</main>
    </>
  );
}
