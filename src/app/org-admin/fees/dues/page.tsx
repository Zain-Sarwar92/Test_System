import { Prisma, type FeeChargeStatus } from "@/generated/prisma/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { PageHeader, PageStack } from "@/components/page-header";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";
import { waiveFeeCharge } from "../actions";
import { FeesNav, FlashMessage, formatPkr } from "../components";

type Props = {
  searchParams: Promise<{
    period?: string;
    classId?: string;
    sectionId?: string;
    status?: string;
    q?: string;
    success?: string;
    error?: string;
  }>;
};

const statuses: FeeChargeStatus[] = ["UNPAID", "PARTIAL", "PAID", "WAIVED"];

export default async function FeeDuesPage({ searchParams }: Props) {
  const session = await requireRole(["ORG_ADMIN"]);
  const organizationId = session.user.organizationId;
  if (!organizationId) throw new Error("Organization not linked to this admin");
  const filters = await searchParams;
  const status = statuses.includes(filters.status as FeeChargeStatus)
    ? (filters.status as FeeChargeStatus)
    : undefined;

  const where: Prisma.FeeChargeWhereInput = {
    organizationId,
    periodKey: filters.period || undefined,
    status,
    student: {
      organizationId,
      sectionId: filters.sectionId || undefined,
      section: {
        organizationId,
        classId: filters.classId || undefined,
      },
      OR: filters.q
        ? [
            { name: { contains: filters.q, mode: "insensitive" } },
            { rollNumber: { contains: filters.q, mode: "insensitive" } },
            { fatherName: { contains: filters.q, mode: "insensitive" } },
          ]
        : undefined,
    },
  };

  const [charges, classes, sections] = await Promise.all([
    prisma.feeCharge.findMany({
      where,
      orderBy: [{ periodKey: "desc" }, { student: { name: "asc" } }],
      take: 500,
      include: {
        feeHead: { select: { name: true } },
        student: {
          select: {
            name: true,
            rollNumber: true,
            section: {
              select: { name: true, class: { select: { name: true } } },
            },
          },
        },
        allocations: { select: { amount: true } },
      },
    }),
    prisma.class.findMany({
      where: { sections: { some: { organizationId } } },
      orderBy: { name: "asc" },
      select: { id: true, name: true, board: { select: { name: true } } },
    }),
    prisma.section.findMany({
      where: { organizationId, classId: filters.classId || undefined },
      orderBy: { name: "asc" },
      select: { id: true, name: true, classId: true, class: { select: { name: true } } },
    }),
  ]);

  const totalAmount = charges.reduce(
    (sum, charge) =>
      charge.status === "WAIVED" ? sum : sum.plus(charge.amount),
    new Prisma.Decimal(0),
  );
  const totalPaid = charges.reduce(
    (sum, charge) =>
      sum.plus(
        charge.allocations.reduce(
          (paid, allocation) => paid.plus(allocation.amount),
          new Prisma.Decimal(0),
        ),
      ),
    new Prisma.Decimal(0),
  );

  return (
    <PageStack wide>
      <PageHeader
        kicker="Fees"
        title="Dues & ledger"
        description="Filter student charges and review paid amounts and balances."
      />
      <FeesNav />
      <FlashMessage success={filters.success} error={filters.error} />

      <Card>
        <form method="get" className="grid gap-3 md:grid-cols-6">
          <Input name="period" type="month" defaultValue={filters.period} aria-label="Period" />
          <select
            name="classId"
            defaultValue={filters.classId}
            className="field-control h-11 w-full"
            aria-label="Class"
          >
            <option value="">All classes</option>
            {classes.map((klass) => (
              <option key={klass.id} value={klass.id}>
                {klass.board.name} — {klass.name}
              </option>
            ))}
          </select>
          <select
            name="sectionId"
            defaultValue={filters.sectionId}
            className="field-control h-11 w-full"
            aria-label="Section"
          >
            <option value="">All sections</option>
            {sections.map((section) => (
              <option key={section.id} value={section.id}>
                {section.class.name} — {section.name}
              </option>
            ))}
          </select>
          <select
            name="status"
            defaultValue={filters.status}
            className="field-control h-11 w-full"
            aria-label="Status"
          >
            <option value="">All statuses</option>
            {statuses.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
          <Input
            name="q"
            defaultValue={filters.q}
            placeholder="Student / roll / father"
            aria-label="Student search"
          />
          <Button type="submit">Apply filters</Button>
        </form>
      </Card>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="org-dash-card tone-surface-charged">
          <p className="org-dash-card-label">Filtered charges</p>
          <p className="org-dash-card-value text-xl">{formatPkr(totalAmount)}</p>
        </div>
        <div className="org-dash-card tone-surface-collected">
          <p className="org-dash-card-label">Paid by allocations</p>
          <p className="org-dash-card-value text-xl">{formatPkr(totalPaid)}</p>
        </div>
        <div className="org-dash-card tone-surface-outstanding">
          <p className="org-dash-card-label">Balance</p>
          <p className="org-dash-card-value text-xl">
            {formatPkr(totalAmount.minus(totalPaid))}
          </p>
        </div>
      </div>

      <Card className="overflow-hidden p-0">
        <div className="border-b border-line px-5 py-4">
          <CardTitle>Charge ledger</CardTitle>
          <CardDescription>Showing up to 500 matching charges.</CardDescription>
        </div>
        <div className="nice-scroll overflow-x-auto">
          <table className="w-full min-w-[950px] text-left text-sm">
            <thead className="bg-mist/60 text-xs text-muted uppercase">
              <tr>
                <th className="px-4 py-3">Student</th>
                <th className="px-4 py-3">Class / section</th>
                <th className="px-4 py-3">Period / fee</th>
                <th className="px-4 py-3 text-right">Amount</th>
                <th className="px-4 py-3 text-right">Paid</th>
                <th className="px-4 py-3 text-right">Balance</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Action</th>
              </tr>
            </thead>
            <tbody>
              {charges.map((charge) => {
                const paid = charge.allocations.reduce(
                  (sum, allocation) => sum.plus(allocation.amount),
                  new Prisma.Decimal(0),
                );
                const balance =
                  charge.status === "WAIVED" ? new Prisma.Decimal(0) : charge.amount.minus(paid);
                return (
                  <tr key={charge.id} className="border-t border-line">
                    <td className="px-4 py-3">
                      <p className="font-semibold text-ink">{charge.student.name}</p>
                      <p className="text-xs text-muted">Roll {charge.student.rollNumber}</p>
                    </td>
                    <td className="px-4 py-3 text-ink-soft">
                      {charge.student.section.class.name} / {charge.student.section.name}
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-ink">{charge.periodKey}</p>
                      <p className="text-xs text-muted">{charge.feeHead.name}</p>
                    </td>
                    <td className="px-4 py-3 text-right">{formatPkr(charge.amount)}</td>
                    <td className="px-4 py-3 text-right">{formatPkr(paid)}</td>
                    <td className="px-4 py-3 text-right font-semibold">{formatPkr(balance)}</td>
                    <td className="px-4 py-3">
                      <span className="status-chip">{charge.status}</span>
                    </td>
                    <td className="px-4 py-3">
                      {!charge.allocations.length &&
                      charge.status !== "WAIVED" &&
                      charge.status !== "PAID" ? (
                        <form action={waiveFeeCharge}>
                          <input type="hidden" name="chargeId" value={charge.id} />
                          <Button type="submit" size="sm" variant="outline">
                            Waive
                          </Button>
                        </form>
                      ) : (
                        <span className="text-xs text-muted">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!charges.length ? (
            <p className="px-5 py-10 text-center text-sm text-muted">No matching charges.</p>
          ) : null}
        </div>
      </Card>
    </PageStack>
  );
}
