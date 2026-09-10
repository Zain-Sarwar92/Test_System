import type { ReactNode } from "react";
import {
  formatResultMarks,
  formatResultPercent,
  gradeFromPercent,
  percentOf,
} from "@/lib/results";

export type ReportOrg = {
  name: string;
  logoUrl?: string | null;
  address?: string | null;
  phone?: string | null;
};

export type SchoolReportSubjectRow = {
  key: string;
  name: string;
  totalMarks: number;
  obtained: number | null;
  isAbsent: boolean;
  /** Extra cells after subject name (e.g. per-exam marks). */
  extraDisplays?: string[];
};

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

export function subjectEvalStatus(
  obtained: number | null,
  totalMarks: number,
  isAbsent: boolean,
  passPercent: number,
): { percent: number | null; grade: string; status: string } {
  if (isAbsent) return { percent: null, grade: "—", status: "ABSENT" };
  if (obtained == null) return { percent: null, grade: "—", status: "—" };
  const percent = percentOf(obtained, totalMarks);
  return {
    percent,
    grade: gradeFromPercent(percent),
    status: percent != null && percent >= passPercent ? "PASS" : "FAIL",
  };
}

export function SchoolReportOrgHeader({ organization }: { organization: ReportOrg }) {
  const orgName = organization.name.trim() || "Institute";
  return (
    <header className="school-rc-header">
      {organization.logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={organization.logoUrl} alt="" className="school-rc-logo" />
      ) : (
        <div className="school-rc-logo-fallback" aria-hidden>
          {(orgName.slice(0, 2) || "IN").toUpperCase()}
        </div>
      )}
      <div className="school-rc-header-text">
        <h1>{orgName}</h1>
        {organization.address ? (
          <p className="school-rc-address">{organization.address}</p>
        ) : null}
        {organization.phone ? <p>Phone: {organization.phone}</p> : null}
      </div>
    </header>
  );
}

export function SchoolReportStudentInfo({
  studentName,
  fatherName,
  rollNumber,
  className,
  sectionName,
  sessionLabel,
}: {
  studentName: string;
  fatherName: string;
  rollNumber: string;
  className: string;
  sectionName: string;
  sessionLabel: string;
}) {
  return (
    <table className="school-rc-student">
      <tbody>
        <tr>
          <th>Student Name</th>
          <td>{studentName}</td>
          <th>Class</th>
          <td>{className}</td>
        </tr>
        <tr>
          <th>Father Name</th>
          <td>{fatherName || "—"}</td>
          <th>Section</th>
          <td>{sectionName}</td>
        </tr>
        <tr>
          <th>Registration</th>
          <td>{rollNumber}</td>
          <th>Session</th>
          <td>{sessionLabel}</td>
        </tr>
      </tbody>
    </table>
  );
}

