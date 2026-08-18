import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { PageHeader, PageStack } from "@/components/page-header";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";
import {
  isStudentEnrolledInSubject,
  resolveSubjectMeta,
  withChosenElectives,
} from "@/lib/subject-stream";
import {
  deleteExamTerm,
  deleteSectionExamResult,
  deleteSubjectAssessment,
} from "../../../../actions";
import { ConfirmForm } from "../../../../confirm-form";

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
  const includedSubjectCount = assessments.filter((assessment) =>
    assessment.marks.some(
      (mark) => mark.isAbsent || mark.obtainedMarks != null,
    ),
  ).length;

  return (
    <PageStack wide>
      <PageHeader
        kicker={`${section.class.board.name} · ${section.class.name} · ${section.name}`}
        title={exam.name}
        description={`Session ${exam.session}. ${assessments.length} subject${assessments.length === 1 ? "" : "s"} selected for this result.`}
        actions={
          <div className="flex flex-wrap gap-2">
            <Link href={`/org-admin/results/sections/${section.id}`}>
              <Button variant="secondary">Results</Button>
            </Link>
            <Link
              href={`/org-admin/results/sections/${section.id}/exams/${exam.id}/select-subjects`}
            >
              <Button variant="outline">Edit subjects</Button>
            </Link>
            <Link href={`/org-admin/results/sections/${section.id}/exams/${exam.id}/print-lists`}>
              <Button variant="outline">Print all lists</Button>
            </Link>
            {includedSubjectCount > 0 ? (
              <>
                <Link
                  href={`/org-admin/results/sections/${section.id}/exams/${exam.id}/gazette?stream=SCIENCE`}
                >
                  <Button>Science result</Button>
                </Link>
                <Link
                  href={`/org-admin/results/sections/${section.id}/exams/${exam.id}/gazette?stream=ARTS`}
                >
                  <Button variant="secondary">Arts result</Button>
                </Link>
              </>
            ) : (
              <>
                <Button disabled>Science result</Button>
                <Button disabled>Arts result</Button>
              </>
            )}
            {assessments.length > 0 ? (
              <ConfirmForm
                action={deleteSectionExamResult}
                message={`Clear all marks for ${section.name} in "${exam.name}"? The exam will stay; only this section’s result is removed.`}
              >
                <input type="hidden" name="sectionId" value={section.id} />
                <input type="hidden" name="examTermId" value={exam.id} />
                <Button type="submit" variant="outline">
                  Clear section result
                </Button>
              </ConfirmForm>
            ) : null}
            <ConfirmForm
              action={deleteExamTerm}
              message={`Delete exam "${exam.name}" for the whole school? All sections’ marks for this exam will be removed.`}
            >
              <input type="hidden" name="examTermId" value={exam.id} />
              <input type="hidden" name="sectionId" value={section.id} />
              <Button type="submit" variant="danger">
                Delete exam
              </Button>
            </ConfirmForm>
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {assessments.map((assessment) => {
          const subject = assessment.subject;
          const meta = resolveSubjectMeta(subject);
          const enrolledIds = new Set(
            enrolledStudents
              .filter((student) => isStudentEnrolledInSubject(student, meta))
              .map((student) => student.id),
          );
          const enrolledCount = enrolledIds.size;
          const entered = assessment.marks.filter(
            (mark) =>
              enrolledIds.has(mark.studentId) &&
              (mark.isAbsent || mark.obtainedMarks != null),
          ).length;
          return (
              <div
                key={subject.id}
                className="chart-card rounded-[1.15rem] border border-[rgba(15,40,70,0.08)] bg-white p-5"
              >
                <h3 className="font-display text-xl font-semibold text-ink">{subject.name}</h3>
                <p className="mt-2 text-sm text-muted">
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
                    href={`/org-admin/students/print/${section.id}?subject=${encodeURIComponent(subject.name)}&exam=${encodeURIComponent(exam.name)}&session=${encodeURIComponent(exam.session)}&totalMarks=${encodeURIComponent(String(Number(assessment.totalMarks)))}&title=${encodeURIComponent("Award List")}&subjectId=${subject.id}`}
                  >
                    <Button size="sm" variant="outline">Print list</Button>
                  </Link>
                  <Link
                    href={`/org-admin/results/sections/${section.id}/exams/${exam.id}/subjects/${subject.id}`}
                  >
                    <Button size="sm">Add marks</Button>
                  </Link>
                  <ConfirmForm
                    action={deleteSubjectAssessment}
                    message={`Remove ${subject.name} from this result and clear its marks?`}
                  >
                    <input type="hidden" name="assessmentId" value={assessment.id} />
                    <Button type="submit" size="sm" variant="danger">
                      Remove subject
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
