import Link from "next/link";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { PageHeader, PageStack } from "@/components/page-header";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";
import { sortByRoll } from "@/lib/results";
import {
  isStudentEnrolledInSubject,
  resolveSubjectMeta,
  withChosenElectives,
} from "@/lib/subject-stream";
import { getOrCreateSubjectAssessment } from "@/app/org-admin/results/actions";
import { MarksEntry } from "./marks-entry";

export default async function SubjectMarksPage({
  params,
}: {
  params: Promise<{ sectionId: string; examId: string; subjectId: string }>;
}) {
  const session = await requireRole(["ORG_ADMIN"]);
  const organizationId = session.user.organizationId;
  const { sectionId, examId, subjectId } = await params;
  if (!organizationId) notFound();

  const [section, exam, subject] = await Promise.all([
    prisma.section.findFirst({
      where: { id: sectionId, organizationId },
      select: {
        id: true,
        name: true,
        class: { select: { id: true, name: true } },
      },
    }),
    prisma.examTerm.findFirst({ where: { id: examId, organizationId } }),
    prisma.subject.findFirst({
      where: { id: subjectId },
      select: {
        id: true,
        name: true,
        classId: true,
        track: true,
        electiveGroup: true,
      },
    }),
  ]);
  if (!section || !exam || !subject || subject.classId !== section.class.id) notFound();

  const subjectMeta = resolveSubjectMeta(subject);
  const assessmentId = await getOrCreateSubjectAssessment({
    examTermId: exam.id,
    sectionId: section.id,
    subjectId: subject.id,
  });

  const [assessment, students] = await Promise.all([
    prisma.subjectAssessment.findFirst({
      where: { id: assessmentId, organizationId },
      include: {
        sheets: { orderBy: { createdAt: "desc" } },
        marks: true,
      },
    }),
    prisma.student.findMany({
      where: { organizationId, sectionId: section.id, isActive: true },
      select: {
        id: true,
        rollNumber: true,
        name: true,
        fatherName: true,
        stream: true,
        electiveSubjectId: true,
        electiveChoices: { select: { subjectId: true } },
      },
    }),
  ]);
  if (!assessment) notFound();

  const enrolled = students
    .map((student) => withChosenElectives(student))
    .filter((student) => isStudentEnrolledInSubject(student, subjectMeta));
  const markByStudent = new Map(
    assessment.marks.map((mark) => [mark.studentId, mark]),
  );
  const rows = [...enrolled]
    .sort((a, b) => sortByRoll(a.rollNumber, b.rollNumber))
    .map((student) => {
      const mark = markByStudent.get(student.id);
      return {
        id: student.id,
        rollNumber: student.rollNumber,
        name: student.name,
        fatherName: student.fatherName,
        obtained: mark?.obtainedMarks != null ? String(Number(mark.obtainedMarks)) : "",
        absent: mark?.isAbsent ?? false,
      };
    });

  return (
    <PageStack wide>
      <PageHeader
        kicker={`${section.class.name} · ${section.name} · ${exam.name}`}
        title={subject.name}
        description={
          subjectMeta.electiveGroup
            ? `Only students who chose ${subject.name} as elective appear here.`
            : subjectMeta.track === "SCIENCE"
              ? "Only Science-group students appear here."
              : subjectMeta.track === "ARTS"
                ? "Only Arts-group students appear here."
                : "Upload the filled award-list photo, or type obtained marks for each enrolled student."
        }
        actions={
          <div className="flex flex-wrap gap-2">
            <Link href={`/org-admin/results/sections/${section.id}/exams/${exam.id}`}>
              <Button variant="secondary">All subjects</Button>
            </Link>
            <Link
              href={`/org-admin/students/print/${section.id}?subject=${encodeURIComponent(subject.name)}&exam=${encodeURIComponent(exam.name)}&session=${encodeURIComponent(exam.session)}&totalMarks=${encodeURIComponent(String(Number(assessment.totalMarks)))}&title=${encodeURIComponent("Award List")}&subjectId=${subject.id}`}
            >
              <Button variant="outline">Print list</Button>
            </Link>
          </div>
        }
      />
      {rows.length === 0 ? (
        <div className="rounded-[1.1rem] border border-[rgba(15,40,70,0.08)] bg-white p-6 text-sm text-muted">
          No enrolled students for this subject yet. Assign Science/Arts and Biology/Computer when adding students.
        </div>
      ) : (
        <MarksEntry
          assessmentId={assessment.id}
          totalMarks={String(Number(assessment.totalMarks))}
          students={rows}
          sheets={assessment.sheets.map((sheet) => ({
            id: sheet.id,
            imagePath: sheet.imagePath,
            originalName: sheet.originalName,
          }))}
        />
      )}
    </PageStack>
  );
}
