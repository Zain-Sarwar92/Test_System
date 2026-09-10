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
  deleteSectionExamResult,
  deleteSubjectAssessment,
  prepareExamSectionSubjects,
} from "../../../../actions";
import { ConfirmForm } from "../../../../confirm-form";
import { ResultsBackLink } from "@/app/org-admin/results/results-back-link";
import { AddExamSubjectForm } from "@/app/org-admin/results/add-exam-subject-form";

export default async function SectionExamSubjectsPage({
  params,
}: {
  params: Promise<{ sectionId: string; examId: string }>;
}) {
  const session = await requireRole(["ORG_ADMIN"]);
  const organizationId = session.user.organizationId;
  const { sectionId, examId } = await params;
  if (!organizationId) notFound();

  await prepareExamSectionSubjects({ sectionId, examTermId: examId });

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
            subjects: {
              orderBy: { name: "asc" },
              select: {
                id: true,
                name: true,
                track: true,
                electiveGroup: true,
              },
            },
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

  const selectedIds = new Set(assessments.map((row) => row.subjectId));
  const availableSubjects = section.class.subjects
    .filter((subject) => !selectedIds.has(subject.id))
    .map((subject) => {
      const meta = resolveSubjectMeta(subject);
      return {
        id: subject.id,
        name: subject.name,
        track: meta.track,
        electiveGroup: meta.electiveGroup,
      };
    });

  const students = await prisma.student.findMany({
    where: { organizationId, sectionId: section.id, isActive: true },
    select: {
      id: true,
      stream: true,
      studyGroup: true,
      electiveSubjectId: true,
      electiveChoices: { select: { subjectId: true } },
    },
  });
  const enrolledStudents = students.map((student) =>
    withChosenElectives(student),
  );

  const subjectRows = assessments.map((assessment) => {
    const meta = resolveSubjectMeta(assessment.subject);
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
    return {
      assessment,
      enrolledCount,
      entered,
      ready: entered > 0,
    };
  });

  const readyCount = subjectRows.filter((row) => row.ready).length;
  const examsListHref = `/org-admin/results/sections/${section.id}`;
  const subjectsHref = `/org-admin/results/sections/${section.id}/exams/${exam.id}`;

  return (
    <PageStack wide>
      <PageHeader
        kicker={`${section.class.name} · ${section.name} · Session ${exam.session}`}
        title={exam.name}
        actions={<ResultsBackLink href={examsListHref} />}
      />

      <Card>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>Result actions</CardTitle>
            <CardDescription className="mt-1">
              {readyCount}/{assessments.length} subjects with marks ·{" "}
              {section._count.students} students
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            {readyCount > 0 ? (
              <>
                <Link
                  href={`/org-admin/results/sections/${section.id}/exams/${exam.id}/gazette?stream=SCIENCE`}
                >
                  <Button>Generate Result</Button>
                </Link>
                <Link
                  href={`/org-admin/results/sections/${section.id}/exams/${exam.id}/report-cards`}
                >
                  <Button variant="secondary">Report cards</Button>
                </Link>
              </>
            ) : (
              <Button disabled title="Enter marks in at least one subject first">
                Generate Result
              </Button>
            )}
            <ConfirmForm
              action={deleteSectionExamResult}
              message={`Delete result for ${section.name} in "${exam.name}"? All marks for this section will be cleared.`}
            >
              <input type="hidden" name="sectionId" value={section.id} />
              <input type="hidden" name="examTermId" value={exam.id} />
              <Button type="submit" variant="danger">
                Delete
              </Button>
            </ConfirmForm>
          </div>
        </div>
      </Card>

      {availableSubjects.length > 0 ? (
        <Card>
          <CardTitle>Add subject</CardTitle>
          <CardDescription className="mb-3">
            Optional — add Arts or any other class subject to this result.
          </CardDescription>
          <AddExamSubjectForm
            sectionId={section.id}
            examId={exam.id}
            availableSubjects={availableSubjects}
          />
        </Card>
      ) : null}

      <div>
        <h3 className="mb-3 font-display text-lg font-semibold text-ink">
          Subjects
        </h3>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {subjectRows.map(({ assessment, enrolledCount, entered, ready }) => {
            const subject = assessment.subject;
            const printBack = encodeURIComponent(subjectsHref);
            const printBase = `/org-admin/students/print/${section.id}?subject=${encodeURIComponent(subject.name)}&exam=${encodeURIComponent(exam.name)}&session=${encodeURIComponent(exam.session)}&totalMarks=${encodeURIComponent(String(Number(assessment.totalMarks)))}&title=${encodeURIComponent("Award List")}&subjectId=${subject.id}&back=${printBack}`;
            return (
              <div
                key={subject.id}
                className="flex flex-col rounded-[1.15rem] border border-line bg-card p-4 shadow-[var(--shadow-soft)]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h4 className="truncate font-display text-lg font-semibold text-ink">
                      {subject.name}
                    </h4>
                    <p className="mt-1 text-sm text-muted">
                      {entered}/{enrolledCount} marks · Total{" "}
                      {Number(assessment.totalMarks)}
                      {assessment._count.sheets
                        ? ` · ${assessment._count.sheets} sheet${assessment._count.sheets === 1 ? "" : "s"}`
                        : ""}
                    </p>
                  </div>
                  <span
                    className={
                      ready
                        ? "status-chip status-chip-success"
                        : "status-chip status-chip-muted"
                    }
                  >
                    {ready ? "Ready" : "Pending"}
                  </span>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <Link
                    href={`/org-admin/results/sections/${section.id}/exams/${exam.id}/subjects/${subject.id}`}
                  >
                    <Button size="sm">
                      {entered > 0 ? "Edit marks" : "Add marks"}
                    </Button>
                  </Link>
                  {entered > 0 ? (
                    <Link
                      href={`${printBase}&assessmentId=${assessment.id}&withMarks=1`}
                    >
                      <Button size="sm" variant="outline">
                        Print list
                      </Button>
                    </Link>
                  ) : null}
                  <ConfirmForm
                    action={deleteSubjectAssessment}
                    message={`Remove ${subject.name} from this result and clear its marks?`}
                  >
                    <input
                      type="hidden"
                      name="assessmentId"
                      value={assessment.id}
                    />
                    <Button type="submit" size="sm" variant="danger">
                      Remove
                    </Button>
                  </ConfirmForm>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </PageStack>
  );
}
