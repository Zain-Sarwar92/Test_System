import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";
import { compileCombinedSectionResult, sortByRoll } from "@/lib/results";
import { withChosenElectives } from "@/lib/subject-stream";
import { GazetteView } from "../../../exams/[examId]/gazette/gazette-view";

export default async function CombinedSeriesGazettePage({
  params,
  searchParams,
}: {
  params: Promise<{ sectionId: string; seriesId: string }>;
  searchParams: Promise<{ rounds?: string }>;
}) {
  const session = await requireRole(["ORG_ADMIN"]);
  const organizationId = session.user.organizationId;
  const { sectionId, seriesId } = await params;
  const query = await searchParams;
  if (!organizationId) notFound();

  const roundIds = String(query.rounds ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
  if (roundIds.length === 0) notFound();

  const [section, series] = await Promise.all([
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
    prisma.resultSeries.findFirst({
      where: { id: seriesId, organizationId },
      select: {
        id: true,
        name: true,
        session: true,
        passPercent: true,
        rounds: {
          where: { id: { in: roundIds } },
          orderBy: { roundOrder: "asc" },
          select: {
            id: true,
            name: true,
            roundOrder: true,
            examDate: true,
          },
        },
      },
    }),
  ]);
  if (!section || !series || series.rounds.length === 0) notFound();

  const selectedRoundIds = series.rounds.map((round) => round.id);

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
        sectionId: section.id,
        examTermId: { in: selectedRoundIds },
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

  const assessmentsByRound = new Map<string, typeof assessments>();
  for (const assessment of assessments) {
    const list = assessmentsByRound.get(assessment.examTermId) ?? [];
    list.push(assessment);
    assessmentsByRound.set(assessment.examTermId, list);
  }

  const { columns, rows } = compileCombinedSectionResult({
    passPercent: series.passPercent,
    students: students
      .map((student) => withChosenElectives(student))
      .sort((a, b) => sortByRoll(a.rollNumber, b.rollNumber)),
    rounds: series.rounds.map((round) => ({
      assessments: (assessmentsByRound.get(round.id) ?? []).map((assessment) => ({
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

  const roundLabel = series.rounds
    .map((round) => `R${round.roundOrder ?? "?"}`)
    .join(" + ");
  const dates = series.rounds
    .map((round) => round.examDate)
    .filter((date): date is Date => Boolean(date));
  const examDate =
    dates.length === 0
      ? null
      : dates
          .sort((a, b) => a.getTime() - b.getTime())
          .map((date) =>
            date.toLocaleDateString("en-GB", {
              day: "2-digit",
              month: "short",
              year: "numeric",
            }),
          )
          .join(" – ");

  return (
    <GazetteView
      organization={section.organization}
      boardName={section.class.board.name}
      className={section.class.name}
      sectionName={section.name}
      examName={`${series.name} (Combined)`}
      session={series.session}
      columns={columns}
      rows={rows}
      backHref={`/org-admin/results/sections/${section.id}/series/${series.id}`}
      subtitle={`Combined: ${roundLabel}`}
    />
  );
}
