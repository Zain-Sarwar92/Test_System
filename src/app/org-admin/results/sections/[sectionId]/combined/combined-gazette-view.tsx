"use client";

import { useMemo } from "react";
import Link from "next/link";
import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { MultiRoundColumn, MultiRoundStudentRow } from "@/lib/results";
import {
  formatResultMarks,
  formatResultPercent,
} from "@/lib/results";
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

/** Subjects that fit on one landscape A4 page with N rounds each. */
function subjectsPerPrintPage(roundCount: number) {
  if (roundCount >= 5) return 3;
  if (roundCount >= 4) return 3;
  if (roundCount >= 3) return 4;
  if (roundCount >= 2) return 5;
  return 6;
}

function chunkColumns(columns: MultiRoundColumn[], size: number) {
  if (columns.length === 0) return [] as MultiRoundColumn[][];
  const chunks: MultiRoundColumn[][] = [];
  for (let i = 0; i < columns.length; i += size) {
    chunks.push(columns.slice(i, i + size));
  }
  return chunks;
}

function tableRoundLabel(label: string, _index: number) {
  const cleaned = label.trim();
  return cleaned || "—";
}

function studentReportCardHref(reportCardBaseHref: string, studentId: string) {
  return reportCardBaseHref.replace(
    "/report-cards?",
    `/report-cards/${studentId}?`,
  );
}

