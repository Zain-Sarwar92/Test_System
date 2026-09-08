"use client";

import { feeCategoryLabel } from "@/lib/fee-categories";
import { formatPkr } from "@/lib/fee-format";
import type { FeeCategory } from "@/generated/prisma/client";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Printer } from "lucide-react";

type ReceiptPayment = {
  receiptNumber: string;
  amount: string;
  method: string;
  paidAt: string;
  note: string | null;
  student: {
    id: string;
    name: string;
    rollNumber: string;
    fatherName: string;
    phone: string | null;
    section: {
      id: string;
      classId: string;
      name: string;
      class: { name: string; board: { name: string } };
    };
  };
  organization: {
    name: string;
    logoUrl: string | null;
    address: string | null;
    phone: string | null;
  };
  allocations: Array<{
    amount: string;
    charge: {
      periodKey: string;
      description: string | null;
      amount: string;
      feeHead: { name: string; category: FeeCategory };
    };
  }>;
};

export function FeeReceiptPrintView({ payment }: { payment: ReceiptPayment }) {
  const orgName = payment.organization.name.trim() || "Institute";
  const logoUrl = payment.organization.logoUrl?.trim() || null;
  const methodLabel = payment.method.replaceAll("_", " ");

  return (
    <div className="print-page student-list-print">
      <div className="print-toolbar no-print">
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/org-admin/fees?classId=${payment.student.section.classId}&sectionId=${payment.student.section.id}&studentId=${payment.student.id}`}
          >
            <Button variant="outline" size="sm">
              Collect another
            </Button>
          </Link>
          <Link href="/org-admin/fees">
            <Button variant="outline" size="sm">
              All classes
            </Button>
          </Link>
          <Link href={`/org-admin/students/${payment.student.id}`}>
            <Button variant="outline" size="sm">
              Student profile
            </Button>
          </Link>
        </div>
        <Button size="sm" onClick={() => window.print()}>
          <Printer className="h-3.5 w-3.5" />
          Print / Save PDF
        </Button>
      </div>

      <article className="student-list-sheet gazette-sheet mx-auto max-w-3xl">
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logoUrl} alt="" className="exam-watermark" aria-hidden />
        ) : null}
        <header className="exam-brand-header">
          <div className="exam-brand-row">
            <div className="exam-brand-logo">
              {logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logoUrl} alt="" className="exam-logo-img" />
              ) : (
                <div className="exam-logo-fallback" aria-hidden>
                  {(orgName.slice(0, 2) || "IN").toUpperCase()}
                </div>
              )}
            </div>
            <div className="exam-brand-center">
              <h1 className="exam-org-name">{orgName}</h1>
              {payment.organization.address ? (
                <p className="exam-org-address">
                  HEAD OFFICE: {payment.organization.address.toUpperCase()}
                </p>
              ) : null}
              {payment.organization.phone ? (
                <p className="exam-org-phone">Ph: {payment.organization.phone}</p>
              ) : null}
            </div>
            <div className="exam-brand-spacer" aria-hidden />
          </div>
        </header>

        <div className="student-list-title-block">
          <h2 className="student-list-title">Fee Receipt</h2>
          <p className="student-list-ref">{payment.receiptNumber}</p>
        </div>

        <div className="student-list-meta">
          <div>
            <span>Student</span>
            <strong>{payment.student.name}</strong>
          </div>
          <div>
            <span>Roll</span>
            <strong>{payment.student.rollNumber}</strong>
          </div>
          <div>
            <span>Class / section</span>
            <strong>
              {payment.student.section.class.name} / {payment.student.section.name}
            </strong>
          </div>
          <div>
            <span>Father</span>
            <strong>{payment.student.fatherName}</strong>
          </div>
          <div>
            <span>Paid on</span>
            <strong>
              {new Date(payment.paidAt).toLocaleDateString("en-PK", {
                day: "2-digit",
                month: "short",
                year: "numeric",
              })}
            </strong>
          </div>
          <div>
            <span>Method</span>
            <strong className="capitalize">{methodLabel.toLowerCase()}</strong>
          </div>
        </div>

        <table className="mt-6 w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-[rgba(15,40,70,0.15)] text-left text-xs uppercase tracking-wide text-muted">
              <th className="py-2 pr-3">Fee head</th>
              <th className="py-2 pr-3">Period</th>
              <th className="py-2 text-right">Allocated</th>
            </tr>
          </thead>
          <tbody>
            {payment.allocations.map((row, index) => (
              <tr
                key={`${row.charge.feeHead.name}-${row.charge.periodKey}-${index}`}
                className="border-b border-[rgba(15,40,70,0.08)]"
              >
                <td className="py-3 pr-3 font-medium text-ink">
                  {row.charge.feeHead.name}
                  <span className="mt-0.5 block text-xs font-normal text-muted">
                    {feeCategoryLabel(row.charge.feeHead.category)}
                    {row.charge.description ? ` · ${row.charge.description}` : ""}
                  </span>
                </td>
                <td className="py-3 pr-3 text-ink-soft">{row.charge.periodKey}</td>
                <td className="py-3 text-right font-semibold text-ink">
                  {formatPkr(row.amount)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={2} className="pt-4 text-right font-semibold text-ink">
                Total paid
              </td>
              <td className="pt-4 text-right text-lg font-bold text-ink">
                {formatPkr(payment.amount)}
              </td>
            </tr>
          </tfoot>
        </table>

        {payment.note ? (
          <p className="mt-6 text-sm text-muted">
            <span className="font-semibold text-ink">Note:</span> {payment.note}
          </p>
        ) : null}

        <div className="mt-10 grid gap-8 sm:grid-cols-2">
          <div className="border-t border-[rgba(15,40,70,0.2)] pt-2 text-xs text-muted">
            Received by
          </div>
          <div className="border-t border-[rgba(15,40,70,0.2)] pt-2 text-xs text-muted sm:text-right">
            Parent / guardian signature
          </div>
        </div>

        <p className="print-screen-hint no-print mt-6">
          Review the preview, then Print / Save PDF for the student record.
        </p>
      </article>
    </div>
  );
}
