"use client";

import Link from "next/link";
import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatPkr } from "@/lib/fee-format";

export type AllPendingPrintRow = {
  rollNumber: string;
  name: string;
  fatherName: string;
  className: string;
  sectionName: string;
  feeName: string;
  periodLabel: string;
  status: "Unpaid" | "Partial";
  due: number;
};

type Org = {
  name: string;
  logoUrl?: string | null;
  address?: string | null;
  phone?: string | null;
};

export function AllPendingPrintView({
  organization,
  filterSummary,
  rows,
  totalDue,
  backHref,
}: {
  organization: Org;
  filterSummary: string;
  rows: AllPendingPrintRow[];
  totalDue: number;
  backHref: string;
}) {
  const orgName = organization.name.trim() || "Institute";
  const logoUrl = organization.logoUrl?.trim() || null;
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
            Back to unpaid list
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
          <h2 className="student-list-title">Unpaid / Partial Fee List</h2>
          <p className="student-list-ref">{filterSummary}</p>
        </div>

        <div className="student-list-meta">
          <div>
            <span>Pending rows</span>
            <strong>{rows.length}</strong>
          </div>
          <div>
            <span>Total outstanding</span>
            <strong>{formatPkr(totalDue)}</strong>
          </div>
          <div>
            <span>Printed on</span>
            <strong>{printedOn}</strong>
          </div>
        </div>

        <table className="mt-5 w-full border-collapse text-sm">
          <thead>
            <tr className="border-b-2 border-[rgba(15,40,70,0.2)] text-left text-[11px] uppercase tracking-wide text-muted">
              <th className="w-8 py-2.5 pr-2">#</th>
              <th className="w-16 py-2.5 pr-2">Roll</th>
              <th className="py-2.5 pr-2">Student</th>
              <th className="py-2.5 pr-2">Class / Sec</th>
              <th className="py-2.5 pr-2">Fee</th>
              <th className="py-2.5 pr-2">Period</th>
              <th className="w-20 py-2.5 pr-2">Status</th>
              <th className="w-28 py-2.5 text-right">Due</th>
              <th className="w-24 py-2.5 pl-3 text-right">Sign</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr
                key={`${row.rollNumber}-${row.feeName}-${row.periodLabel}-${index}`}
                className="border-b border-[rgba(15,40,70,0.08)]"
              >
                <td className="py-2 pr-2 text-muted">{index + 1}</td>
                <td className="py-2 pr-2 font-semibold text-ink">{row.rollNumber}</td>
                <td className="py-2 pr-2">
                  <p className="font-medium text-ink">{row.name}</p>
                  <p className="text-xs text-muted">{row.fatherName}</p>
                </td>
                <td className="py-2 pr-2 text-ink-soft">
                  {row.className} · {row.sectionName}
                </td>
                <td className="py-2 pr-2 text-ink">{row.feeName}</td>
                <td className="py-2 pr-2 text-ink-soft">{row.periodLabel}</td>
                <td className="py-2 pr-2 font-semibold text-ink">{row.status}</td>
                <td className="py-2 text-right tabular-nums font-semibold text-ink">
                  {formatPkr(row.due)}
                </td>
                <td className="py-2 pl-3 text-right text-muted">________</td>
              </tr>
            ))}
          </tbody>
        </table>

        {!rows.length ? (
          <p className="mt-8 text-center text-sm text-muted">No unpaid / partial dues for this filter.</p>
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