export function SchoolReportSubjectsTable({
  subjects,
  passPercent,
  extraHeaders = [],
}: {
  subjects: SchoolReportSubjectRow[];
  passPercent: number;
  extraHeaders?: string[];
}) {
  return (
    <table className="school-rc-table">
      <thead>
        <tr>
          <th className="col-num">#</th>
          <th>Exam Subjects</th>
          {extraHeaders.map((h) => (
            <th key={h}>{h}</th>
          ))}
          <th>T-Marks</th>
          <th>O-Marks</th>
          <th>%</th>
          <th>Grade</th>
          <th>Status</th>
        </tr>
      </thead>
      <tbody>
        {subjects.map((subject, index) => {
          const evalRow = subjectEvalStatus(
            subject.obtained,
            subject.totalMarks,
            subject.isAbsent,
            passPercent,
          );
          return (
            <tr key={subject.key}>
              <td className="col-num">{index + 1}</td>
              <td className="col-subject">{subject.name}</td>
              {(subject.extraDisplays ?? []).map((value, i) => (
                <td key={`${subject.key}:x${i}`}>{value}</td>
              ))}
              <td>{formatResultMarks(subject.totalMarks)}</td>
              <td>
                {subject.isAbsent
                  ? "Abs"
                  : subject.obtained == null
                    ? "—"
                    : formatResultMarks(subject.obtained)}
              </td>
              <td>
                {evalRow.percent == null
                  ? "—"
                  : formatResultPercent(evalRow.percent)}
              </td>
              <td>{evalRow.grade}</td>
              <td
                className={
                  evalRow.status === "PASS"
                    ? "status-pass"
                    : evalRow.status === "FAIL"
                      ? "status-fail"
                      : undefined
                }
              >
                {evalRow.status}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

export function SchoolReportTotals({
  maxTotal,
  obtainedTotal,
  percent,
  grade,
  position,
  resultLabel,
}: {
  maxTotal: number;
  obtainedTotal: number;
  percent: number | null;
  grade: string;
  position?: number | string | null;
  resultLabel?: string | null;
}) {
  return (
    <div className="school-rc-totals">
      <div>
        <span>Total Marks</span>
        <strong>{formatResultMarks(maxTotal)}</strong>
      </div>
      <div>
        <span>Obtained Marks</span>
        <strong>{formatResultMarks(obtainedTotal)}</strong>
      </div>
      <div>
        <span>Percentage</span>
        <strong>
          {percent == null ? "—" : `${formatResultPercent(percent)}%`}
        </strong>
      </div>
      <div>
        <span>Grade</span>
        <strong>{grade}</strong>
      </div>
      <div>
        <span>Position</span>
        <strong>{position ?? "—"}</strong>
      </div>
      {resultLabel != null ? (
        <div>
          <span>Result</span>
          <strong>{resultLabel}</strong>
        </div>
      ) : null}
    </div>
  );
}

export function SchoolReportRemarks() {
  return (
    <div className="school-rc-remarks-row">
      <div className="school-rc-remarks">
        <span>Teacher&apos;s Remarks:</span>
        <div className="school-rc-remarks-line" />
        <div className="school-rc-remarks-line" />
      </div>
      <table className="school-rc-behavior">
        <tbody>
          <tr>
            <th>Hand Writing:</th>
            <td />
          </tr>
          <tr>
            <th>Uniform:</th>
            <td />
          </tr>
          <tr>
            <th>Homework:</th>
            <td />
          </tr>
        </tbody>
      </table>
    </div>
  );
}

export function SchoolReportAttendance() {
  return (
    <>
      <h3 className="school-rc-section-title">Student Attendance Summary</h3>
      <table className="school-rc-attendance">
        <thead>
          <tr>
            {MONTHS.map((month) => (
              <th key={month}>{month}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr>
            {MONTHS.map((month) => (
              <td key={month}>&nbsp;</td>
            ))}
          </tr>
        </tbody>
      </table>
    </>
  );
}

export function SchoolReportAccumulative({
  rows,
}: {
  rows: Array<{
    key: string;
    name: string;
    maxTotal: number;
    obtainedTotal: number;
    percent: number | null;
    grade: string;
  }>;
}) {
  return (
    <>
      <h3 className="school-rc-section-title">
        Accumulative Result&apos;s Summary
      </h3>
      {rows.length === 0 ? (
        <p className="school-rc-empty">No exam results yet.</p>
      ) : (
        <table className="school-rc-table school-rc-accumulative">
          <thead>
            <tr>
              <th>Exam Name</th>
              <th>Total Marks</th>
              <th>Obtained Marks</th>
              <th>Percentage</th>
              <th>Grade</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.key}>
                <td className="col-subject">{row.name}</td>
                <td>{formatResultMarks(row.maxTotal)}</td>
                <td>{formatResultMarks(row.obtainedTotal)}</td>
                <td>
                  {row.percent == null
                    ? "—"
                    : `${formatResultPercent(row.percent)}%`}
                </td>
                <td>{row.grade}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}

export function SchoolReportSignatures() {
  return (
    <footer className="school-rc-sign">
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
  );
}

export function SchoolReportShell({
  organization,
  title,
  studentName,
  fatherName,
  rollNumber,
  className,
  sectionName,
  sessionLabel,
  pageBreakAfter = false,
  children,
}: {
  organization: ReportOrg;
  title: string;
  studentName: string;
  fatherName: string;
  rollNumber: string;
  className: string;
  sectionName: string;
  sessionLabel: string;
  pageBreakAfter?: boolean;
  children: ReactNode;
}) {
  return (
    <article
      className={`school-rc-sheet${pageBreakAfter ? " school-rc-sheet--break" : ""}`}
    >
      <SchoolReportOrgHeader organization={organization} />
      <h2 className="school-rc-title">{title}</h2>
      <SchoolReportStudentInfo
        studentName={studentName}
        fatherName={fatherName}
        rollNumber={rollNumber}
        className={className}
        sectionName={sectionName}
        sessionLabel={sessionLabel}
      />
      {children}
      <SchoolReportSignatures />
    </article>
  );
}
