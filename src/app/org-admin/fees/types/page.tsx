import Link from "next/link";
import { PageHeader, PageStack } from "@/components/page-header";
import { feeCategoryLabel } from "@/lib/fee-categories";
import {
  feeHeadFrequencyLabel,
  feeHeadMonthsLabel,
} from "@/lib/fee-head-rules";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";
import { FlashMessage } from "../components";
import { ensureDefaultFeeHeads } from "@/lib/ensure-fee-heads";
import { CreateFeeTypeForm, FeeTypeCard } from "./fee-type-forms";

type Props = {
  searchParams: Promise<{ success?: string; error?: string }>;
};

export default async function FeeTypesPage({ searchParams }: Props) {
  const session = await requireRole(["ORG_ADMIN"]);
  const organizationId = session.user.organizationId;
  if (!organizationId) throw new Error("Organization not linked to this admin");

  await ensureDefaultFeeHeads(organizationId);

  const filters = await searchParams;
  const heads = await prisma.feeHead.findMany({
    where: { organizationId },
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      category: true,
      frequency: true,
      defaultAmount: true,
      applicableMonths: true,
      description: true,
      isActive: true,
    },
  });

  return (
    <PageStack wide>
      <PageHeader
        kicker="Finance"
        title="Fee types"
        description="Amount, one-time vs monthly, aur specific months — yahi se system decide karega."
      />
      <FlashMessage success={filters.success} error={filters.error} />

      <div className="flex flex-wrap gap-2">
        <Link
          href="/org-admin/fees"
          className="text-sm font-semibold text-brand hover:underline"
        >
          ← Back to fees
        </Link>
      </div>

      <div className="grid gap-4">
        {heads.map((head) => (
          <div key={head.id} className="space-y-2">
            <p className="px-1 text-xs text-muted">
              {feeCategoryLabel(head.category)} · {feeHeadFrequencyLabel(head.frequency)} ·{" "}
              {feeHeadMonthsLabel(head.applicableMonths)}
              {head.defaultAmount != null
                ? ` · default PKR ${head.defaultAmount.toFixed(2)}`
                : ""}
            </p>
            <FeeTypeCard
              head={{
                id: head.id,
                name: head.name,
                category: head.category,
                frequency: head.frequency,
                defaultAmount: head.defaultAmount?.toFixed(2) ?? null,
                applicableMonths: head.applicableMonths,
                description: head.description,
                isActive: head.isActive,
              }}
            />
          </div>
        ))}
      </div>

      <CreateFeeTypeForm />
    </PageStack>
  );
}
