import Link from "next/link";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { PageHeader, PageStack } from "@/components/page-header";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";
import { studentGroupDisplay } from "@/lib/subject-stream";

function money(value: number) {
  return value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export default async function StudentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireRole(["ORG_ADMIN"]);
  const organizationId = session.user.organizationId;
  const { id } = await params;
  if (!organizationId) notFound();

  const [student, fields] = await Promise.all([
    prisma.student.findFirst({
      where: { id, organizationId },
      include: {
        section: {
          select: {
            id: true,
            name: true,
            class: { select: { id: true, name: true, board: { select: { name: true } } } },
          },
        },
        customValues: {
          where: { field: { organizationId } },
          select: { fieldId: true, value: true },
        },
        feeCharges: {
          where: { organizationId },
          orderBy: { createdAt: "desc" },
          include: {
            feeHead: { select: { name: true } },
            allocations: { select: { amount: true } },
          },
        },
        feePayments: {
          where: { organizationId },
          orderBy: { paidAt: "desc" },
          include: {
            allocations: {
              select: {
                amount: true,
                charge: {
                  select: {
                    periodKey: true,
                    feeHead: { select: { name: true } },
                  },
                },
              },
            },
          },
        },
      },
    }),
    prisma.studentFieldDefinition.findMany({
      where: { organizationId },
      orderBy: [{ order: "asc" }, { createdAt: "asc" }],
      select: { id: true, label: true, type: true, isActive: true },
    }),
  ]);
  if (!student) notFound();

  const values = new Map(
    student.customValues.map((value) => [value.fieldId, value.value]),
  );
  const charged = student.feeCharges.reduce(
    (sum, charge) => sum + Number(charge.amount),
    0,
  );
  const allocated = student.feeCharges.reduce(
    (sum, charge) =>
      sum +
      charge.allocations.reduce(
        (allocationSum, allocation) =>
          allocationSum + Number(allocation.amount),
        0,
      ),
    0,
  );
  const paid = student.feePayments.reduce(
    (sum, payment) => sum + Number(payment.amount),
    0,
  );

  return (
    <PageStack wide>
      <PageHeader
        kicker="Student Profile"
        title={student.name}
        description={`Roll ${student.rollNumber} · ${student.section.class.board.name} · ${student.section.class.name} · ${student.section.name}`}
        actions={
          <div className="flex flex-wrap gap-2">
            <Link
              href={`/org-admin/students?classId=${student.section.class.id}&sectionId=${student.section.id}`}
            >
              <Button variant="secondary">Back to Section</Button>
            </Link>
            <Link href={`/org-admin/students/${student.id}/edit`}>
              <Button variant="outline">Edit</Button>
            </Link>
            <Link href={`/org-admin/results/students/${student.id}`}>
              <Button variant="secondary">View results</Button>
            </Link>
            <Link href={`/org-admin/fees/collect?studentId=${student.id}`}>
              <Button>Collect Fee</Button>
            </Link>
          </div>
        }
      />

      <div className="grid gap-5 lg:grid-cols-[1fr_1fr]">
        <Card>
          <div className="flex items-center justify-between gap-3">
            <CardTitle>Profile</CardTitle>
            <span className={student.isActive ? "status-chip status-chip-success" : "status-chip status-chip-muted"}>
              {student.isActive ? "Active" : "Inactive"}
            </span>
          </div>
          <dl className="mt-5 grid gap-4 sm:grid-cols-2">
            {[
              ["Roll number", student.rollNumber],
              ["Father name", student.fatherName],
              ["Phone", student.phone],
              ["Group", studentGroupDisplay(student)],
              ["Board", student.section.class.board.name],
              ["Class", student.section.class.name],
              ["Section", student.section.name],
            ].map(([label, value]) => (
              <div key={label}>
                <dt className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</dt>
                <dd className="mt-1 text-sm font-medium text-ink">{value}</dd>
              </div>
            ))}
          </dl>
        </Card>

        <Card>
          <CardTitle>Additional details</CardTitle>
          {fields.length ? (
            <dl className="mt-5 grid gap-4 sm:grid-cols-2">
              {fields.map((field) => {
                const raw = values.get(field.id);
                const value =
                  field.type === "BOOLEAN" && raw
                    ? raw === "true" ? "Yes" : "No"
                    : raw || "—";
                return (
                  <div key={field.id}>
                    <dt className="text-xs font-semibold uppercase tracking-wide text-muted">
                      {field.label}
                      {!field.isActive ? " (inactive)" : ""}
                    </dt>
                    <dd className="mt-1 text-sm font-medium text-ink">{value}</dd>
                  </div>
                );
              })}
            </dl>
          ) : (
            <CardDescription>No custom fields are configured.</CardDescription>
          )}
        </Card>
      </div>

      <div className="grid gap-5 sm:grid-cols-3">
        <Card>
          <p className="text-sm text-muted">Total charged</p>
          <p className="mt-2 font-display text-2xl font-semibold text-ink">{money(charged)}</p>
        </Card>
        <Card>
          <p className="text-sm text-muted">Total payments</p>
          <p className="mt-2 font-display text-2xl font-semibold text-brand">{money(paid)}</p>
        </Card>
        <Card>
          <p className="text-sm text-muted">Outstanding</p>
          <p className="mt-2 font-display text-2xl font-semibold text-ink">
            {money(Math.max(0, charged - allocated))}
          </p>
        </Card>
      </div>

      <Card className="overflow-hidden p-0">
        <div className="border-b border-[rgba(15,40,70,0.08)] px-5 py-4">
          <CardTitle>Fee charges</CardTitle>
          <CardDescription>Charges and their current paid balance.</CardDescription>
        </div>
        <div className="overflow-x-auto p-5">
          {student.feeCharges.length ? (
            <table className="min-w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-2 py-2">Fee</th>
                  <th className="px-2 py-2">Period</th>
                  <th className="px-2 py-2">Due</th>
                  <th className="px-2 py-2">Amount</th>
                  <th className="px-2 py-2">Paid</th>
                  <th className="px-2 py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {student.feeCharges.map((charge) => (
                  <tr key={charge.id} className="border-t border-[rgba(15,40,70,0.07)]">
                    <td className="px-2 py-3 font-medium text-ink">{charge.feeHead.name}</td>
                    <td className="px-2 py-3">{charge.periodKey}</td>
                    <td className="px-2 py-3">{charge.dueDate?.toLocaleDateString() ?? "—"}</td>
                    <td className="px-2 py-3">{money(Number(charge.amount))}</td>
                    <td className="px-2 py-3">
                      {money(charge.allocations.reduce((sum, row) => sum + Number(row.amount), 0))}
                    </td>
                    <td className="px-2 py-3">{charge.status.replace("_", " ")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="text-sm text-muted">No fee charges yet.</p>
          )}
        </div>
      </Card>

      <Card className="overflow-hidden p-0">
        <div className="border-b border-[rgba(15,40,70,0.08)] px-5 py-4">
          <CardTitle>Payment history</CardTitle>
          <CardDescription>
            Kis month ki fee, kitni amount, kis date ko submit hui.
          </CardDescription>
        </div>
        <div className="overflow-x-auto p-5">
          {student.feePayments.length ? (
            <table className="min-w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-2 py-2">Submit date</th>
                  <th className="px-2 py-2">Fee type</th>
                  <th className="px-2 py-2">For month</th>
                  <th className="px-2 py-2">Amount</th>
                  <th className="px-2 py-2">Receipt</th>
                  <th className="px-2 py-2">Method</th>
                </tr>
              </thead>
              <tbody>
                {student.feePayments.map((payment) => {
                  const feeLabel =
                    payment.allocations
                      .map((row) => row.charge.feeHead.name)
                      .filter(Boolean)
                      .join(", ") || "—";
                  const months =
                    payment.allocations
                      .map((row) => row.charge.periodKey)
                      .filter(Boolean)
                      .join(", ") || "—";
                  return (
                    <tr key={payment.id} className="border-t border-[rgba(15,40,70,0.07)]">
                      <td className="px-2 py-3">
                        {payment.paidAt.toLocaleDateString("en-PK", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        })}
                      </td>
                      <td className="px-2 py-3 font-medium text-ink">{feeLabel}</td>
                      <td className="px-2 py-3">{months}</td>
                      <td className="px-2 py-3">{money(Number(payment.amount))}</td>
                      <td className="px-2 py-3">
                        <Link
                          href={`/org-admin/fees/receipts/${payment.id}`}
                          className="font-medium text-brand hover:underline"
                        >
                          {payment.receiptNumber}
                        </Link>
                      </td>
                      <td className="px-2 py-3">{payment.method.replaceAll("_", " ")}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <p className="text-sm text-muted">No payments recorded yet.</p>
          )}
        </div>
      </Card>
    </PageStack>
  );
}
