"use client";

import { useMemo, useState } from "react";
import { Printer } from "lucide-react";
import { ResultsBackLink } from "@/app/org-admin/results/results-back-link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export type StudentListRow = {
  id: string;
  rollNumber: string;
  name: string;
  fatherName: string;
  obtainedMarks?: string | null;
  isAbsent?: boolean;
};

export type StudentListOrg = {
  name: string;
  logoUrl?: string | null;
  address?: string | null;
  phone?: string | null;
};

function todayInputValue() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

function formatDate(value: string) {
  if (!value) return "____________";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function academicSession(date = new Date()) {
  const year = date.getFullYear();
  const start = date.getMonth() >= 3 ? year : year - 1;
  return `${start}-${String(start + 1).slice(-2)}`;
}

export function StudentListPrintView({
  organization,
  boardName,
  className,
  sectionName,
  students,
  backHref,
  embedded = false,
  initialTitle,
  initialSession,
  initialSubject,
  initialExam,
  initialDate,
  initialTotalMarks,
  withMarks = false,
}: {
  organization: StudentListOrg;
  boardName: string;
  className: string;
  sectionName: string;
  students: StudentListRow[];
  backHref: string;
  embedded?: boolean;
  initialTitle?: string;
  initialSession?: string;
  initialSubject?: string;
  initialExam?: string;
  initialDate?: string;
  initialTotalMarks?: string;
  withMarks?: boolean;
}) {
  const [title, setTitle] = useState(initialTitle || "Student List");
  const [session, setSession] = useState(initialSession || academicSession());
  const [subject, setSubject] = useState(initialSubject || "");
  const [exam, setExam] = useState(initialExam || "");
  const [listDate, setListDate] = useState(initialDate || todayInputValue());
  const [totalMarks, setTotalMarks] = useState(initialTotalMarks || "");

  const orgName = organization.name.trim() || "Institute";
  const logoUrl = organization.logoUrl?.trim() || null;
  const address = organization.address?.trim() || null;
  const phone = organization.phone?.trim() || null;
  const listRef = useMemo(() => {
    const classPart = className.replace(/\s+/g, "").toUpperCase();
    const sectionPart = sectionName.replace(/\s+/g, "").toUpperCase();
    const datePart = listDate.replaceAll("-", "");
    return `${classPart}-${sectionPart}-${datePart}`;
  }, [className, sectionName, listDate]);

  return (
    <div className={embedded ? "student-list-print-break" : "print-page student-list-print"}>
      {embedded ? null : (
        <>
      <div className="print-toolbar no-print">
        <ResultsBackLink href={backHref} />
        <Button size="sm" onClick={() => window.print()}>
          <Printer className="h-3.5 w-3.5" />
          Print / Save PDF
        </Button>
      </div>

      <div className="no-print mb-4 rounded-[1.1rem] border border-[rgba(15,40,70,0.1)] bg-card p-4 shadow-[0_8px_24px_rgba(11,31,51,0.05)] sm:p-5">
        <p className="text-sm font-semibold text-ink">Fill details before printing</p>
        <p className="mt-1 text-xs text-muted">
          These fields print on the header so this list is unique for the class, section, exam, and date.
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-ink">List title</span>
            <Input value={title} onChange={(event) => setTitle(event.target.value)} />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-ink">Session</span>
            <Input value={session} onChange={(event) => setSession(event.target.value)} />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-ink">Subject</span>
            <Input
              value={subject}
              onChange={(event) => setSubject(event.target.value)}
              placeholder="e.g. Mathematics"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-ink">Exam</span>
            <Input
              value={exam}
              onChange={(event) => setExam(event.target.value)}
              placeholder="e.g. Mid Term"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-ink">Date</span>
            <Input
              type="date"
              value={listDate}
              onChange={(event) => setListDate(event.target.value)}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-ink">Total marks</span>
            <Input
              value={totalMarks}
              onChange={(event) => setTotalMarks(event.target.value)}
              placeholder="e.g. 30"
            />
          </label>
        </div>
      </div>
        </>
      )}

      <article className="student-list-sheet">
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
              {address ? (
                <p className="exam-org-address">HEAD OFFICE: {address.toUpperCase()}</p>
              ) : null}
              {phone ? <p className="exam-org-phone">Ph: {phone}</p> : null}
            </div>
            <div className="exam-brand-spacer" aria-hidden />
          </div>
        </header>

        <div className="student-list-title-block">
          <h2 className="student-list-title">{title.trim() || "Student List"}</h2>
          <p className="student-list-ref">List Ref: {listRef}</p>
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
            <span>Session</span>
            <strong>{session || "____________"}</strong>
          </div>
          <div>
            <span>Subject</span>
            <strong>{subject.trim() || "____________"}</strong>
          </div>
          <div>
            <span>Exam</span>
            <strong>{exam.trim() || "____________"}</strong>
          </div>
          <div>
            <span>Date</span>
            <strong>{formatDate(listDate)}</strong>
          </div>
          <div>
            <span>Students</span>
            <strong>{students.length}</strong>
          </div>
        </div>

        {students.length === 0 ? (
          <p className="student-list-empty">No active students in this section.</p>
        ) : (
          <table className="student-list-table">
            <thead>
              <tr>
                <th className="col-sr">Sr.</th>
                <th className="col-roll">Roll No.</th>
                <th className="col-name">Student Name</th>
                <th className="col-father">Father Name</th>
                <th className="col-obt">Obt. Marks</th>
                <th className="col-total">Total Marks</th>
              </tr>
            </thead>
            <tbody>
              {students.map((student, index) => (
                <tr key={student.id}>
                  <td className="col-sr">{index + 1}</td>
                  <td className="col-roll">{student.rollNumber}</td>
                  <td className="col-name">{student.name}</td>
                  <td className="col-father">{student.fatherName}</td>
                  <td className="col-obt">
                    {withMarks
                      ? student.isAbsent
                        ? "A"
                        : (student.obtainedMarks?.trim() || "")
                      : ""}
                  </td>
                  <td className="col-total">{totalMarks.trim()}</td>
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

      {embedded ? null : (
      <p className="print-screen-hint no-print">
        Review the preview, then Print / Save PDF. Fill subject, exam, date, and total marks so each printed list is unique.
      </p>
      )}
    </div>
  );
}
