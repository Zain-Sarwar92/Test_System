import {
  SchoolReportAccumulative,
  SchoolReportAttendance,
  SchoolReportRemarks,
  SchoolReportShell,
  SchoolReportSubjectsTable,
  SchoolReportTotals,
  type ReportOrg,
} from "@/app/org-admin/results/school-report-card";

export type OverallReportSubject = {
  name: string;
  obtained: number | null;
  total: number;
  isAbsent: boolean;
};

export type OverallReportExam = {
  id: string;
  name: string;
  session: string;
  obtainedTotal: number;
  maxTotal: number;
  percent: number | null;
  grade: string;
  subjects: OverallReportSubject[];
  passPercent: number;
};

export function OverallExamReportSheet({
  organization,
  studentName,
  fatherName,
  rollNumber,
  className,
  sectionName,
  sessionLabel,
  focusExam,
  accumulative,
}: {
  organization: ReportOrg;
  studentName: string;
  fatherName: string;
  rollNumber: string;
  className: string;
  sectionName: string;
  sessionLabel: string;
  focusExam: OverallReportExam | null;
  accumulative: OverallReportExam[];
}) {
  const titleExam = focusExam?.name?.trim() || "Overall";

  return (
    <SchoolReportShell
      organization={organization}
      title={`Exams Result Report (${titleExam})`}
      studentName={studentName}
      fatherName={fatherName}
      rollNumber={rollNumber}
      className={className}
      sectionName={sectionName}
      sessionLabel={sessionLabel}
    >
      <h3 className="school-rc-section-title">Subjects Evaluation Sheet</h3>
      {focusExam ? (
        <>
          <SchoolReportSubjectsTable
            subjects={focusExam.subjects.map((subject) => ({
              key: `${focusExam.id}:${subject.name}`,
              name: subject.name,
              totalMarks: subject.total,
              obtained: subject.obtained,
              isAbsent: subject.isAbsent,
            }))}
            passPercent={focusExam.passPercent}
          />
          <SchoolReportTotals
            maxTotal={focusExam.maxTotal}
            obtainedTotal={focusExam.obtainedTotal}
            percent={focusExam.percent}
            grade={focusExam.grade}
          />
        </>
      ) : (
        <p className="school-rc-empty">No subject marks for this exam.</p>
      )}

      <SchoolReportRemarks />
      <SchoolReportAttendance />
      <SchoolReportAccumulative
        rows={accumulative.map((exam) => ({
          key: exam.id,
          name: exam.name,
          maxTotal: exam.maxTotal,
          obtainedTotal: exam.obtainedTotal,
          percent: exam.percent,
          grade: exam.grade,
        }))}
      />
    </SchoolReportShell>
  );
}
