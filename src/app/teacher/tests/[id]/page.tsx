import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireRole, requireActiveOrganizationId } from "@/lib/rbac";
import { parseAttemptCountFromInstructions } from "@/lib/paper-marks";
import { SavedPaperPreview } from "./saved-paper-preview";

export default async function TeacherSavedPaperPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireRole(["TEACHER"]);
  const { id } = await params;
  const organizationId = await requireActiveOrganizationId(session.user.id);

  const test = await prisma.test.findFirst({
    where: {
      id,
      teacherId: session.user.id,
      organizationId,
    },
    include: {
      organization: {
        select: {
          name: true,
          logoUrl: true,
          address: true,
          phone: true,
        },
      },
      subject: {
        select: {
          id: true,
          name: true,
          class: {
            select: {
              name: true,
              board: { select: { name: true } },
            },
          },
        },
      },
      questions: {
        orderBy: { order: "asc" },
        include: {
          question: {
            include: {
              topic: {
                select: {
                  id: true,
                  name: true,
                  chapterId: true,
                  chapter: { select: { id: true, name: true } },
                },
              },
            },
          },
        },
      },
    },
  });

  if (!test) notFound();

  const chaptersRaw = test.subjectId
    ? await prisma.chapter.findMany({
        where: { subjectId: test.subjectId },
        orderBy: [{ order: "asc" }, { name: "asc" }],
        select: {
          id: true,
          name: true,
          topics: {
            orderBy: [{ order: "asc" }, { name: "asc" }],
            select: { id: true, name: true },
          },
        },
      })
    : [];

  const topicIds = chaptersRaw.flatMap((c) => c.topics.map((t) => t.id));
  const questionCounts =
    topicIds.length > 0
      ? await prisma.question.groupBy({
          by: ["topicId", "type"],
          where: { isActive: true, topicId: { in: topicIds } },
          _count: { _all: true },
        })
      : [];

  const countsByTopic = new Map<
    string,
    { MCQ: number; SHORT: number; LONG: number }
  >();
  for (const row of questionCounts) {
    const current = countsByTopic.get(row.topicId) ?? {
      MCQ: 0,
      SHORT: 0,
      LONG: 0,
    };
    current[row.type] = row._count._all;
    countsByTopic.set(row.topicId, current);
  }

  const chapters = chaptersRaw.map((chapter) => ({
    id: chapter.id,
    name: chapter.name,
    topics: chapter.topics.map((topic) => {
      const countsByType = countsByTopic.get(topic.id) ?? {
        MCQ: 0,
        SHORT: 0,
        LONG: 0,
      };
      return {
        id: topic.id,
        name: topic.name,
        countsByType,
      };
    }),
  }));

  const grouped = new Map<string, typeof test.questions>();
  for (const row of test.questions) {
    const type = row.question.type;
    const list = grouped.get(type) ?? [];
    list.push(row);
    grouped.set(type, list);
  }

  const order = ["MCQ", "SHORT", "LONG"] as const;
  const titles = {
    MCQ: "Multiple Choice Questions",
    SHORT: "Short Questions",
    LONG: "Long Questions",
  };

  const sections = order
    .filter((t) => grouped.has(t))
    .map((type) => {
      const rows = grouped.get(type)!;
      const marksEach = rows[0]?.marks ?? 1;
      return {
        type,
        title: titles[type],
        marksEach,
        attemptCount: parseAttemptCountFromInstructions(
          test.instructions,
          type,
        ),
        questions: rows.map((r) => ({
          id: r.question.id,
          type: r.question.type as "MCQ" | "SHORT" | "LONG",
          text: r.textOverride ?? r.question.text,
          textUrdu: r.textUrduOverride ?? r.question.textUrdu,
          marks: r.marks,
          source: r.question.source,
          optionA: r.optionAOverride ?? r.question.optionA,
          optionB: r.optionBOverride ?? r.question.optionB,
          optionC: r.optionCOverride ?? r.question.optionC,
          optionD: r.optionDOverride ?? r.question.optionD,
          correctAnswer: r.question.correctAnswer,
          topicId: r.question.topic.id,
          topicName: r.question.topic.name,
          chapterId: r.question.topic.chapterId,
          chapterName: r.question.topic.chapter.name,
        })),
      };
    });

  return (
    <SavedPaperPreview
      testId={test.id}
      boardName={test.subject?.class?.board?.name}
      className={test.subject?.class?.name}
      subjectName={test.subject?.name}
      chapters={chapters}
      meta={{
        title: test.title,
        boardName: test.subject?.class?.board?.name,
        className: test.subject?.class?.name,
        subjectName: test.subject?.name,
        classSection: test.classSection,
        examDate: test.examDate?.toISOString() ?? null,
        durationMinutes: test.durationMinutes,
        totalMarks: test.totalMarks,
        preparedBy: test.preparedBy ?? session.user.name,
        instructions: test.instructions,
        paperCode: test.paperCode,
        examLabel: test.examLabel,
        syllabusNote: test.syllabusNote,
        organization: test.organization,
      }}
      initialSections={sections}
    />
  );
}
