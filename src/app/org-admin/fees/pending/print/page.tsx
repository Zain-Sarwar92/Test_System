import { redirect } from "next/navigation";
import { ensureDefaultFeeHeads } from "@/lib/ensure-fee-heads";
import { ONE_TIME_PERIOD_KEY } from "@/lib/fee-head-rules";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";
import { AllPendingPrintView } from "../all-pending-print-view";

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
    feeName?: string;
    classId?: string;
    sectionId?: string;
    q?: string;
  }>;
};

export default async function AllPendingPrintPage({ searchParams }: Props) {
  const session = await requireRole(["ORG_ADMIN"]);
  const organizationId = session.user.organizationId;
  if (!organizationId) redirect("/select-org");

  await ensureDefaultFeeHeads(organizationId);
  const filters = await searchParams;
  const feeName = (filters.feeName ?? "").trim();
  const classId = (filters.classId ?? "").trim();
  const sectionId = (filters.sectionId ?? "").trim();
  const q = (filters.q ?? "").trim();

  const [org, classRow, sectionRow, charges] = await Promise.all([
    prisma.organization.findFirst({
      where: { id: organizationId },
      select: { name: true, logoUrl: true, address: true, phone: true },
    }),
    classId
      ? prisma.class.findFirst({
          where: { id: classId, sections: { some: { organizationId } } },
          select: { name: true },
        })
      : Promise.resolve(null),
    sectionId
      ? prisma.section.findFirst({
          where: { id: sectionId, organizationId },
          select: { name: true, class: { select: { name: true } } },
        })
      : Promise.resolve(null),
    prisma.feeCharge.findMany({
      where: {
        organizationId,
        status: { in: ["UNPAID", "PARTIAL"] },
        student: {
          isActive: true,
          ...(q
            ? {
                OR: [
                  { name: { contains: q, mode: "insensitive" } },
                  { rollNumber: { contains: q, mode: "insensitive" } },
                  { fatherName: { contains: q, mode: "insensitive" } },
                ],
              }
            : {}),
          ...(sectionId
            ? { sectionId }
            : classId
              ? { section: { classId } }
              : {}),
        },
        ...(feeName ? { feeHead: { name: feeName } } : {}),
      },
      orderBy: [
        { student: { section: { class: { name: "asc" } } } },
        { student: { section: { name: "asc" } } },
        { student: { rollNumber: "asc" } },
        { periodKey: "asc" },
      ],
      select: {
        periodKey: true,
        amount: true,
        status: true,
        feeHead: { select: { name: true } },
        allocations: { select: { amount: true } },
        student: {
          select: {
            name: true,
            rollNumber: true,
            fatherName: true,
            section: {
              select: {
                name: true,
                class: { select: { name: true } },
              },
            },
          },
        },
      },
      take: 1000,
    }),
  ]);

  if (!org) redirect("/org-admin/fees/pending");

  const rows = charges.map((charge) => {
    const paid = charge.allocations.reduce((sum, row) => sum + Number(row.amount), 0);
    const due = Math.max(Number(charge.amount) - paid, 0);
    return {
      rollNumber: charge.student.rollNumber,
      name: charge.student.name,
      fatherName: charge.student.fatherName,
      className: charge.student.section.class.name,
      sectionName: charge.student.section.name,
      feeName: charge.feeHead.name,
      periodLabel: formatPeriodLabel(charge.periodKey),
      status: (charge.status === "PARTIAL" ? "Partial" : "Unpaid") as "Partial" | "Unpaid",
      due,
    };
  });

  const totalDue = rows.reduce((sum, row) => sum + row.due, 0);

  const filterParts = [
    feeName || "All fee types",
    sectionRow
      ? `${sectionRow.class.name} · ${sectionRow.name}`
      : classRow
        ? classRow.name
        : "All classes",
    q ? `Search: ${q}` : null,
  ].filter(Boolean);

  const backParams = new URLSearchParams();
  if (feeName) backParams.set("feeName", feeName);
  if (classId) backParams.set("classId", classId);
  if (sectionId) backParams.set("sectionId", sectionId);
  if (q) backParams.set("q", q);
  const backQs = backParams.toString();

  return (
    <AllPendingPrintView
      organization={org}
      filterSummary={filterParts.join(" · ")}
      rows={rows}
      totalDue={totalDue}
      backHref={backQs ? `/org-admin/fees/pending?${backQs}` : "/org-admin/fees/pending"}
    />
  );
}
