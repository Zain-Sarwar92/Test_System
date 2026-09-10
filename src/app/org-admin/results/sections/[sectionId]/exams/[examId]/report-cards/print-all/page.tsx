import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { PrintButton } from "@/app/org-admin/results/print-button";
import { ReportCardSheet } from "@/app/org-admin/results/report-card-sheet";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";
import { compileSectionResult, sortByRoll } from "@/lib/results";
import { withChosenElectives } from "@/lib/subject-stream";

export default async function PrintAllReportCardsPage({
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
        organization: {
          select: { name: true, logoUrl: true, address: true, phone: true },
        },
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

  const base = `/org-admin/results/sections/${section.id}/exams/${exam.id}/report-cards`;

  return (
    <div className="report-card-screen">
      <div className="report-card-toolbar no-print">
        <div>
          <p className="text-sm font-semibold text-ink">
            Print all · {exam.name} · {compiled.rows.length} students
          </p>
          <p className="text-xs text-muted">
            {section.class.name} {section.name} · each card prints on its own
            page
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={base}>
            <Button variant="secondary" size="sm">
              Back to list
            </Button>
          </Link>
          <PrintButton label="Print all cards" />
        </div>
      </div>

      <div className="report-card-batch">
        {compiled.rows.map((row, index) => (
          <ReportCardSheet
            key={row.id}
            organization={section.organization}
            className={section.class.name}
            sectionName={section.name}
            examName={exam.name}
            session={exam.session}
            row={row}
            pageBreakAfter={index < compiled.rows.length - 1}
            passPercent={exam.passPercent}
          />
        ))}
      </div>
    </div>
  );
}
