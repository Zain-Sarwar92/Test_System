import Link from "next/link";
import { Prisma } from "@/generated/prisma/client";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { PageHeader, PageStack } from "@/components/page-header";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";
import { FeesNav, formatPkr, StatCard } from "./components";

export default async function FeesOverviewPage() {
  const session = await requireRole(["ORG_ADMIN"]);
  const organizationId = session.user.organizationId;
  if (!organizationId) throw new Error("Organization not linked to this admin");

  const [charges, collected, statusGroups, recentPayments] = await Promise.all([
    prisma.feeCharge.findMany({
      where: { organizationId, status: { not: "WAIVED" } },
      select: { amount: true, allocations: { select: { amount: true } } },
    }),
    prisma.feePayment.aggregate({
      where: { organizationId },
      _sum: { amount: true },
    }),
    prisma.feeCharge.groupBy({
      by: ["status"],
      where: { organizationId },
      _count: { _all: true },
    }),
    prisma.feePayment.findMany({
      where: { organizationId },
      orderBy: [{ paidAt: "desc" }, { createdAt: "desc" }],
      take: 8,
      select: {
        id: true,
        receiptNumber: true,
        amount: true,
        paidAt: true,
        method: true,
        student: { select: { name: true, rollNumber: true } },
      },
    }),
  ]);

  const charged = charges.reduce(
    (sum, charge) => sum.plus(charge.amount),
    new Prisma.Decimal(0),
  );
  const allocated = charges.reduce(
    (total, charge) =>
      total.plus(
        charge.allocations.reduce(
          (sum, allocation) => sum.plus(allocation.amount),
          new Prisma.Decimal(0),
        ),
      ),
    new Prisma.Decimal(0),
  );
  const outstanding = charged.minus(allocated);
  const counts = Object.fromEntries(
    statusGroups.map((group) => [group.status, group._count._all]),
  ) as Record<string, number>;

  return (
    <PageStack wide>
      <PageHeader
        kicker="Finance"
        title="Fees overview"
        description="Track charges, collections, outstanding dues, and recent receipts."
        actions={
          <Link href="/org-admin/fees/collect">
            <Button>Collect payment</Button>
          </Link>
        }
      />
      <FeesNav />

      <div className="grid gap-4 md:grid-cols-3">
        <StatCard
          label="Charged"
          value={formatPkr(charged)}
          detail="Excludes waived charges"
          tone="charged"
        />
        <StatCard
          label="Collected"
          value={formatPkr(collected._sum.amount ?? new Prisma.Decimal(0))}
          tone="collected"
        />
        <StatCard label="Outstanding" value={formatPkr(outstanding)} tone="outstanding" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {(["UNPAID", "PARTIAL", "PAID", "WAIVED"] as const).map((status) => (
          <StatCard
            key={status}
            label={status.replace("_", " ")}
            value={String(counts[status] ?? 0)}
            detail="charge records"
            tone={status.toLowerCase()}
          />
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_1.4fr]">
        <Card>
          <CardTitle>Fee operations</CardTitle>
          <CardDescription>Set up structures, generate monthly dues, then collect.</CardDescription>
          <div className="mt-5 grid gap-2">
            {[
              ["/org-admin/fees/structures", "Manage fee structures"],
              ["/org-admin/fees/generate", "Generate dues"],
              ["/org-admin/fees/collect", "Collect a payment"],
              ["/org-admin/fees/dues", "View dues and ledger"],
            ].map(([href, label]) => (
              <Link
                key={href}
                href={href}
                className="rounded-xl border border-[rgba(15,40,70,0.09)] bg-card px-4 py-3 text-sm font-semibold text-ink transition hover:border-brand/35"
              >
                {label}
              </Link>
            ))}
          </div>
        </Card>

        <Card>
          <CardTitle>Recent payments</CardTitle>
          <CardDescription>Latest receipts recorded for this organization.</CardDescription>
          <div className="mt-4 space-y-2">
            {recentPayments.length ? (
              recentPayments.map((payment) => (
                <div
                  key={payment.id}
                  className="flex flex-col gap-2 rounded-xl border border-[rgba(15,40,70,0.08)] bg-card px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="font-semibold text-ink">{payment.student.name}</p>
                    <p className="text-xs text-muted">
                      {payment.receiptNumber} · Roll {payment.student.rollNumber} ·{" "}
                      {payment.paidAt.toLocaleDateString("en-PK")}
                    </p>
                  </div>
                  <div className="sm:text-right">
                    <p className="font-semibold text-brand">{formatPkr(payment.amount)}</p>
                    <p className="text-xs text-muted">{payment.method.replace("_", " ")}</p>
                  </div>
                </div>
              ))
            ) : (
              <p className="rounded-xl bg-mist/50 px-4 py-6 text-sm text-muted">
                No payments recorded yet.
              </p>
            )}
          </div>
        </Card>
      </div>
    </PageStack>
  );
}
