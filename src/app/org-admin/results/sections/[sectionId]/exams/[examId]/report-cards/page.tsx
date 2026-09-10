import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { PageHeader, PageStack } from "@/components/page-header";
import { ResultsBackLink } from "@/app/org-admin/results/results-back-link";
import { ReportCardStudentTable } from "@/app/org-admin/results/report-card-student-table";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";
import { compileSectionResult, sortByRoll } from "@/lib/results";
import { withChosenElectives } from "@/lib/subject-stream";

export default async function ExamReportCardsIndexPage({
  params,
}: {
  params: Promise<{ sectionId: string; examId: string }>;
}) {
  const session = await requireRole(["ORG_ADMIN"]);
  const organizationId = session.user.organizationId;
  const { sectionId, examId } = await params;
  if (!organizationId) notFound();

  const [section, exam] = await Promise.all([
    prisma.section.findFirst({
      where: { id: sectionId, organizationId },
      select: {
        id: true,
        name: true,
        class: {
          select: { id: true, name: true, board: { select: { name: true } } },
        },
      },
    }),
    prisma.examTerm.findFirst({
      where: { id: examId, organizationId },
      select: { id: true, name: true, session: true, passPercent: true },
    }),
  ]);
  if (!section || !exam) notFound();

  const [students, assessments] = await Promise.all([
    prisma.student.findMany({
      where: { organizationId, sectionId: section.id, isActive: true },
      select: {
        id: true,
        rollNumber: true,
        name: true,
        fatherName: true,
        stream: true,
        studyGroup: true,
        electiveSubjectId: true,
        electiveChoices: { select: { subjectId: true } },
      },
    }),
    prisma.subjectAssessment.findMany({
      where: {
        organizationId,
        examTermId: exam.id,
        sectionId: section.id,
      },
      select: {
        subjectId: true,
        totalMarks: true,
        marks: {
          select: {
            studentId: true,
            obtainedMarks: true,
            isAbsent: true,
          },
        },
        subject: {
          select: {
            id: true,
            name: true,
            track: true,
            electiveGroup: true,
          },
        },
      },
    }),
  ]);

  if (assessments.length === 0) {
    redirect(
      `/org-admin/results/sections/${section.id}/exams/${exam.id}/select-subjects`,
    );
  }

  const compiled = compileSectionResult({
    passPercent: exam.passPercent,
    className: section.class.name,
    students: students
      .map((s) => withChosenElectives(s))
      .sort((a, b) => sortByRoll(a.rollNumber, b.rollNumber)),
    subjects: assessments.map((a) => ({
      id: a.subject.id,
      name: a.subject.name,
      track: a.subject.track,
      electiveGroup: a.subject.electiveGroup,
      totalMarks: Number(a.totalMarks),
    })),
    marks: assessments.flatMap((a) =>
      a.marks.map((m) => ({
        studentId: m.studentId,
        subjectId: a.subjectId,
        obtainedMarks: m.obtainedMarks == null ? null : Number(m.obtainedMarks),
        isAbsent: m.isAbsent,
      })),
    ),
  });

  const base = `/org-admin/results/sections/${section.id}/exams/${exam.id}`;

  return (
    <PageStack wide>
      <PageHeader
        kicker={`${section.class.board.name} · ${section.class.name} · ${section.name}`}
        title="Student report cards"
        description={`${exam.name} · Session ${exam.session}. Print one student, or all cards in one go.`}
        actions={
          <div className="flex flex-wrap gap-2">
            <ResultsBackLink href={base} />
            <Link href={`${base}/gazette`}>
              <Button variant="outline" size="sm">
                Gazette
              </Button>
            </Link>
            <Link href={`${base}/report-cards/print-all`}>
              <Button size="sm">Print all cards</Button>
            </Link>
          </div>
        }
      />

      <ReportCardStudentTable
        rows={compiled.rows.map((row) => ({
          id: row.id,
          rollNumber: row.rollNumber,
          name: row.name,
          fatherName: row.fatherName,
          obtainedTotal: row.obtainedTotal,
          maxTotal: row.maxTotal,
          percent: row.percent,
          grade: row.grade,
          position: row.position,
        }))}
        cardHrefPrefix={`${base}/report-cards/`}
      />
    </PageStack>
  );
}