function GazetteTable({
  columns,
  rows,
  showTotals,
  reportCardBaseHref,
}: {
  columns: MultiRoundColumn[];
  rows: MultiRoundStudentRow[];
  showTotals: boolean;
  reportCardBaseHref?: string;
}) {
  const keys = new Set(columns.map((column) => column.key));

  return (
    <table className="gazette-table gazette-table--multi result-sheet-table">
      <thead>
        <tr>
          <th rowSpan={2} className="col-roll">
            Roll
          </th>
          <th rowSpan={2} className="col-name">
            Student
          </th>
          <th rowSpan={2} className="col-father">
            Father
          </th>
          {columns.map((column) => (
            <th
              key={column.key}
              colSpan={Math.max(column.rounds.length, 1)}
              className="col-subject"
            >
              {column.label}
              <span>/ {column.totalMarks}</span>
            </th>
          ))}
          {showTotals ? (
            <>
              <th rowSpan={2} className="col-total">
                Total
              </th>
              <th rowSpan={2} className="col-pct">
                %
              </th>
              <th rowSpan={2} className="col-pos">
                Pos
              </th>
              <th rowSpan={2} className="col-grade">
                Grade
              </th>
            </>
          ) : null}
        </tr>
        <tr>
          {columns.flatMap((column) =>
            column.rounds.map((round, roundIndex) => (
              <th key={`${column.key}:${round.id}`} className="col-mark">
                {tableRoundLabel(round.label, roundIndex)}
                <span>/ {round.totalMarks}</span>
              </th>
            )),
          )}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr
            key={row.id}
            className={
              row.complete && !row.passed
                ? "gazette-student-row result-sheet-row--fail"
                : "gazette-student-row"
            }
          >
            <td className="col-roll">{row.rollNumber}</td>
            <td className="name col-name">
              {reportCardBaseHref ? (
                <>
                  <Link
                    href={studentReportCardHref(reportCardBaseHref, row.id)}
                    className="no-print result-sheet-name-link"
                  >
                    {row.name}
                  </Link>
                  <span className="hidden print:inline">{row.name}</span>
                </>
              ) : (
                row.name
              )}
            </td>
            <td className="name col-father">{row.fatherName}</td>
            {row.breakdown
              .filter((cell) => keys.has(cell.key))
              .flatMap((cell) =>
                cell.roundValues.map((value) => (
                  <td
                    key={`${row.id}:${cell.key}:${value.roundId}`}
                    className="col-mark"
                  >
                    {value.display}
                  </td>
                )),
              )}
            {showTotals ? (
              <>
                <td className="col-total result-sheet-total">
                  {row.maxTotal > 0
                    ? `${formatResultMarks(row.obtainedTotal)}/${formatResultMarks(row.maxTotal)}`
                    : "—"}
                </td>
                <td className="col-pct">
                  {row.percent == null
                    ? "—"
                    : formatResultPercent(row.percent)}
                </td>
                <td className="col-pos">{row.position ?? "—"}</td>
                <td className="col-grade">
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
              </>
            ) : null}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function SheetChrome({
  organization,
  className,
  sectionName,
  session,
  roundLabels,
  rows,
  sheetLabel,
  compactHeader,
}: {
  organization: Org;
  className: string;
  sectionName: string;
  session: string;
  roundLabels: string[];
  rows: MultiRoundStudentRow[];
  sheetLabel?: string | null;
  compactHeader?: boolean;
}) {
  const complete = rows.filter((row) => row.complete).length;
  const passed = rows.filter((row) => row.passed).length;
  const subtitle = sheetLabel
    ? `Session ${session} · ${sheetLabel}`
    : `Session ${session}`;

  return (
    <ResultSheetChrome
      organization={organization}
      title={roundLabels.join(" + ")}
      subtitle={subtitle}
      kicker="Combined academic report"
      compact={compactHeader}
      continuedLabel={sheetLabel ? `${sheetLabel} · continued` : "Continued"}
      meta={[
        { label: "Class", value: className },
        { label: "Section", value: sectionName },
        { label: "Result", value: roundLabels.join(" · ") },
        { label: "Session", value: session },
        { label: "Passed", value: `${passed}/${complete}` },
      ]}
    />
  );
}

export function CombinedGazetteView({
  organization,
  boardName: _boardName,
  className,
  sectionName,
  session,
  roundLabels,
  columns,
  rows,
  backHref,
  phoneByStudentId = {},
  reportCardBaseHref,
}: {
  organization: Org;
  boardName: string;
  className: string;
  sectionName: string;
  session: string;
  roundLabels: string[];
  columns: MultiRoundColumn[];
  rows: MultiRoundStudentRow[];
  backHref: string;
  phoneByStudentId?: Record<string, string | null | undefined>;
  reportCardBaseHref?: string;
}) {
  const roundCount = Math.max(
    1,
    roundLabels.length,
    ...columns.map((column) => column.rounds.length),
  );
  const pageSize = subjectsPerPrintPage(roundCount);
  const subjectChunks = useMemo(
    () => chunkColumns(columns, pageSize),
    [columns, pageSize],
  );

  const shareStudents = useMemo<WhatsAppShareStudent[]>(
    () =>
      rows.map((row) => ({
        id: row.id,
        rollNumber: row.rollNumber,
        name: row.name,
        fatherName: row.fatherName,
        phone: phoneByStudentId[row.id] ?? null,
        lines: row.breakdown.map((cell, index) => {
          const column = columns[index];
          const rounds = cell.roundValues
            .map((value, roundIndex) => {
              const label =
                column?.rounds[roundIndex]?.label.match(/(\d+)/)?.[1] ??
                String(roundIndex + 1);
              return `R${label}:${value.display}`;
            })
            .join(" ");
          return {
            label: column?.label ?? cell.key,
            value: rounds || "—",
          };
        }),
        total: row.complete
          ? `${formatResultMarks(row.obtainedTotal)}/${formatResultMarks(row.maxTotal)}`
          : null,
        percent: row.percent,
        grade: row.grade,
        position: row.position,
      })),
    [rows, columns, phoneByStudentId],
  );

  const chrome = {
    organization,
    className,
    sectionName,
    session,
    roundLabels,
    rows,
  };

  return (
    <div className="print-page student-list-print gazette-print-page result-sheet-page">
      <style>{`
        @media print {
          @page { size: A4 landscape; margin: 0.28in 0.22in; }
          @page gazette { size: A4 landscape; margin: 0.28in 0.22in; }
        }
      `}</style>

      <div className="print-toolbar no-print">
        <ResultsBackLink href={backHref} />
        {reportCardBaseHref ? (
          <>
            <Link href={reportCardBaseHref}>
              <Button size="sm" variant="secondary">
                Combined report cards
              </Button>
            </Link>
            <Link
              href={reportCardBaseHref.replace(
                "/report-cards?",
                "/report-cards/print-all?",
              )}
            >
              <Button size="sm" variant="outline">
                Print all cards
              </Button>
            </Link>
          </>
        ) : null}
        <Button size="sm" onClick={() => window.print()}>
          <Printer className="h-3.5 w-3.5" />
          Print / Save PDF
        </Button>
      </div>

      <WhatsAppResultPanel
        orgName={organization.name.trim() || "Institute"}
        title={`Combined result: ${roundLabels.join(" + ")}`}
        className={className}
        sectionName={sectionName}
        session={session}
        students={shareStudents}
      />

      {columns.length === 0 ? (
        <article className="student-list-sheet gazette-sheet result-sheet">
          <p className="student-list-empty">No subject marks entered yet.</p>
        </article>
      ) : (
        <>
          <article className="student-list-sheet gazette-sheet gazette-sheet--screen result-sheet no-print">
            <SheetChrome {...chrome} />
            <div className="gazette-table-scroll">
              <GazetteTable
                columns={columns}
                rows={rows}
                showTotals
                reportCardBaseHref={reportCardBaseHref}
              />
            </div>
            <ResultSheetSignatures />
          </article>

          {subjectChunks.map((chunk, pageIndex) => {
            const isFirst = pageIndex === 0;
            const isLast = pageIndex === subjectChunks.length - 1;
            return (
              <article
                key={`print-${pageIndex}`}
                className={`student-list-sheet gazette-sheet gazette-sheet--print result-sheet print-only${
                  !isLast ? " student-list-print-break" : ""
                }`}
              >
                <SheetChrome
                  {...chrome}
                  compactHeader={!isFirst}
                  sheetLabel={
                    subjectChunks.length > 1
                      ? `Sheet ${pageIndex + 1}/${subjectChunks.length}`
                      : null
                  }
                />
                <div className="gazette-table-scroll">
                  <GazetteTable
                    columns={chunk}
                    rows={rows}
                    showTotals={isLast}
                  />
                </div>
                {isLast ? (
                  <ResultSheetSignatures />
                ) : (
                  <p className="gazette-continued">Continued on next sheet…</p>
                )}
              </article>
            );
          })}
        </>
      )}

      <p className="print-screen-hint no-print">
        Print uses Landscape A4. With 3+ rounds, subjects continue on the next
        sheet so marks stay readable.
      </p>
    </div>
  );
}
