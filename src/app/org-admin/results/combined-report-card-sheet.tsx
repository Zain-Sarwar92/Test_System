import {
  gradeFromPercent,
  percentOf,
  type MultiRoundColumn,
  type MultiRoundStudentRow,
} from "@/lib/results";
import {
  SchoolReportAccumulative,
  SchoolReportAttendance,
  SchoolReportRemarks,
  SchoolReportShell,
  SchoolReportSubjectsTable,
  SchoolReportTotals,
  type ReportOrg,
} from "@/app/org-admin/results/school-report-card";

function parseDisplayMarks(display: string): {
  obtained: number | null;
  isAbsent: boolean;
} {
  const t = display.trim();
  if (!t || t === "—") return { obtained: null, isAbsent: false };
  if (/^abs/i.test(t)) return { obtained: null, isAbsent: true };
  const n = Number(t);
  return Number.isFinite(n)
    ? { obtained: n, isAbsent: false }
    : { obtained: null, isAbsent: false };
}

export function CombinedReportCardSheet({
  organization,
  className,
  sectionName,
  examTitle,
  session,
  roundLabels,
  columns,
  row,
  passPercent = 33,
  pageBreakAfter = false,
}: {
  organization: ReportOrg;
  className: string;
  sectionName: string;
  examTitle: string;
  session: string;
  roundLabels: string[];
  columns: MultiRoundColumn[];
  row: MultiRoundStudentRow;
  passPercent?: number;
  pageBreakAfter?: boolean;
}) {
  const breakdownByKey = new Map(
    row.breakdown.map((cell) => [cell.key, cell]),
  );

  const subjects = columns
    .map((column, index) => ({ column, index, cell: row.cells[index] }))
    .filter((entry) => entry.cell?.applicable)
    .map(({ column, cell }) => {
      const breakdown = breakdownByKey.get(column.key);
      const extraDisplays = roundLabels.map((_, roundIndex) => {
        const roundId = column.rounds[roundIndex]?.id;
        return (
          breakdown?.roundValues.find((v) => v.roundId === roundId)?.display ??
          "—"
        );
      });
      return {
        key: column.key,
        name: column.label,
        totalMarks: cell!.totalMarks,
        obtained: cell!.isAbsent ? null : cell!.obtained,
        isAbsent: cell!.isAbsent,
        extraDisplays,
      };
    });

  const accumulative = roundLabels.map((label, roundIndex) => {
    const roundId =
      columns.find((c) => c.rounds[roundIndex])?.rounds[roundIndex]?.id ??
      `round-${roundIndex}`;
    let obtainedTotal = 0;
    let maxTotal = 0;
    let hasAny = false;

    for (let colIndex = 0; colIndex < columns.length; colIndex++) {
      const column = columns[colIndex]!;
      const cell = row.cells[colIndex];
      if (!cell?.applicable) continue;
      const roundMeta = column.rounds.find((r) => r.id === roundId);
      if (!roundMeta) continue;
      const breakdown = breakdownByKey.get(column.key);
      const display =
        breakdown?.roundValues.find((v) => v.roundId === roundId)?.display ??
        "—";
      const parsed = parseDisplayMarks(display);
      if (display === "—") continue;
      hasAny = true;
      maxTotal += roundMeta.totalMarks;
      if (!parsed.isAbsent && parsed.obtained != null) {
        obtainedTotal += parsed.obtained;
      }
    }

    if (!hasAny) {
      return {
        key: roundId,
        name: label,
        maxTotal: 0,
        obtainedTotal: 0,
        percent: null as number | null,
        grade: "—",
      };
    }

    const percent = percentOf(obtainedTotal, maxTotal);
    return {
      key: roundId,
      name: label,
      maxTotal,
      obtainedTotal,
      percent,
      grade: gradeFromPercent(percent),
    };
  });

  return (
    <SchoolReportShell
      organization={organization}
      title={`Exams Result Report (${examTitle})`}
      studentName={row.name}
      fatherName={row.fatherName}
      rollNumber={row.rollNumber}
      className={className}
      sectionName={sectionName}
      sessionLabel={session}
      pageBreakAfter={pageBreakAfter}
    >
      <h3 className="school-rc-section-title">Subjects Evaluation Sheet</h3>
      <div className="school-rc-table-scroll">
        <SchoolReportSubjectsTable
          subjects={subjects}
          passPercent={passPercent}
          extraHeaders={roundLabels}
        />
      </div>
      <SchoolReportTotals
        maxTotal={row.maxTotal}
        obtainedTotal={row.obtainedTotal}
        percent={row.percent}
        grade={row.grade}
        position={row.position}
        resultLabel={row.passed ? "PASS" : "FAIL"}
      />
      <SchoolReportRemarks />
      <SchoolReportAttendance />
      <SchoolReportAccumulative rows={accumulative} />
    </SchoolReportShell>
  );
}
