import Link from "next/link";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { PageHeader, PageStack } from "@/components/page-header";
import {
  OverallExamReportSheet,
  type OverallReportExam,
} from "@/app/org-admin/results/overall-exam-report-sheet";
import { PrintButton } from "@/app/org-admin/results/print-button";
import { ResultsBackLink } from "@/app/org-admin/results/results-back-link";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";
import {
  examMonthKey,
  formatExamMonthLabel,
  formatResultPercent,
  gradeFromPercent,
  percentOf,
} from "@/lib/results";

type ExamBlock = OverallReportExam & {
  monthKey: string | null;
  monthLabel: string | null;
};

export default async function StudentReportCardPage({
  params,
  searchParams,
}: {
  params: Promise<{ studentId: string }>;
  searchParams: Promise<{ session?: string; exam?: string }>;
}) {
  const auth = await requireRole(["ORG_ADMIN"]);
  const organizationId = auth.user.organizationId;
  const { studentId } = await params;
  const query = await searchParams;
  if (!organizationId) notFound();

  const student = await prisma.student.findFirst({
    where: { id: studentId, organizationId },
    select: {
      id: true,
      name: true,
      fatherName: true,
      rollNumber: true,
      section: {
        select: {
          id: true,
          name: true,
          organization: {
            select: { name: true, logoUrl: true, address: true, phone: true },
          },
          class: {
            select: {
              id: true,
              name: true,
              board: { select: { name: true } },
            },
          },
        },
      },
    },
  });
  if (!student) notFound();

  const marks = await prisma.studentMark.findMany({
    where: {
      studentId: student.id,
      assessment: {
        organizationId,
        sectionId: student.section.id,
      },
    },
    select: {
      obtainedMarks: true,
      isAbsent: true,
      assessment: {
        select: {
          totalMarks: true,
          subject: { select: { name: true } },
          examTerm: {
            select: {
              id: true,
              name: true,
              session: true,
              examDate: true,
              createdAt: true,
              passPercent: true,
            },
          },
        },
      },
    },
  });

  const byExam = new Map<
    string,
    {
      exam: (typeof marks)[0]["assessment"]["examTerm"];
      subjects: ExamBlock["subjects"];
    }
  >();

  for (const mark of marks) {
    const exam = mark.assessment.examTerm;
    let bucket = byExam.get(exam.id);
    if (!bucket) {
      bucket = { exam, subjects: [] };
      byExam.set(exam.id, bucket);
    }
    const total = Number(mark.assessment.totalMarks);
    const obtained = mark.isAbsent
      ? 0
      : mark.obtainedMarks == null
        ? null
        : Number(mark.obtainedMarks);
    bucket.subjects.push({
      name: mark.assessment.subject.name,
      obtained: mark.isAbsent ? null : obtained,
      total,
      isAbsent: mark.isAbsent,
    });
  }

  const sessionFilter = String(query.session ?? "").trim();
  const examFilter = String(query.exam ?? "").trim();

  const exams: ExamBlock[] = [...byExam.values()]
    .filter(({ exam }) => !sessionFilter || exam.session === sessionFilter)
    .map(({ exam, subjects }) => {
      const entered = subjects.filter((s) => s.isAbsent || s.obtained != null);
      const obtainedTotal = entered.reduce((sum, s) => {
        if (s.isAbsent) return sum;
        return sum + (s.obtained ?? 0);
      }, 0);
      const maxTotal = entered.reduce((sum, s) => sum + s.total, 0);
      const percent = percentOf(obtainedTotal, maxTotal);
      const monthKey = examMonthKey(exam.examDate, exam.createdAt);
      return {
        id: exam.id,
        name: exam.name,
        session: exam.session,
        monthKey,
        monthLabel: monthKey ? formatExamMonthLabel(monthKey) : null,
        subjects: subjects.sort((a, b) => a.name.localeCompare(b.name)),
        obtainedTotal,
        maxTotal,
        percent,
        grade: gradeFromPercent(percent),
        passPercent: exam.passPercent,
      };
    })
    .sort((a, b) => {
      const ak = a.monthKey ?? "";
      const bk = b.monthKey ?? "";
      if (ak !== bk) return ak.localeCompare(bk);
      return a.name.localeCompare(b.name);
    });

  const sessions = [...new Set(exams.map((e) => e.session))].sort().reverse();
  const focusExam =
    exams.find((e) => e.id === examFilter) ??
    exams[exams.length - 1] ??
    null;

  const sessionLabel =
    sessionFilter ||
    focusExam?.session ||
    sessions[0] ||
    "—";

  const org = student.section.organization;
  const hrefBase = `/org-admin/results/students/${student.id}`;

  function examHref(examId: string) {
    const params = new URLSearchParams();
    if (sessionFilter) params.set("session", sessionFilter);
    params.set("exam", examId);
    return `${hrefBase}?${params.toString()}`;
  }

  return (
    <PageStack wide>
      <div className="print-toolbar no-print">
        <ResultsBackLink href="/org-admin/results/students" />
        <PrintButton label="Print report" />
      </div>

      <PageHeader
        className="no-print"
        kicker="Exams result report"
        title={student.name}
        description={`${student.section.class.board.name} · ${student.section.class.name} · ${student.section.name}`}
        actions={
          <div className="flex flex-wrap gap-2">
            <Link href={`/org-admin/students/${student.id}`}>
              <Button variant="secondary" size="sm">
                Profile
              </Button>
            </Link>
            <Link href="/org-admin/results/students">
              <Button variant="outline" size="sm">
                Find another
              </Button>
            </Link>
          </div>
        }
      />

      {sessions.length > 1 ? (
        <div className="no-print flex flex-wrap gap-2">
          <Link href={hrefBase}>
            <Button
              size="sm"
              variant={!sessionFilter ? "default" : "outline"}
            >
              All sessions
            </Button>
          </Link>
          {sessions.map((session) => (
            <Link
              key={session}
              href={`${hrefBase}?session=${encodeURIComponent(session)}`}
            >
              <Button
                size="sm"
                variant={sessionFilter === session ? "default" : "outline"}
              >
                {session}
              </Button>
            </Link>
          ))}
        </div>
      ) : null}

      {exams.length > 0 ? (
        <div className="no-print space-y-2">
          <p className="text-xs font-semibold tracking-wide text-muted uppercase">
            Focus exam (subjects sheet)
          </p>
          <div className="flex flex-wrap gap-2">
            {exams.map((exam) => (
              <Link key={exam.id} href={examHref(exam.id)}>
                <Button
                  size="sm"
                  variant={focusExam?.id === exam.id ? "default" : "outline"}
                >
                  {exam.name}
                  {exam.percent == null
                    ? ""
                    : ` · ${formatResultPercent(exam.percent)}%`}
                </Button>
              </Link>
            ))}
          </div>
        </div>
      ) : null}

      <div className="report-card-screen print-page">
        <OverallExamReportSheet
          organization={org}
          studentName={student.name}
          fatherName={student.fatherName}
          rollNumber={student.rollNumber}
          className={student.section.class.name}
          sectionName={student.section.name}
          sessionLabel={sessionLabel}
          focusExam={focusExam}
          accumulative={exams}
        />
      </div>
    </PageStack>
  );
}
