import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader, PageStack } from "@/components/page-header";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";
import {
  isStudentEnrolledInSubject,
  resolveSubjectMeta,
  withChosenElectives,
} from "@/lib/subject-stream";
import {
  deleteSectionExamResult,
  deleteSubjectAssessment,
} from "../../../../actions";
import { ConfirmForm } from "../../../../confirm-form";
import { ResultsBackLink } from "@/app/org-admin/results/results-back-link";

const HUB_TONES = ["students", "teachers", "tests", "sections"] as const;

export default async function SectionExamSubjectsPage({
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
          select: {
            id: true,
            name: true,
            board: { select: { name: true } },
          },
        },
        _count: { select: { students: { where: { isActive: true } } } },
      },
    }),
    prisma.examTerm.findFirst({
      where: { id: examId, organizationId },
    }),
  ]);
  if (!section || !exam) notFound();

  const assessments = await prisma.subjectAssessment.findMany({
    where: { organizationId, examTermId: exam.id, sectionId: section.id },
    select: {
      id: true,
      subjectId: true,
      totalMarks: true,
      _count: { select: { sheets: true, marks: true } },
      marks: {
        select: { obtainedMarks: true, isAbsent: true, studentId: true },
      },
      manualMarks: {
        select: { obtainedMarks: true, isAbsent: true },
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
    orderBy: { subject: { name: "asc" } },
  });

  if (assessments.length === 0) {
    redirect(
      `/org-admin/results/sections/${section.id}/exams/${exam.id}/select-subjects`,
    );
  }

  const students = await prisma.student.findMany({
    where: { organizationId, sectionId: section.id, isActive: true },
    select: {
      id: true,
      stream: true,
      electiveSubjectId: true,
      electiveChoices: { select: { subjectId: true } },
    },
  });
  const enrolledStudents = students.map((student) => withChosenElectives(student));
  const includedSubjectCount = assessments.filter(
    (assessment) =>
      assessment.marks.some(
        (mark) => mark.isAbsent || mark.obtainedMarks != null,
      ) ||
      assessment.manualMarks.some(
        (mark) => mark.isAbsent || mark.obtainedMarks != null,
      ),
  ).length;

  const examsListHref = `/org-admin/results/sections/${section.id}`;
  const subjectsHref = `/org-admin/results/sections/${section.id}/exams/${exam.id}`;

  return (
    <PageStack wide>
      <PageHeader
        kicker={`${section.class.board.name} · ${section.class.name} · ${section.name}`}
        title={exam.name}
        description={`Session ${exam.session}. ${assessments.length} subject${assessments.length === 1 ? "" : "s"} selected for this result.`}
        actions={
          <div className="flex flex-col items-end gap-2">
            <ResultsBackLink href={examsListHref} />
            <div className="flex flex-wrap justify-end gap-2">
              {includedSubjectCount > 0 ? (
                <Link
                  href={`/org-admin/results/sections/${section.id}/exams/${exam.id}/gazette?stream=SCIENCE`}
                >
                  <Button>Generate Result</Button>
                </Link>
              ) : (
                <Button disabled title="Enter marks in at least one subject first">
                  Generate Result
                </Button>
              )}
              <ConfirmForm
                action={deleteSectionExamResult}
                message={`Delete result for ${section.name} in "${exam.name}"? All marks for this section will be cleared. The exam will stay for other sections.`}
              >
                <input type="hidden" name="sectionId" value={section.id} />
                <input type="hidden" name="examTermId" value={exam.id} />
                <Button type="submit" variant="danger">
                  Delete Result
                </Button>
              </ConfirmForm>
            </div>
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {assessments.map((assessment, index) => {
          const subject = assessment.subject;
          const meta = resolveSubjectMeta(subject);
          const tone = HUB_TONES[index % HUB_TONES.length];
          const enrolledIds = new Set(
            enrolledStudents
              .filter((student) => isStudentEnrolledInSubject(student, meta))
              .map((student) => student.id),
          );
          const enrolledCount = enrolledIds.size;
          const entered =
            assessment.marks.filter(
              (mark) =>
                enrolledIds.has(mark.studentId) &&
                (mark.isAbsent || mark.obtainedMarks != null),
            ).length +
            assessment.manualMarks.filter(
              (mark) => mark.isAbsent || mark.obtainedMarks != null,
            ).length;
          const printBack = encodeURIComponent(subjectsHref);
          const printBase = `/org-admin/students/print/${section.id}?subject=${encodeURIComponent(subject.name)}&exam=${encodeURIComponent(exam.name)}&session=${encodeURIComponent(exam.session)}&totalMarks=${encodeURIComponent(String(Number(assessment.totalMarks)))}&title=${encodeURIComponent("Award List")}&subjectId=${subject.id}&back=${printBack}`;
          return (
            <div
              key={subject.id}
              className={`org-dash-card tone-surface-${tone} chart-card p-5`}
              style={{ animationDelay: `${index * 40}ms` }}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="org-dash-card-label">Subject</p>
                  <h3 className="org-dash-card-value mt-1 text-xl">{subject.name}</h3>
                </div>
                <span className={`org-dash-icon org-dash-icon-tone-${tone}`}>
                  <BookOpen className="h-4 w-4" />
                </span>
              </div>
              <p className="org-dash-card-hint mt-3">
                {entered}/{enrolledCount} enrolled marks
                {` · Total ${Number(assessment.totalMarks)}`}
                {assessment._count.sheets
                  ? ` · ${assessment._count.sheets} sheet photo${assessment._count.sheets === 1 ? "" : "s"}`
                  : ""}
              </p>
              {entered > 0 ? (
                <span className="status-chip status-chip-success mt-3">
                  Included in result
                </span>
              ) : (
                <span className="status-chip status-chip-muted mt-3">
                  Not included
                </span>
              )}
              <div className="mt-4 flex flex-wrap gap-2">
                <Link
                  href={`/org-admin/results/sections/${section.id}/exams/${exam.id}/subjects/${subject.id}`}
                >
                  <Button size="sm">
                    {entered > 0 ? "Edit marks" : "Add marks"}
                  </Button>
                </Link>
                {entered > 0 ? (
                  <Link href={`${printBase}&assessmentId=${assessment.id}&withMarks=1`}>
                    <Button size="sm" variant="outline">
                      Print list
                    </Button>
                  </Link>
                ) : null}
                <ConfirmForm
                  action={deleteSubjectAssessment}
                  message={`Remove ${subject.name} from this result and clear its marks?`}
                >
                  <input type="hidden" name="assessmentId" value={assessment.id} />
                  <Button type="submit" size="sm" variant="danger">
                    Remove
                  </Button>
                </ConfirmForm>
              </div>
            </div>
          );
        })}
      </div>
    </PageStack>
  );
}
