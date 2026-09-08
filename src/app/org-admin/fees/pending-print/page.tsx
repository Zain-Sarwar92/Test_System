import { redirect } from "next/navigation";
import { PageHeader, PageStack } from "@/components/page-header";
import { ensureDefaultFeeHeads } from "@/lib/ensure-fee-heads";
import { feeHeadDueInPeriod } from "@/lib/fee-head-rules";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";
import { PendingFeesPrintView } from "../print/[sectionId]/pending-fees-print-view";

type Props = {
  searchParams: Promise<{
    sectionId?: string;
    period?: string;
    feeName?: string;
  }>;
};

export default async function PendingFeesPrintPage({ searchParams }: Props) {
  const session = await requireRole(["ORG_ADMIN"]);
  const organizationId = session.user.organizationId;
  if (!organizationId) {
    redirect("/select-org");
  }

  await ensureDefaultFeeHeads(organizationId);

  const filters = await searchParams;
  const sectionId = filters.sectionId?.trim() ?? "";
  if (!sectionId) {
    redirect(`/org-admin/fees?error=${encodeURIComponent("Section missing for print.")}`);
  }

  const currentPeriod = new Date().toISOString().slice(0, 7);
  const period =
    filters.period && /^\d{4}-(0[1-9]|1[0-2])$/.test(filters.period)
      ? filters.period
      : currentPeriod;
  const feeName = decodeURIComponent((filters.feeName ?? "Monthly Fee").replace(/\+/g, " ").trim());

  const section = await prisma.section.findFirst({
    where: { id: sectionId, organizationId },
    select: {
      id: true,
      name: true,
      classId: true,
      class: {
        select: {
          name: true,
          board: { select: { name: true } },
        },
      },
      organization: {
        select: { name: true, logoUrl: true, address: true, phone: true },
      },
    },
  });
  if (!section) {
    redirect(`/org-admin/fees?error=${encodeURIComponent("Section not found for print.")}`);
  }

  const feeHead = await prisma.feeHead.findFirst({
    where: { organizationId, name: feeName },
    select: {
      id: true,
      name: true,
      frequency: true,
      applicableMonths: true,
    },
  });
  if (!feeHead) {
    redirect(
      `/org-admin/fees?classId=${section.classId}&sectionId=${section.id}&error=${encodeURIComponent(`Fee type "${feeName}" not found.`)}`,
    );
  }

  const feeDue = feeHeadDueInPeriod(feeHead, period);

  const students = await prisma.student.findMany({
    where: { organizationId, sectionId: section.id, isActive: true },
    orderBy: [{ rollNumber: "asc" }, { name: "asc" }],
    select: {
      id: true,
      rollNumber: true,
      name: true,
      fatherName: true,
      phone: true,
      createdAt: true,
      feeCharges: {
        where: {
          organizationId,
          feeHeadId: feeHead.id,
          ...(feeHead.frequency === "ONE_TIME" ? {} : { periodKey: period }),
        },
        select: {
          status: true,
          amount: true,
          allocations: { select: { amount: true } },
        },
      },
    },
  });

  const pendingStudents = feeDue
    ? students
        .filter((student) => {
          if (feeHead.frequency === "ONE_TIME") return true;
          const enrolledFrom = student.createdAt.toISOString().slice(0, 7);
          return enrolledFrom <= period;
        })
        .map((student) => {
          const charge = student.feeCharges[0];
          const paidTotal = charge
            ? charge.allocations.reduce((sum, row) => sum + Number(row.amount), 0)
            : 0;

          const status: "pending" | "partial" | "paid" =
            charge?.status === "PAID"
              ? "paid"
              : charge?.status === "PARTIAL" || paidTotal > 0
                ? "partial"
                : "pending";

          return {
            rollNumber: student.rollNumber,
            name: student.name,
            fatherName: student.fatherName,
            phone: student.phone,
            status,
            paidTotal,
          };
        })
        .filter(
          (row): row is typeof row & { status: "pending" | "partial" } =>
            row.status === "pending" || row.status === "partial",
        )
    : [];

  const backHref = `/org-admin/fees?classId=${section.classId}&sectionId=${section.id}&feeName=${encodeURIComponent(feeName)}&period=${period}&view=all`;

  return (
    <PageStack wide>
      <div className="no-print">
        <PageHeader
          kicker="Fees"
          title="Print pending fees"
          description={`${section.class.name} · ${section.name} · ${feeName} · ${period}`}
        />
      </div>
      <PendingFeesPrintView
        organization={section.organization}
        boardName={section.class.board.name}
        className={section.class.name}
        sectionName={section.name}
        period={period}
        feeName={feeName}
        students={pendingStudents}
        backHref={backHref}
      />
    </PageStack>
  );
}
