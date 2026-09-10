import { type CompiledStudent } from "@/lib/results";
import {
  SchoolReportAccumulative,
  SchoolReportAttendance,
  SchoolReportRemarks,
  SchoolReportShell,
  SchoolReportSubjectsTable,
  SchoolReportTotals,
  type ReportOrg,
} from "@/app/org-admin/results/school-report-card";

export function ReportCardSheet({
  organization,
  className,
  sectionName,
  examName,
  session,
  row,
  passPercent = 33,
  pageBreakAfter = false,
}: {
  organization: ReportOrg;
  className: string;
  sectionName: string;
  examName: string;
  session: string;
  row: CompiledStudent;
  passPercent?: number;
  pageBreakAfter?: boolean;
}) {
  const subjectRows = row.cells
    .filter((cell) => cell.applicable)
    .map((cell) => ({
      key: cell.id,
      name: cell.name,
      totalMarks: cell.totalMarks,
      obtained: cell.isAbsent ? null : cell.obtained,
      isAbsent: cell.isAbsent,
    }));

  return (
    <SchoolReportShell
      organization={organization}
      title={`Exams Result Report (${examName})`}
      studentName={row.name}
      fatherName={row.fatherName}
      rollNumber={row.rollNumber}
      className={className}
      sectionName={sectionName}
      sessionLabel={session}
      pageBreakAfter={pageBreakAfter}
    >
      <h3 className="school-rc-section-title">Subjects Evaluation Sheet</h3>
      <SchoolReportSubjectsTable
        subjects={subjectRows}
        passPercent={passPercent}
      />
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
      <SchoolReportAccumulative
        rows={[
          {
            key: examName,
            name: examName,
            maxTotal: row.maxTotal,
            obtainedTotal: row.obtainedTotal,
            percent: row.percent,
            grade: row.grade,
          },
        ]}
      />
    </SchoolReportShell>
  );
}
