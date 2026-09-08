"use client";

import { useMemo } from "react";
import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { MultiRoundColumn, MultiRoundStudentRow } from "@/lib/results";
import { ResultsBackLink } from "@/app/org-admin/results/results-back-link";
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

function tableRoundLabel(label: string, index: number) {
  const match = label.match(/(\d+)/);
  return match ? `R${match[1]}` : `R${index + 1}`;
}

function GazetteTable({
  columns,
  rows,
  showTotals,
}: {
  columns: MultiRoundColumn[];
  rows: MultiRoundStudentRow[];
  showTotals: boolean;
}) {
  const keys = new Set(columns.map((column) => column.key));

  return (
    <table className="gazette-table gazette-table--multi">
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
          <tr key={row.id} className="gazette-student-row">
            <td className="col-roll">{row.rollNumber}</td>
            <td className="name col-name">{row.name}</td>
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
                <td className="col-total">
                  {row.maxTotal > 0
                    ? `${row.obtainedTotal}/${row.maxTotal}`
                    : "—"}
                </td>
                <td className="col-pct">
                  {row.percent == null ? "—" : row.percent}
                </td>
                <td className="col-pos">{row.position ?? "—"}</td>
                <td className="col-grade">{row.grade}</td>
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
  boardName,
  className,
  sectionName,
  session,
  roundLabels,
  rows,
  sheetLabel,
  compactHeader,
}: {
  organization: Org;
  boardName: string;
  className: string;
  sectionName: string;
  session: string;
  roundLabels: string[];
  rows: MultiRoundStudentRow[];
  sheetLabel?: string | null;
  compactHeader?: boolean;
}) {
  const orgName = organization.name.trim() || "Institute";
  const logoUrl = organization.logoUrl?.trim() || null;
  const complete = rows.filter((row) => row.complete).length;
  const passed = rows.filter((row) => row.passed).length;

  if (compactHeader) {
    return (
      <div className="student-list-title-block gazette-continued-header">
        <h2 className="student-list-title">Combined Result Gazette</h2>
        <p className="student-list-ref">
          {roundLabels.join(" + ")} · {session}
          {sheetLabel ? ` · ${sheetLabel}` : ""} · continued
        </p>
      </div>
    );
  }

  return (
    <>
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
          {sheetLabel ? ` · ${sheetLabel}` : ""}
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
          <span>Result</span>
          <strong>
            {passed}/{complete} passed
          </strong>
        </div>
      </div>
    </>
  );
}

export function CombinedGazetteView({
  organization,
  boardName,
  className,
  sectionName,
  session,
  roundLabels,
  columns,
  rows,
  backHref,
  phoneByStudentId = {},
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
        total: row.complete ? `${row.obtainedTotal}/${row.maxTotal}` : null,
        percent: row.percent,
        grade: row.grade,
        position: row.position,
      })),
    [rows, columns, phoneByStudentId],
  );

  const chrome = {
    organization,
    boardName,
    className,
    sectionName,
    session,
    roundLabels,
    rows,
  };

  return (
    <div className="print-page student-list-print gazette-print-page">
      <style>{`
        @media print {
          @page { size: A4 landscape; margin: 0.28in 0.22in; }
          @page gazette { size: A4 landscape; margin: 0.28in 0.22in; }
        }
      `}</style>

      <div className="print-toolbar no-print">
        <ResultsBackLink href={backHref} />
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
        <article className="student-list-sheet gazette-sheet">
          <p className="student-list-empty">No subject marks entered yet.</p>
        </article>
      ) : (
        <>
          {/* Screen: full table */}
          <article className="student-list-sheet gazette-sheet gazette-sheet--screen no-print">
            <SheetChrome {...chrome} />
            <div className="gazette-table-scroll">
              <GazetteTable columns={columns} rows={rows} showTotals />
            </div>
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

          {/* Print: split subjects so 3 rounds fit on landscape pages */}
          {subjectChunks.map((chunk, pageIndex) => {
            const isFirst = pageIndex === 0;
            const isLast = pageIndex === subjectChunks.length - 1;
            return (
              <article
                key={`print-${pageIndex}`}
                className={`student-list-sheet gazette-sheet gazette-sheet--print print-only${
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
