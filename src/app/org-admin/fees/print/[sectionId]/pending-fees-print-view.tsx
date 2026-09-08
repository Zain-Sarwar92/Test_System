"use client";

import Link from "next/link";
import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatPkr } from "@/lib/fee-format";

export type PendingFeeRow = {
  rollNumber: string;
  name: string;
  fatherName: string;
  phone: string;
  status: "pending" | "partial";
  paidTotal: number;
};

type Org = {
  name: string;
  logoUrl?: string | null;
  address?: string | null;
  phone?: string | null;
};

function formatPeriodLabel(period: string) {
  const [year, month] = period.split("-").map(Number);
  if (!year || !month) return period;
  return new Date(year, month - 1, 1).toLocaleDateString("en-GB", {
    month: "long",
    year: "numeric",
  });
}

export function PendingFeesPrintView({
  organization,
  boardName,
  className,
  sectionName,
  period,
  feeName,
  students,
  backHref,
}: {
  organization: Org;
  boardName: string;
  className: string;
  sectionName: string;
  period: string;
  feeName?: string;
  students: PendingFeeRow[];
  backHref: string;
}) {
  const orgName = organization.name.trim() || "Institute";
  const logoUrl = organization.logoUrl?.trim() || null;
  const periodLabel = formatPeriodLabel(period);
  const printedOn = new Date().toLocaleDateString("en-PK", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  return (
    <div className="print-page student-list-print">
      <div className="print-toolbar no-print">
        <Link href={backHref}>
          <Button variant="outline" size="sm">
            Back to fees
          </Button>
        </Link>
        <Button size="sm" onClick={() => window.print()}>
          <Printer className="h-3.5 w-3.5" />
          Print / Save PDF
        </Button>
      </div>

      <article className="student-list-sheet gazette-sheet">
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
              {organization.address ? (
                <p className="exam-org-address">
                  HEAD OFFICE: {organization.address.toUpperCase()}
                </p>
              ) : null}
              {organization.phone ? (
                <p className="exam-org-phone">Ph: {organization.phone}</p>
              ) : null}
            </div>
            <div className="exam-brand-spacer" aria-hidden />
          </div>
        </header>

        <div className="student-list-title-block">
          <h2 className="student-list-title">
            Pending Fee List{feeName ? ` · ${feeName}` : ""}
          </h2>
          <p className="student-list-ref">{periodLabel}</p>
        </div>

        <div className="student-list-meta">
          <div>
            <span>Board</span>
            <strong>{boardName}</strong>
          </div>
          <div>
            <span>Class</span>
            <strong>{className}</strong>
          </div>
          <div>
            <span>Section</span>
            <strong>{sectionName}</strong>
          </div>
          {feeName ? (
            <div>
              <span>Fee type</span>
              <strong>{feeName}</strong>
            </div>
          ) : null}
          <div>
            <span>Pending students</span>
            <strong>{students.length}</strong>
          </div>
          <div>
            <span>Printed on</span>
            <strong>{printedOn}</strong>
          </div>
        </div>

        <table className="mt-5 w-full border-collapse text-sm">
          <thead>
            <tr className="border-b-2 border-[rgba(15,40,70,0.2)] text-left text-[11px] uppercase tracking-wide text-muted">
              <th className="py-2.5 pr-2 w-10">#</th>
              <th className="py-2.5 pr-2 w-20">Roll</th>
              <th className="py-2.5 pr-2">Student</th>
              <th className="py-2.5 pr-2">Father</th>
              <th className="py-2.5 pr-2 w-28">Phone</th>
              <th className="py-2.5 pr-2 w-24">Status</th>
              <th className="py-2.5 text-right w-28">Paid so far</th>
              <th className="py-2.5 pl-3 w-28 text-right">Sign</th>
            </tr>
          </thead>
          <tbody>
            {students.map((student, index) => (
              <tr
                key={`${student.rollNumber}-${index}`}
                className="border-b border-[rgba(15,40,70,0.08)]"
              >
                <td className="py-2.5 pr-2 text-muted">{index + 1}</td>
                <td className="py-2.5 pr-2 font-semibold text-ink">{student.rollNumber}</td>
                <td className="py-2.5 pr-2 font-medium text-ink">{student.name}</td>
                <td className="py-2.5 pr-2 text-ink-soft">{student.fatherName}</td>
                <td className="py-2.5 pr-2 text-ink-soft">{student.phone || "—"}</td>
                <td className="py-2.5 pr-2">
                  <span className="font-semibold text-ink">
                    {student.status === "partial" ? "Partial" : "Pending"}
                  </span>
                </td>
                <td className="py-2.5 text-right tabular-nums text-ink">
                  {student.paidTotal > 0 ? formatPkr(student.paidTotal) : "—"}
                </td>
                <td className="py-2.5 pl-3 text-right text-muted">________</td>
              </tr>
            ))}
          </tbody>
        </table>

        {!students.length ? (
          <p className="mt-8 text-center text-sm text-muted">
            No pending students for {periodLabel}.
          </p>
        ) : null}

        <div className="mt-10 grid gap-8 sm:grid-cols-2">
          <div className="border-t border-[rgba(15,40,70,0.2)] pt-2 text-xs text-muted">
            Prepared by
          </div>
          <div className="border-t border-[rgba(15,40,70,0.2)] pt-2 text-xs text-muted sm:text-right">
            Office stamp / signature
          </div>
        </div>

        <p className="print-screen-hint no-print mt-6">
          Preview check karo, phir Print / Save PDF.
        </p>
      </article>
    </div>
  );
}
