import { notFound } from "next/navigation";
import { PageHeader, PageStack } from "@/components/page-header";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";
import { FlashMessage } from "../../components";
import { FeeReceiptPrintView } from "./receipt-print-view";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ success?: string; error?: string }>;
};

export default async function FeeReceiptPage({ params, searchParams }: Props) {
  const session = await requireRole(["ORG_ADMIN"]);
  const organizationId = session.user.organizationId;
  if (!organizationId) throw new Error("Organization not linked to this admin");
  const { id } = await params;
  const messages = await searchParams;

  const payment = await prisma.feePayment.findFirst({
    where: { id, organizationId },
    select: {
      id: true,
      receiptNumber: true,
      amount: true,
      method: true,
      paidAt: true,
      note: true,
      student: {
        select: {
          id: true,
          name: true,
          rollNumber: true,
          fatherName: true,
          phone: true,
          section: {
            select: {
              id: true,
              name: true,
              classId: true,
              class: { select: { name: true, board: { select: { name: true } } } },
            },
          },
        },
      },
      organization: {
        select: { name: true, logoUrl: true, address: true, phone: true },
      },
      allocations: {
        select: {
          amount: true,
          charge: {
            select: {
              periodKey: true,
              description: true,
              amount: true,
              feeHead: { select: { name: true, category: true } },
            },
          },
        },
      },
    },
  });
  if (!payment) notFound();

  const receipt = {
    receiptNumber: payment.receiptNumber,
    amount: payment.amount.toFixed(2),
    method: payment.method,
    paidAt: payment.paidAt.toISOString(),
    note: payment.note,
    student: payment.student,
    organization: payment.organization,
    allocations: payment.allocations.map((row) => ({
      amount: row.amount.toFixed(2),
      charge: {
        periodKey: row.charge.periodKey,
        description: row.charge.description,
        amount: row.charge.amount.toFixed(2),
        feeHead: row.charge.feeHead,
      },
    })),
  };

  return (
    <PageStack wide>
      <div className="no-print space-y-4">
        <PageHeader
          kicker="Fees"
          title="Payment receipt"
          description="Print or save this receipt as PDF for the student record."
        />
        <FlashMessage success={messages.success} error={messages.error} />
      </div>
      <FeeReceiptPrintView payment={receipt} />
    </PageStack>
  );
}
