import { api } from "@/lib/utils";
import { BeneficiariesView, type Beneficiary } from "@/components/beneficiaries-view";

export const dynamic = "force-dynamic";

export default async function BeneficiariesPage() {
  const { beneficiaries, count } = await api<{ beneficiaries: Beneficiary[]; count: number }>(
    "/admin/beneficiaries"
  ).catch(() => ({ beneficiaries: [], count: 0 }));

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold">Beneficiaries</h1>
        <p className="text-neutral-600 text-sm">
          The full, persistent record of everyone counselled ({count} total) —
          grouped by state, sorted by district, interest and most recent first.
          Not just the current session.
        </p>
      </div>
      <BeneficiariesView rows={beneficiaries} />
    </div>
  );
}
