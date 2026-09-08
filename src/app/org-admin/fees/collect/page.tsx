import Link from "next/link";
import { PageHeader, PageStack } from "@/components/page-header";
import { ensureDefaultFeeHeads } from "@/lib/ensure-fee-heads";
import { ONE_TIME_PERIOD_KEY } from "@/lib/fee-head-rules";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";
import { FlashMessage } from "../components";
import { QuickCollectForm } from "./quick-collect-form";

function formatPeriodLabel(periodKey: string) {
  if (periodKey === ONE_TIME_PERIOD_KEY) return "One-time";
  const [year, month] = periodKey.split("-").map(Number);
  if (!year || !month) return periodKey;
  return new Date(year, month - 1, 1).toLocaleDateString("en-GB", {
    month: "short",
    year: "numeric",
  });
}

type Props = {
  searchParams: Promise<{
    studentId?: string;
    success?: string;
    error?: string;
  }>;
};

export default async function QuickCollectFeePage({ searchParams }: Props) {
  const session = await requireRole(["ORG_ADMIN"]);
  const organizationId = session.user.organizationId;
  if (!organizationId) throw new Error("Organization not linked to this admin");

  await ensureDefaultFeeHeads(organizationId);
  const filters = await searchParams;

  const [feeHeads, classes, sections, students, pendingCharges] = await Promise.all([
    prisma.feeHead.findMany({
      where: { organizationId, isActive: true, name: { not: "Monthly Tuition" } },
      orderBy: { name: "asc" },
      select: {
        name: true,
        defaultAmount: true,
        frequency: true,
      },
    }),
    prisma.class.findMany({
      where: { sections: { some: { organizationId } } },
      orderBy: [{ board: { name: "asc" } }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        board: { select: { name: true } },
      },
    }),
    prisma.section.findMany({
      where: { organizationId },
      orderBy: [{ class: { name: "asc" } }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        classId: true,
        class: { select: { name: true } },
      },
    }),
    prisma.student.findMany({
      where: { organizationId, isActive: true },
      orderBy: [
        { section: { class: { name: "asc" } } },
        { section: { name: "asc" } },
        { rollNumber: "asc" },
      ],
      select: {
        id: true,
        name: true,
        fatherName: true,
        rollNumber: true,
        phone: true,
        monthlyFee: true,
        sectionId: true,
        section: {
          select: {
            name: true,
            classId: true,
            class: {
              select: {
                name: true,
                board: { select: { name: true } },
              },
            },
          },
        },
      },
    }),
    prisma.feeCharge.findMany({
      where: {
        organizationId,
        status: { in: ["UNPAID", "PARTIAL"] },
        student: { isActive: true },
      },
      orderBy: [{ periodKey: "asc" }],
      select: {
        studentId: true,
        periodKey: true,
        amount: true,
        status: true,
        feeHead: { select: { name: true } },
        allocations: { select: { amount: true } },
      },
    }),
  ]);

  const duesByStudent = new Map<
    string,
    Array<{
      feeName: string;
      periodKey: string;
      periodLabel: string;
      status: "Unpaid" | "Partial";
      due: number;
    }>
  >();

  for (const charge of pendingCharges) {
    const paid = charge.allocations.reduce((sum, row) => sum + Number(row.amount), 0);
    const due = Math.max(Number(charge.amount) - paid, 0);
    const list = duesByStudent.get(charge.studentId) ?? [];
    list.push({
      feeName: charge.feeHead.name,
      periodKey: charge.periodKey,
      periodLabel: formatPeriodLabel(charge.periodKey),
      status: charge.status === "PARTIAL" ? "Partial" : "Unpaid",
      due,
    });
    duesByStudent.set(charge.studentId, list);
  }

  const today = new Date().toISOString().slice(0, 10);
  const currentPeriod = today.slice(0, 7);

  const studentRows = students.map((student) => ({
    id: student.id,
    name: student.name,
    fatherName: student.fatherName,
    rollNumber: student.rollNumber,
    phone: student.phone,
    monthlyFee: student.monthlyFee?.toFixed(2) ?? null,
    classId: student.section.classId,
    sectionId: student.sectionId,
    className: student.section.class.name,
    sectionName: student.section.name,
    boardName: student.section.class.board.name,
    pendingDues: duesByStudent.get(student.id) ?? [],
  }));

  const preselect = filters.studentId?.trim();

  return (
    <PageStack wide>
      <PageHeader
        kicker="Finance"
        title="Collect fee"
        description="Roll number enter karo — name / section autofill, dues right side pe."
        actions={
          <Link href="/org-admin/fees" className="text-sm font-semibold text-brand hover:underline">
            ← Fees hub
          </Link>
        }
      />
      <FlashMessage success={filters.success} error={filters.error} />
      <QuickCollectForm
        students={studentRows}
        classes={classes.map((klass) => ({
          id: klass.id,
          name: klass.name,
          boardName: klass.board.name,
        }))}
        sections={sections.map((section) => ({
          id: section.id,
          name: section.name,
          classId: section.classId,
          className: section.class.name,
        }))}
        feeHeads={feeHeads.map((head) => ({
          name: head.name,
          defaultAmount: head.defaultAmount?.toFixed(2) ?? null,
          frequency: head.frequency,
        }))}
        today={today}
        currentPeriod={currentPeriod}
        initialStudentId={
          preselect && studentRows.some((s) => s.id === preselect) ? preselect : ""
        }
      />
    </PageStack>
  );
}
