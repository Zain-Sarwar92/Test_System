import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { PageHeader, PageStack } from "@/components/page-header";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";
import { generateFeeCharges } from "../actions";
import { FeesNav, FlashMessage, formatPkr } from "../components";

type Props = {
  searchParams: Promise<{ success?: string; error?: string }>;
};

export default async function GenerateFeesPage({ searchParams }: Props) {
  const session = await requireRole(["ORG_ADMIN"]);
  const organizationId = session.user.organizationId;
  if (!organizationId) throw new Error("Organization not linked to this admin");
  const messages = await searchParams;
  const plans = await prisma.feePlan.findMany({
    where: {
      organizationId,
      isActive: true,
      items: { some: { feeHead: { organizationId, isActive: true } } },
    },
    orderBy: { name: "asc" },
    include: {
      class: { select: { name: true, board: { select: { name: true } } } },
      section: { select: { name: true } },
      items: {
        where: { feeHead: { organizationId, isActive: true } },
        include: { feeHead: { select: { name: true } } },
      },
    },
  });
  const currentPeriod = new Date().toISOString().slice(0, 7);

  return (
    <PageStack wide>
      <PageHeader
        kicker="Fees"
        title="Generate dues"
        description="Create charges for active students from an active fee plan."
      />
      <FeesNav />
      <FlashMessage success={messages.success} error={messages.error} />

      <div className="grid gap-5 lg:grid-cols-[0.9fr_1.4fr]">
        <Card>
          <CardTitle>Generate charges</CardTitle>
          <CardDescription>
            Generation is manual for the selected period. Existing student + fee head + period
            charges are skipped.
          </CardDescription>
          <form action={generateFeeCharges} className="mt-5 space-y-4">
            <label className="block">
              <span className="mb-1.5 block text-sm font-semibold text-ink">Fee plan *</span>
              <select name="planId" required className="field-control h-11 w-full">
                <option value="">Select active plan</option>
                {plans.map((plan) => (
                  <option key={plan.id} value={plan.id}>
                    {plan.name} — {plan.class.name}
                    {plan.section ? ` / ${plan.section.name}` : " / All sections"}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-semibold text-ink">
                Period (YYYY-MM) *
              </span>
              <Input
                name="periodKey"
                type="month"
                required
                defaultValue={currentPeriod}
                pattern="\d{4}-(0[1-9]|1[0-2])"
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-semibold text-ink">
                Due date (optional)
              </span>
              <Input name="dueDate" type="date" />
            </label>
            <Button type="submit" disabled={!plans.length}>
              Generate dues
            </Button>
          </form>
        </Card>

        <Card>
          <CardTitle>Active plans</CardTitle>
          <CardDescription>Review the exact items that will be generated.</CardDescription>
          <div className="mt-4 space-y-3">
            {plans.map((plan) => (
              <div
                key={plan.id}
                className="rounded-xl border border-[rgba(15,40,70,0.08)] bg-white p-4"
              >
                <p className="font-semibold text-ink">{plan.name}</p>
                <p className="text-xs text-muted">
                  {plan.class.board.name} · {plan.class.name} ·{" "}
                  {plan.section ? `Section ${plan.section.name}` : "All class sections"}
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {plan.items.map((item) => (
                    <span key={item.id} className="status-chip">
                      {item.feeHead.name}: {formatPkr(item.amount)} ({item.frequency.replace("_", " ")})
                    </span>
                  ))}
                </div>
              </div>
            ))}
            {!plans.length ? (
              <p className="rounded-xl bg-mist/50 px-4 py-6 text-sm text-muted">
                No active fee plan with active items is available.
              </p>
            ) : null}
          </div>
        </Card>
      </div>
    </PageStack>
  );
}
