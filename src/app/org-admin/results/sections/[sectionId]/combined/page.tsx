import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";
import { compileMultiRoundSectionResult, shortRoundLabel, sortByRoll } from "@/lib/results";
import { withChosenElectives } from "@/lib/subject-stream";
import { CombinedGazetteView } from "./combined-gazette-view";

export default async function CombinedResultsPage({
  params,
  searchParams,
}: {
  params: Promise<{ sectionId: string }>;
  searchParams: Promise<{ exams?: string }>;
}) {
  const session = await requireRole(["ORG_ADMIN"]);
  const organizationId = session.user.organizationId;
  const { sectionId } = await params;
  const query = await searchParams;
  if (!organizationId) notFound();

  const requestedIds = [
    ...new Set(
      String(query.exams ?? "")
        .split(",")
        .map((id) => id.trim())
        .filter(Boolean),
    ),
  ];
  if (requestedIds.length === 0) notFound();

  const [section, exams] = await Promise.all([
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
    prisma.examTerm.findMany({
      where: { id: { in: requestedIds }, organizationId },
      orderBy: [{ session: "asc" }, { examDate: "asc" }, { createdAt: "asc" }],
      select: {
        id: true,
        name: true,
        session: true,
        passPercent: true,
        examDate: true,
      },
    }),
  ]);
  if (!section || exams.length !== requestedIds.length) notFound();

  const selectedIds = exams.map((exam) => exam.id);
  const [students, assessments] = await Promise.all([
    prisma.student.findMany({
      where: { organizationId, sectionId: section.id, isActive: true },
      select: {
        id: true,
        rollNumber: true,
        name: true,
        fatherName: true,
        phone: true,
        stream: true,
        electiveSubjectId: true,
        electiveChoices: { select: { subjectId: true } },
      },
    }),
    prisma.subjectAssessment.findMany({
      where: {
        organizationId,
        sectionId: section.id,
        examTermId: { in: selectedIds },
        marks: {
          some: {
            OR: [{ obtainedMarks: { not: null } }, { isAbsent: true }],
          },
        },
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
    }),
  ]);

  const byExam = new Map<string, typeof assessments>();
  for (const assessment of assessments) {
    const rows = byExam.get(assessment.examTermId) ?? [];
    rows.push(assessment);
    byExam.set(assessment.examTermId, rows);
  }

  const passPercent = Math.max(...exams.map((exam) => exam.passPercent));
  const roundLabels = exams.map((exam, index) => shortRoundLabel(exam.name, index));
  const { columns, rows } = compileMultiRoundSectionResult({
    passPercent,
    students: students
      .map((student) => withChosenElectives(student))
      .sort((a, b) => sortByRoll(a.rollNumber, b.rollNumber)),
    rounds: exams.map((exam, index) => ({
      id: exam.id,
      label: roundLabels[index]!,
      assessments: (byExam.get(exam.id) ?? []).map((assessment) => ({
        subjectId: assessment.subjectId,
        subject: assessment.subject,
        totalMarks: Number(assessment.totalMarks),
        marks: assessment.marks.map((mark) => ({
          studentId: mark.studentId,
          obtainedMarks:
            mark.obtainedMarks == null ? null : Number(mark.obtainedMarks),
          isAbsent: mark.isAbsent,
        })),
      })),
    })),
  });

  const sessions = [...new Set(exams.map((exam) => exam.session))].join(" / ");

  return (
    <CombinedGazetteView
      organization={section.organization}
      boardName={section.class.board.name}
      className={section.class.name}
      sectionName={section.name}
      session={sessions}
      roundLabels={roundLabels}
      columns={columns}
      rows={rows}
      backHref={`/org-admin/results/sections/${section.id}`}
      phoneByStudentId={Object.fromEntries(
        students.map((student) => [student.id, student.phone]),
      )}
    />
  );
}
