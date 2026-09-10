import { prisma } from "@/lib/prisma";
import {
  compileMultiRoundSectionResult,
  shortRoundLabel,
  sortByRoll,
  type MultiRoundColumn,
  type MultiRoundStudentRow,
} from "@/lib/results";
import { withChosenElectives } from "@/lib/subject-stream";

export type CombinedSectionResultBundle = {
  section: {
    id: string;
    name: string;
    organization: {
      name: string;
      logoUrl: string | null;
      address: string | null;
      phone: string | null;
    };
    class: {
      id: string;
      name: string;
      board: { name: string };
    };
  };
  exams: Array<{
    id: string;
    name: string;
    session: string;
    passPercent: number;
    examDate: Date | null;
  }>;
  examIds: string[];
  roundLabels: string[];
  passPercent: number;
  sessionLabel: string;
  columns: MultiRoundColumn[];
  rows: MultiRoundStudentRow[];
  phoneByStudentId: Record<string, string | null | undefined>;
};

export function parseExamIds(raw: string | undefined | null) {
  return [
    ...new Set(
      String(raw ?? "")
        .split(",")
        .map((id) => id.trim())
        .filter(Boolean),
    ),
  ];
}

export async function loadCombinedSectionResult(input: {
  organizationId: string;
  sectionId: string;
  examIds: string[];
}): Promise<CombinedSectionResultBundle | null> {
  if (input.examIds.length === 0) return null;

  const [section, exams] = await Promise.all([
    prisma.section.findFirst({
      where: { id: input.sectionId, organizationId: input.organizationId },
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
      where: { id: { in: input.examIds }, organizationId: input.organizationId },
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

  if (!section || exams.length !== input.examIds.length) return null;

  const selectedIds = exams.map((exam) => exam.id);
  const [students, assessments] = await Promise.all([
    prisma.student.findMany({
      where: {
        organizationId: input.organizationId,
        sectionId: section.id,
        isActive: true,
      },
      select: {
        id: true,
        rollNumber: true,
        name: true,
        fatherName: true,
        phone: true,
        stream: true,
        studyGroup: true,
        electiveSubjectId: true,
        electiveChoices: { select: { subjectId: true } },
      },
    }),
    prisma.subjectAssessment.findMany({
      where: {
        organizationId: input.organizationId,
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
  const roundLabels = exams.map((exam, index) =>
    shortRoundLabel(exam.name, index),
  );
  const { columns, rows } = compileMultiRoundSectionResult({
    passPercent,
    className: section.class.name,
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

  return {
    section,
    exams,
    examIds: selectedIds,
    roundLabels,
    passPercent,
    sessionLabel: [...new Set(exams.map((exam) => exam.session))].join(" / "),
    columns,
    rows,
    phoneByStudentId: Object.fromEntries(
      students.map((student) => [student.id, student.phone]),
    ),
  };
}
