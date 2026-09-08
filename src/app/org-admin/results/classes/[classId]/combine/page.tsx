import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";
import {
  appendManualGazetteRows,
  compileSectionResult,
  sortByRoll,
} from "@/lib/results";
import {
  isStudentEnrolledInSubject,
  resolveSubjectMeta,
  withChosenElectives,
} from "@/lib/subject-stream";
import { GazetteView } from "@/app/org-admin/results/sections/[sectionId]/exams/[examId]/gazette/gazette-view";

type Props = {
  params: Promise<{ classId: string }>;
  searchParams: Promise<{
    sections?: string;
    examId?: string;
    stream?: string;
  }>;
};

export default async function ClassCombineGazettePage({
  params,
  searchParams,
}: Props) {
  const session = await requireRole(["ORG_ADMIN"]);
  const organizationId = session.user.organizationId;
  if (!organizationId) notFound();

  const { classId } = await params;
  const filters = await searchParams;
  const stream = filters.stream === "ARTS" ? "ARTS" : "SCIENCE";
  const examId = filters.examId?.trim() ?? "";
  const sectionIds = (filters.sections ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);

  if (!examId || sectionIds.length < 2) {
    redirect(`/org-admin/results/classes/${classId}`);
  }

  const [klass, exam, sections] = await Promise.all([
    prisma.class.findFirst({
      where: { id: classId, sections: { some: { organizationId } } },
      select: {
        id: true,
        name: true,
        board: { select: { name: true } },
      },
    }),
    prisma.examTerm.findFirst({
      where: { id: examId, organizationId },
      select: {
        id: true,
        name: true,
        session: true,
        passPercent: true,
      },
    }),
    prisma.section.findMany({
      where: {
        organizationId,
        classId,
        id: { in: sectionIds },
      },
      select: {
        id: true,
        name: true,
        organization: {
          select: { name: true, logoUrl: true, address: true, phone: true },
        },
      },
      orderBy: { name: "asc" },
    }),
  ]);

  if (!klass || !exam || sections.length < 2) {
    redirect(`/org-admin/results/classes/${classId}`);
  }

  const sectionIdSet = new Set(sections.map((s) => s.id));
  const orgInfo = sections[0]!.organization;

  const [students, assessments] = await Promise.all([
    prisma.student.findMany({
      where: {
        organizationId,
        sectionId: { in: [...sectionIdSet] },
        isActive: true,
        stream,
      },
      select: {
        id: true,
        rollNumber: true,
        name: true,
        fatherName: true,
        stream: true,
        studyGroup: true,
        electiveSubjectId: true,
        sectionId: true,
        section: { select: { name: true } },
        electiveChoices: { select: { subjectId: true } },
      },
    }),
    prisma.subjectAssessment.findMany({
      where: {
        organizationId,
        examTermId: exam.id,
        sectionId: { in: [...sectionIdSet] },
      },
      include: {
        marks: true,
        manualMarks: true,
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

  const streamStudents = students
    .map((student) => ({
      ...withChosenElectives(student),
      // Disambiguate rolls across sections on the combined sheet.
      rollNumber: `${student.section.name}-${student.rollNumber}`,
    }))
    .sort((a, b) => sortByRoll(a.rollNumber, b.rollNumber));

  const markedAssessments = assessments.filter(
    (assessment) =>
      assessment.marks.some(
        (mark) => mark.isAbsent || mark.obtainedMarks != null,
      ) ||
      assessment.manualMarks.some(
        (mark) => mark.isAbsent || mark.obtainedMarks != null,
      ),
  );

  // Merge subject totals across sections (same subject id → max total).
  const subjectTotals = new Map<string, number>();
  for (const assessment of markedAssessments) {
    const total = Number(assessment.totalMarks);
    const prev = subjectTotals.get(assessment.subject.id) ?? 0;
    subjectTotals.set(assessment.subject.id, Math.max(prev, total));
  }

  const subjects = [...subjectTotals.entries()]
    .map(([subjectId, totalMarks]) => {
      const sample = markedAssessments.find((a) => a.subject.id === subjectId)!;
      return resolveSubjectMeta({
        id: sample.subject.id,
        name: sample.subject.name,
        track: sample.subject.track,
        electiveGroup: sample.subject.electiveGroup,
        totalMarks,
      });
    })
    .filter((subject) =>
      streamStudents.some((student) => isStudentEnrolledInSubject(student, subject)),
    )
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));

  const marks = markedAssessments.flatMap((assessment) =>
    assessment.marks.map((mark) => ({
      studentId: mark.studentId,
      subjectId: assessment.subjectId,
      obtainedMarks: mark.obtainedMarks == null ? null : Number(mark.obtainedMarks),
      isAbsent: mark.isAbsent,
    })),
  );

  const { columns, rows } = compileSectionResult({
    passPercent: Number(exam.passPercent),
    className: klass.name,
    students: streamStudents,
    subjects,
    marks,
  });

  const rowsWithManual = appendManualGazetteRows({
    columns,
    rows,
    subjects,
    manualMarks: markedAssessments.flatMap((assessment) =>
      assessment.manualMarks.map((mark) => ({
        id: `${assessment.sectionId}:${mark.id}`,
        subjectId: assessment.subjectId,
        rollNumber: mark.rollNumber,
        name: mark.name,
        fatherName: mark.fatherName,
        obtainedMarks: mark.obtainedMarks == null ? null : Number(mark.obtainedMarks),
        isAbsent: mark.isAbsent,
      })),
    ),
  });

  const sectionLabel = sections.map((s) => s.name).join(" + ");

  return (
    <GazetteView
      organization={orgInfo}
      boardName={klass.board.name}
      className={klass.name}
      sectionName={sectionLabel}
      examName={exam.name}
      session={exam.session}
      columns={columns}
      rows={rowsWithManual}
      backHref={`/org-admin/results/classes/${classId}`}
      subtitle={`${stream === "SCIENCE" ? "Science" : "Arts"} · Class-wide positions`}
      combined
    />
  );
}
