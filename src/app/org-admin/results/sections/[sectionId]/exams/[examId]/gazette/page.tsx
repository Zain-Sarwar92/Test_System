import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";
import { compileSectionResult, sortByRoll } from "@/lib/results";
import {
  isStudentEnrolledInSubject,
  resolveSubjectMeta,
  withChosenElectives,
} from "@/lib/subject-stream";
import { GazetteView } from "./gazette-view";

export default async function SectionGazettePage({
  params,
  searchParams,
}: {
  params: Promise<{ sectionId: string; examId: string }>;
  searchParams: Promise<{ stream?: string }>;
}) {
  const session = await requireRole(["ORG_ADMIN"]);
  const organizationId = session.user.organizationId;
  const { sectionId, examId } = await params;
  const requestedStream = (await searchParams).stream;
  const stream = requestedStream === "ARTS" ? "ARTS" : "SCIENCE";
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
          select: {
            id: true,
            name: true,
            board: { select: { name: true } },
          },
        },
      },
    }),
    prisma.examTerm.findFirst({ where: { id: examId, organizationId } }),
  ]);
  if (!section || !exam) notFound();

  const assessmentCount = await prisma.subjectAssessment.count({
    where: { organizationId, examTermId: exam.id, sectionId: section.id },
  });
  if (assessmentCount === 0) {
    redirect(
      `/org-admin/results/sections/${section.id}/exams/${exam.id}/select-subjects`,
    );
  }

  const [students, assessments] = await Promise.all([
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
    prisma.subjectAssessment.findMany({
      where: {
        organizationId,
        examTermId: exam.id,
        sectionId: section.id,
      },
      include: {
        marks: true,
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
    }),
  ]);

  if (assessments.length === 0) {
    redirect(
      `/org-admin/results/sections/${section.id}/exams/${exam.id}/select-subjects`,
    );
  }

  const streamStudents = students
    .filter((student) => student.stream === stream)
    .map((student) => withChosenElectives(student))
    .sort((a, b) => sortByRoll(a.rollNumber, b.rollNumber));

  const markedAssessments = assessments.filter((assessment) =>
    assessment.marks.some(
      (mark) => mark.isAbsent || mark.obtainedMarks != null,
    ),
  );

  const subjects = markedAssessments
    .map((assessment) =>
      resolveSubjectMeta({
        id: assessment.subject.id,
        name: assessment.subject.name,
        track: assessment.subject.track,
        electiveGroup: assessment.subject.electiveGroup,
        totalMarks: Number(assessment.totalMarks),
      }),
    )
    .filter((subject) =>
      streamStudents.some((student) =>
        isStudentEnrolledInSubject(student, subject),
      ),
    );
  const marks = markedAssessments.flatMap((assessment) =>
    assessment.marks.map((mark) => ({
      studentId: mark.studentId,
      subjectId: assessment.subjectId,
      obtainedMarks: mark.obtainedMarks == null ? null : Number(mark.obtainedMarks),
      isAbsent: mark.isAbsent,
    })),
  );
  const { columns, rows } = compileSectionResult({
    passPercent: exam.passPercent,
    students: streamStudents,
    subjects,
    marks,
  });

  return (
    <GazetteView
      organization={section.organization}
      boardName={section.class.board.name}
      className={section.class.name}
      sectionName={section.name}
      examName={exam.name}
      session={exam.session}
      passPercent={exam.passPercent}
      examDate={
        exam.examDate
          ? exam.examDate.toLocaleDateString("en-GB", {
              day: "2-digit",
              month: "short",
              year: "numeric",
            })
          : null
      }
      columns={columns}
      rows={rows}
      backHref={`/org-admin/results/sections/${section.id}/exams/${exam.id}`}
      subtitle={`${stream === "SCIENCE" ? "Science" : "Arts"} Group`}
    />
  );
}
