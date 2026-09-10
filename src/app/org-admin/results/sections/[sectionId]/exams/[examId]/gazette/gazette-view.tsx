"use client";

import { useMemo } from "react";
import Link from "next/link";
import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { CompiledStudent, GazetteColumn } from "@/lib/results";
import { formatResultMarks, formatResultPercent } from "@/lib/results";
import { formatStudyGroupShort } from "@/lib/subject-stream";
import { ResultsBackLink } from "@/app/org-admin/results/results-back-link";
import {
  ResultSheetChrome,
  ResultSheetSignatures,
} from "@/app/org-admin/results/result-sheet-chrome";
import {
  WhatsAppResultPanel,
  type WhatsAppShareStudent,
} from "@/app/org-admin/results/whatsapp-result-panel";

type Org = {
  name: string;
  logoUrl?: string | null;
  address?: string | null;
  phone?: string | null;
};

export function GazetteView({
  organization,
  className,
  sectionName,
  examName,
  session,
  columns,
  rows,
  backHref,
  subtitle,
  phoneByStudentId = {},
  combined = false,
  reportCardBaseHref,
}: {
  organization: Org;
  boardName?: string;
  className: string;
  sectionName: string;
  examName: string;
  session: string;
  columns: GazetteColumn[];
  rows: CompiledStudent[];
  backHref: string;
  subtitle?: string | null;
  phoneByStudentId?: Record<string, string | null | undefined>;
  combined?: boolean;
  reportCardBaseHref?: string;
}) {
  const orgName = organization.name.trim() || "Institute";
  const complete = rows.filter((row) => row.complete).length;
  const passed = rows.filter((row) => row.passed).length;
  const sheetTitle = combined ? "Combined Result" : "Result Sheet";
  const sheetSubtitle = subtitle
    ? `${examName} · ${subtitle}`
    : examName;

  const shareStudents = useMemo<WhatsAppShareStudent[]>(
    () =>
      rows.map((row) => ({
        id: row.id,
        rollNumber: row.rollNumber,
        name: row.name,
        fatherName: row.fatherName,
        phone: phoneByStudentId[row.id] ?? null,
        lines: row.cells
          .filter((cell) => cell.applicable)
          .map((cell, index) => ({
            label: columns[index]?.label ?? cell.name,
            value: cell.display,
          })),
        total: row.complete
          ? `${formatResultMarks(row.obtainedTotal)}/${formatResultMarks(row.maxTotal)}`
          : null,
        percent: row.percent,
        grade: row.grade,
        position: row.position,
      })),
    [rows, columns, phoneByStudentId],
  );

  return (
    <div
      className={`print-page student-list-print result-sheet-page${combined ? " gazette-print-page" : ""}`}
    >
      <div className="print-toolbar no-print">
        <ResultsBackLink href={backHref} />
        <Button size="sm" onClick={() => window.print()}>
          <Printer className="h-3.5 w-3.5" />
          Print / Save PDF
        </Button>
      </div>

      <WhatsAppResultPanel
        orgName={orgName}
        title={`Result: ${examName}${subtitle ? ` · ${subtitle}` : ""}`}
        className={className}
        sectionName={sectionName}
        session={session}
        students={shareStudents}
      />

      <article
        className={`student-list-sheet gazette-sheet result-sheet${combined ? " gazette-sheet--screen" : ""}`}
      >
        <ResultSheetChrome
          organization={organization}
          title={sheetTitle}
          subtitle={sheetSubtitle}
          meta={[
            { label: "Class", value: className },
            {
              label: combined ? "Sections" : "Section",
              value: sectionName,
            },
            { label: "Exam", value: examName },
            { label: "Session", value: session },
            {
              label: "Passed",
              value: `${passed}/${complete}`,
            },
          ]}
        />

        {columns.length === 0 ? (
          <p className="student-list-empty">No subject marks entered yet.</p>
        ) : (
          <div className={combined ? "gazette-table-scroll" : undefined}>
            <table
              className={`gazette-table result-sheet-table${combined ? " gazette-table--wide" : ""}`}
            >
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
                    <tr
                      key={row.id}
                      className={
                        row.complete && !row.passed
                          ? "result-sheet-row--fail"
                          : undefined
                      }
                    >
                      <td>{row.rollNumber}</td>
                      <td className="name">
                        {reportCardBaseHref &&
                        !row.id.startsWith("manual:") ? (
                          <>
                            <Link
                              href={`${reportCardBaseHref}/${row.id}`}
                              className="no-print result-sheet-name-link"
                            >
                              {row.name}
                            </Link>
                            <span className="hidden print:inline">
                              {row.name}
                            </span>
                          </>
                        ) : (
                          row.name
                        )}
                      </td>
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
                      <td className="result-sheet-total">
                        {row.maxTotal > 0
                          ? `${formatResultMarks(row.obtainedTotal)}/${formatResultMarks(row.maxTotal)}`
                          : "—"}
                      </td>
                      <td>
                        {row.percent == null
                          ? "—"
                          : formatResultPercent(row.percent)}
                      </td>
                      <td>{row.position ?? "—"}</td>
                      <td>
                        <span
                          className={
                            row.complete && !row.passed
                              ? "result-sheet-grade result-sheet-grade--fail"
                              : "result-sheet-grade"
                          }
                        >
                          {row.grade}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <ResultSheetSignatures />
      </article>
    </div>
  );
}
