"use client";

import Link from "next/link";
import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { MultiRoundColumn, MultiRoundStudentRow } from "@/lib/results";

type Org = {
  name: string;
  logoUrl?: string | null;
  address?: string | null;
  phone?: string | null;
};

export function CombinedGazetteView({
  organization,
  boardName,
  className,
  sectionName,
  session,
  passPercent,
  examDate,
  roundLabels,
  columns,
  rows,
  backHref,
}: {
  organization: Org;
  boardName: string;
  className: string;
  sectionName: string;
  session: string;
  passPercent: number;
  examDate: string | null;
  roundLabels: string[];
  columns: MultiRoundColumn[];
  rows: MultiRoundStudentRow[];
  backHref: string;
}) {
  const orgName = organization.name.trim() || "Institute";
  const logoUrl = organization.logoUrl?.trim() || null;
  const complete = rows.filter((row) => row.complete).length;
  const passed = rows.filter((row) => row.passed).length;

  return (
    <div className="print-page student-list-print">
      <div className="print-toolbar no-print">
        <Link href={backHref}>
          <Button variant="outline" size="sm">Back to results</Button>
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
          <h2 className="student-list-title">Combined Result Gazette</h2>
          <p className="student-list-ref">
            {roundLabels.join(" + ")} · {session}
          </p>
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
          <div>
            <span>Results</span>
            <strong>{roundLabels.length} combined</strong>
          </div>
          <div>
            <span>Session</span>
            <strong>{session}</strong>
          </div>
          <div>
            <span>Date</span>
            <strong>{examDate ?? "____________"}</strong>
          </div>
          <div>
            <span>Pass %</span>
            <strong>{passPercent}%</strong>
          </div>
          <div>
            <span>Result</span>
            <strong>
              {passed}/{complete} passed
            </strong>
          </div>
        </div>

        {columns.length === 0 ? (
          <p className="student-list-empty">No subject marks entered yet.</p>
        ) : (
          <table className="gazette-table">
            <thead>
              <tr>
                <th rowSpan={2}>Roll</th>
                <th rowSpan={2}>Student</th>
                <th rowSpan={2}>Group</th>
                <th rowSpan={2}>Father</th>
                {columns.map((column) => (
                  <th key={column.key} colSpan={column.rounds.length + 1}>
                    {column.label}
                    <span> / {column.totalMarks}</span>
                  </th>
                ))}
                <th rowSpan={2}>Total</th>
                <th rowSpan={2}>%</th>
                <th rowSpan={2}>Pos</th>
                <th rowSpan={2}>Grade</th>
                <th rowSpan={2}>Status</th>
              </tr>
              <tr>
                {columns.flatMap((column) => [
                  ...column.rounds.map((round) => (
                    <th key={`${column.key}:${round.id}`}>
                      {round.label}
                      <span>/ {round.totalMarks}</span>
                    </th>
                  )),
                  <th key={`${column.key}:total`}>Total</th>,
                ])}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td>{row.rollNumber}</td>
                  <td className="name">{row.name}</td>
                  <td>{row.stream === "SCIENCE" ? "Sci" : "Arts"}</td>
                  <td className="name">{row.fatherName}</td>
                  {row.breakdown.flatMap((cell) => [
                    ...cell.roundValues.map((value) => (
                      <td key={`${row.id}:${cell.key}:${value.roundId}`}>
                        {value.display}
                      </td>
                    )),
                    <td key={`${row.id}:${cell.key}:total`}>
                      <strong>{cell.totalDisplay}</strong>
                    </td>,
                  ])}
                  <td>
                    {row.complete ? `${row.obtainedTotal}/${row.maxTotal}` : "—"}
                  </td>
                  <td>{row.percent == null ? "—" : row.percent}</td>
                  <td>{row.position ?? "—"}</td>
                  <td>{row.grade}</td>
                  <td>{row.complete ? (row.passed ? "Pass" : "Fail") : "Pending"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <footer className="student-list-sign">
          <div>
            <span />
            <p>Class Teacher</p>
          </div>
          <div>
            <span />
            <p>Checked By</p>
          </div>
          <div>
            <span />
            <p>Principal</p>
          </div>
        </footer>
      </article>
    </div>
  );
}
