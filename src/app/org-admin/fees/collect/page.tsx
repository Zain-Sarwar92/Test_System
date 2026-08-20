import Link from "next/link";
import { Prisma } from "@/generated/prisma/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { PageHeader, PageStack } from "@/components/page-header";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";
import { collectFeePayment } from "../actions";
import { FeesNav, FlashMessage, formatPkr } from "../components";

type Props = {
  searchParams: Promise<{
    q?: string;
    studentId?: string;
    success?: string;
    error?: string;
  }>;
};

export default async function CollectFeePage({ searchParams }: Props) {
  const session = await requireRole(["ORG_ADMIN"]);
  const organizationId = session.user.organizationId;
  if (!organizationId) throw new Error("Organization not linked to this admin");
  const params = await searchParams;
  const today = new Date().toISOString().slice(0, 10);

  const students = params.q
    ? await prisma.student.findMany({
        where: {
          organizationId,
          isActive: true,
          OR: [
            { name: { contains: params.q, mode: "insensitive" } },
            { rollNumber: { contains: params.q, mode: "insensitive" } },
            { fatherName: { contains: params.q, mode: "insensitive" } },
            { phone: { contains: params.q } },
          ],
        },
        orderBy: { name: "asc" },
        take: 25,
        select: {
          id: true,
          name: true,
          rollNumber: true,
          fatherName: true,
          section: { select: { name: true, class: { select: { name: true } } } },
        },
      })
    : [];

  const selectedStudent = params.studentId
    ? await prisma.student.findFirst({
        where: { id: params.studentId, organizationId, isActive: true },
        select: {
          id: true,
          name: true,
          rollNumber: true,
          fatherName: true,
          section: { select: { name: true, class: { select: { name: true } } } },
          feeCharges: {
            where: {
              organizationId,
              status: { in: ["UNPAID", "PARTIAL"] },
            },
            orderBy: [{ periodKey: "asc" }, { createdAt: "asc" }],
            select: {
              id: true,
              amount: true,
              periodKey: true,
              dueDate: true,
              description: true,
              feeHead: { select: { name: true } },
              allocations: { select: { amount: true } },
            },
          },
        },
      })
    : null;

  return (
    <PageStack wide>
      <PageHeader
        kicker="Fees"
        title="Collect payment"
        description="Find an active student, select an open charge, and issue a unique receipt."
      />
      <FeesNav />
      <FlashMessage success={params.success} error={params.error} />

      <Card>
        <CardTitle>Find student</CardTitle>
        <form method="get" className="mt-4 flex flex-col gap-3 sm:flex-row">
          <Input
            name="q"
            defaultValue={params.q}
            placeholder="Name, roll number, father name, or phone"
            className="flex-1"
            required
          />
          <Button type="submit">Search</Button>
        </form>
        {params.q ? (
          <div className="mt-4 grid gap-2 md:grid-cols-2">
            {students.map((student) => (
              <Link
                key={student.id}
                href={`/org-admin/fees/collect?studentId=${student.id}&q=${encodeURIComponent(params.q ?? "")}`}
                className="rounded-xl border border-[rgba(15,40,70,0.08)] bg-card px-4 py-3 transition hover:border-brand/35"
              >
                <p className="font-semibold text-ink">{student.name}</p>
                <p className="text-xs text-muted">
                  Roll {student.rollNumber} · {student.section.class.name} / {student.section.name} ·
                  Father: {student.fatherName}
                </p>
              </Link>
            ))}
            {!students.length ? <p className="text-sm text-muted">No active students found.</p> : null}
          </div>
        ) : null}
      </Card>

      {params.studentId && !selectedStudent ? (
        <FlashMessage error="This student was not found in your organization." />
      ) : null}

      {selectedStudent ? (
        <Card>
          <CardTitle>{selectedStudent.name}</CardTitle>
          <CardDescription>
            Roll {selectedStudent.rollNumber} · {selectedStudent.section.class.name} /{" "}
            {selectedStudent.section.name} · Father: {selectedStudent.fatherName}
          </CardDescription>
          <div className="mt-5 space-y-4">
            {selectedStudent.feeCharges.map((charge) => {
              const paid = charge.allocations.reduce(
                (sum, allocation) => sum.plus(allocation.amount),
                new Prisma.Decimal(0),
              );
              const balance = charge.amount.minus(paid);
              return (
                <div
                  key={charge.id}
                  className="rounded-[1rem] border border-[rgba(15,40,70,0.09)] bg-card p-4"
                >
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="font-semibold text-ink">
                        {charge.feeHead.name} · {charge.periodKey}
                      </p>
                      <p className="text-xs text-muted">
                        {charge.description || "Fee charge"}
                        {charge.dueDate
                          ? ` · Due ${charge.dueDate.toLocaleDateString("en-PK")}`
                          : ""}
                      </p>
                    </div>
                    <div className="sm:text-right">
                      <p className="font-semibold text-ink">{formatPkr(balance)} outstanding</p>
                      <p className="text-xs text-muted">
                        Charged {formatPkr(charge.amount)} · Paid {formatPkr(paid)}
                      </p>
                    </div>
                  </div>
                  <form action={collectFeePayment} className="mt-4 grid gap-3 md:grid-cols-5">
                    <input type="hidden" name="chargeId" value={charge.id} />
                    <input type="hidden" name="studentId" value={selectedStudent.id} />
                    <label className="block">
                      <span className="mb-1 block text-xs font-semibold text-muted">Amount</span>
                      <Input
                        name="amount"
                        required
                        inputMode="decimal"
                        defaultValue={balance.toFixed(2)}
                      />
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-xs font-semibold text-muted">Date</span>
                      <Input name="paidAt" type="date" required defaultValue={today} />
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-xs font-semibold text-muted">Method</span>
                      <select name="method" defaultValue="CASH" className="field-control h-11 w-full">
                        <option value="CASH">Cash</option>
                        <option value="BANK_TRANSFER">Bank transfer</option>
                        <option value="CARD">Card</option>
                        <option value="OTHER">Other</option>
                      </select>
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-xs font-semibold text-muted">Note</span>
                      <Input name="note" maxLength={500} placeholder="Optional" />
                    </label>
                    <div className="flex items-end">
                      <Button type="submit">Collect</Button>
                    </div>
                  </form>
                </div>
              );
            })}
            {!selectedStudent.feeCharges.length ? (
              <p className="rounded-xl bg-mist/50 px-4 py-8 text-center text-sm text-muted">
                This student has no unpaid or partially paid charges.
              </p>
            ) : null}
          </div>
        </Card>
      ) : null}
    </PageStack>
  );
}
