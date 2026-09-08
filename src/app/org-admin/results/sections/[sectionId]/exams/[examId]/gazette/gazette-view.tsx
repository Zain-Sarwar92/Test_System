"use client";

import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { CompiledStudent, GazetteColumn } from "@/lib/results";
import { formatStudyGroupShort } from "@/lib/subject-stream";
import { ResultsBackLink } from "@/app/org-admin/results/results-back-link";

type Org = {
  name: string;
  logoUrl?: string | null;
  address?: string | null;
  phone?: string | null;
};

export function GazetteView({
  organization,
  boardName,
  className,
  sectionName,
  examName,
  session,
  columns,
  rows,
  backHref,
  subtitle,
  combined = false,
}: {
  organization: Org;
  boardName: string;
  className: string;
  sectionName: string;
  examName: string;
  session: string;
  columns: GazetteColumn[];
  rows: CompiledStudent[];
  backHref: string;
  subtitle?: string | null;
  /** Multi-section combine sheet */
  combined?: boolean;
}) {
  const orgName = organization.name.trim() || "Institute";
  const logoUrl = organization.logoUrl?.trim() || null;
  const complete = rows.filter((row) => row.complete).length;
  const passed = rows.filter((row) => row.passed).length;
  const bioCount = rows.filter((row) => row.studyGroup === "BIOLOGY").length;
  const compCount = rows.filter((row) => row.studyGroup === "COMPUTER").length;
  const showGroupStats = bioCount > 0 || compCount > 0;

  return (
    <div className={`print-page student-list-print${combined ? " gazette-print-page" : ""}`}>
      <div className="print-toolbar no-print">
        <ResultsBackLink href={backHref} />
        <Button size="sm" onClick={() => window.print()}>
          <Printer className="h-3.5 w-3.5" />
          Print / Save PDF
        </Button>
      </div>

      <article
        className={`student-list-sheet gazette-sheet${combined ? " gazette-sheet--screen" : ""}`}
      >
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
            {combined ? "Combined Result Gazette" : "Result Gazette"}
          </h2>
          <p className="student-list-ref">
            {examName} · {session}
            {subtitle ? ` · ${subtitle}` : ""}
          </p>
          {showGroupStats ? (
            <p className="gazette-group-legend no-print">
              Group column shows <strong>Bio</strong> / <strong>Comp</strong>. Marks
              in Bio/Comp also start with the subject tag (e.g. Bio 24).
            </p>
          ) : null}
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
            <span>{combined ? "Sections" : "Section"}</span>
            <strong>{sectionName}</strong>
          </div>
          <div>
            <span>Exam</span>
            <strong>{examName}</strong>
          </div>
          <div>
            <span>Session</span>
            <strong>{session}</strong>
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
          <div className={combined ? "gazette-table-scroll" : undefined}>
            <table className={`gazette-table${combined ? " gazette-table--wide" : ""}`}>
              <thead>
                <tr>
                  <th>Roll</th>
                  <th>Student</th>
                  <th>Father</th>
                  <th>Group</th>
                  {columns.map((column) => (
                    <th key={column.key}>
                      {column.label}
                      <span> / {column.totalMarks}</span>
                    </th>
                  ))}
                  <th>Total</th>
                  <th>%</th>
                  <th>Pos</th>
                  <th>Grade</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const group = formatStudyGroupShort(row.studyGroup);
                  return (
                    <tr key={row.id}>
                      <td>{row.rollNumber}</td>
                      <td className="name">{row.name}</td>
                      <td className="name">{row.fatherName}</td>
                      <td>
                        <span
                          className={
                            row.studyGroup === "BIOLOGY"
                              ? "gazette-group-tag gazette-group-tag--bio"
                              : row.studyGroup === "COMPUTER"
                                ? "gazette-group-tag gazette-group-tag--comp"
                                : "gazette-group-tag"
                          }
                        >
                          {group}
                        </span>
                      </td>
                      {row.cells.map((cell) => (
                        <td key={`${row.id}:${cell.id}`}>{cell.display}</td>
                      ))}
                      <td>
                        {row.maxTotal > 0
                          ? `${row.obtainedTotal}/${row.maxTotal}`
                          : "—"}
                      </td>
                      <td>{row.percent == null ? "—" : row.percent}</td>
                      <td>{row.position ?? "—"}</td>
                      <td>{row.grade}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
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
