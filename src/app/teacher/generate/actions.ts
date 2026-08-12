"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole, requireActiveOrganizationId } from "@/lib/rbac";
import {
  selectByChapterQuotas,
  selectQuestions,
  type DistributionMode,
} from "@/lib/distribution/engine";
import {
  assertCanCreateFromAssignment,
  coverSiblingAssignmentsForSections,
  ScheduleAccessError,
} from "@/lib/test-schedules";
import { assertTeacherAssignedToSubject } from "@/lib/teacher-assignment-scope";
import {
  ENGLISH_FIELD_VALUES,
  type EnglishFieldFilter,
} from "./english-fields";

export type PoolQuestionCard = {
  id: string;
  type: "MCQ" | "SHORT" | "LONG";
  text: string;
  textUrdu: string | null;
  marks: number;
  source: string | null;
  optionA: string | null;
  optionB: string | null;
  optionC: string | null;
  optionD: string | null;
  correctAnswer: string | null;
  topicId: string;
  topicName: string;
  chapterId: string;
  chapterName: string;
};

export type QuestionSourceFilter = "ALL" | "EXERCISE" | "ADDITIONAL";
export type QuestionMedium = "ENGLISH" | "URDU" | "BOTH";

async function requirePaperGeneratorWithOrg() {
  const session = await requireRole(["TEACHER", "ORG_ADMIN"]);
  const organizationId = await requireActiveOrganizationId(session.user.id);
  const role = (session.user as { role?: string }).role;
  const isOrgAdmin = role === "ORG_ADMIN";
  return {
    session,
    organizationId,
    teacherId: session.user.id,
    isOrgAdmin,
  };
}

function mapQuestion(q: {
  id: string;
  type: "MCQ" | "SHORT" | "LONG";
  text: string;
  textUrdu: string | null;
  marks: number;
  source: string | null;
  optionA: string | null;
  optionB: string | null;
  optionC: string | null;
  optionD: string | null;
  correctAnswer: string | null;
  topicId: string;
  topic: { name: string; chapterId: string; chapter: { name: string } };
}): PoolQuestionCard {
  return {
    id: q.id,
    type: q.type,
    text: q.text,
    textUrdu: q.textUrdu,
    marks: q.marks,
    source: q.source,
    optionA: q.optionA,
    optionB: q.optionB,
    optionC: q.optionC,
    optionD: q.optionD,
    correctAnswer: q.correctAnswer,
    topicId: q.topicId,
    topicName: q.topic.name,
    chapterId: q.topic.chapterId,
    chapterName: q.topic.chapter.name,
  };
}

const POOL_QUESTION_SELECT = {
  id: true,
  type: true,
  text: true,
  textUrdu: true,
  marks: true,
  source: true,
  optionA: true,
  optionB: true,
  optionC: true,
  optionD: true,
  correctAnswer: true,
  topicId: true,
  topic: {
    select: {
      name: true,
      chapterId: true,
      chapter: { select: { name: true } },
    },
  },
} as const;

function sourceWhere(source: QuestionSourceFilter) {
  if (source === "EXERCISE") {
    return { source: { contains: "Exercise" } };
  }
  if (source === "ADDITIONAL") {
    return { source: { contains: "Additional" } };
  }
  return {};
}

function englishFieldWhere(field: EnglishFieldFilter) {
  switch (field) {
    case "COMPREHENSION":
    case "ESSAYS":
      return { source: { contains: "Exercise" } };
    case "SPELLING":
      return { source: { contains: "spelling" } };
    case "MEANING":
      return { source: { contains: "meaning" } };
    case "VERB":
      return { source: { contains: "form of verb" } };
    case "GRAMMAR":
      return { source: { contains: "grammar" } };
    case "QA":
      return {
        OR: [
          { source: { contains: "Exercise" } },
          { source: { contains: "Additional" } },
        ],
      };
    case "DI":
      return {
        OR: [
          { source: { contains: "Past Papers" } },
          { source: { contains: "Direct & Indirect" } },
        ],
      };
    case "PAIR":
      return { source: { contains: "Pair of Words" } };
    case "SUMMARY":
      return { source: { contains: "Summary" } };
    case "TRANSLATE_UR":
      return { source: { contains: "Translate into Urdu" } };
    case "TRANSLATE_EN":
      return { source: { contains: "Translate into English" } };
    case "POEM_STANZA":
      return { source: { contains: "Poem Stanzas" } };
    default:
      return {};
  }
}

function poolSourceWhere(input: {
  source: QuestionSourceFilter;
  englishField: EnglishFieldFilter;
}) {
  if (input.englishField !== "ALL") {
    return englishFieldWhere(input.englishField);
  }
  return sourceWhere(input.source);
}

function mediumWhere(medium: QuestionMedium) {
  if (medium === "URDU") {
    return { textUrdu: { not: null } };
  }
  return {};
}

const poolSchema = z.object({
  topicIds: z.array(z.string().min(1)).min(1),
  type: z.enum(["MCQ", "SHORT", "LONG"]),
  chapterIds: z.array(z.string().min(1)).optional(),
  excludeIds: z.array(z.string().min(1)).optional(),
  source: z.enum(["ALL", "EXERCISE", "ADDITIONAL"]).default("ALL"),
  englishField: z.enum(ENGLISH_FIELD_VALUES).default("ALL"),
  medium: z.enum(["ENGLISH", "URDU", "BOTH"]).default("BOTH"),
});

export async function searchQuestionPool(input: {
  topicIds: string[];
  type: "MCQ" | "SHORT" | "LONG";
  chapterIds?: string[];
  excludeIds?: string[];
  source?: QuestionSourceFilter;
  englishField?: EnglishFieldFilter;
  medium?: QuestionMedium;
}): Promise<{ questions: PoolQuestionCard[]; total: number }> {
  await requirePaperGeneratorWithOrg();
  const parsed = poolSchema.parse(input);

  const where = {
    isActive: true,
    type: parsed.type,
    topicId: { in: parsed.topicIds },
    ...poolSourceWhere({
      source: parsed.source,
      englishField: parsed.englishField,
    }),
    ...mediumWhere(parsed.medium),
    ...(parsed.excludeIds?.length ? { id: { notIn: parsed.excludeIds } } : {}),
    ...(parsed.chapterIds?.length
      ? { topic: { chapterId: { in: parsed.chapterIds } } }
      : {}),
  };

  const [questions, total] = await Promise.all([
    prisma.question.findMany({
      where,
      select: POOL_QUESTION_SELECT,
      orderBy: [{ topic: { chapter: { order: "asc" } } }, { text: "asc" }],
      take: 5000,
    }),
    prisma.question.count({ where }),
  ]);

  return {
    questions: questions.map(mapQuestion),
    total,
  };
}

const randomSchema = poolSchema.extend({
  count: z.number().int().min(1).max(100),
  mode: z.enum(["BALANCED", "RANDOM"]).default("BALANCED"),
  chapterQuotas: z
    .array(
      z.object({
        chapterId: z.string().min(1),
        count: z.number().int().min(0).max(100),
      }),
    )
    .optional(),
});

const chapterPlanSchema = z.object({
  topicIds: z.array(z.string().min(1)).min(1),
  chapterRequests: z
    .array(
      z.object({
        chapterId: z.string().min(1),
        mcqCount: z.number().int().min(0).max(100),
        shortCount: z.number().int().min(0).max(100),
        longCount: z.number().int().min(0).max(100),
      }),
    )
    .min(1),
  excludeIds: z.array(z.string().min(1)).optional(),
  source: z.enum(["ALL", "EXERCISE", "ADDITIONAL"]).default("ALL"),
  englishField: z.enum(ENGLISH_FIELD_VALUES).default("ALL"),
  medium: z.enum(["ENGLISH", "URDU", "BOTH"]).default("BOTH"),
  mode: z.enum(["BALANCED", "RANDOM"]).default("BALANCED"),
});

export async function pickRandomQuestions(input: {
  topicIds: string[];
  type: "MCQ" | "SHORT" | "LONG";
  count: number;
  chapterIds?: string[];
  chapterQuotas?: Array<{ chapterId: string; count: number }>;
  excludeIds?: string[];
  mode?: DistributionMode;
  source?: QuestionSourceFilter;
  englishField?: EnglishFieldFilter;
  medium?: QuestionMedium;
}): Promise<{ questions: PoolQuestionCard[] }> {
  await requirePaperGeneratorWithOrg();
  const parsed = randomSchema.parse(input);

  const chapterIdsFromQuotas = (parsed.chapterQuotas ?? [])
    .filter((q) => q.count > 0)
    .map((q) => q.chapterId);
  const chapterIds =
    chapterIdsFromQuotas.length > 0
      ? chapterIdsFromQuotas
      : (parsed.chapterIds ?? []);

  const questions = await prisma.question.findMany({
    where: {
      isActive: true,
      type: parsed.type,
      topicId: { in: parsed.topicIds },
      ...poolSourceWhere({
        source: parsed.source,
        englishField: parsed.englishField,
      }),
      ...mediumWhere(parsed.medium),
      ...(parsed.excludeIds?.length ? { id: { notIn: parsed.excludeIds } } : {}),
      ...(chapterIds.length
        ? { topic: { chapterId: { in: chapterIds } } }
        : {}),
    },
    select: POOL_QUESTION_SELECT,
  });

  const pool = questions.map((q) => ({
    id: q.id,
    topicId: q.topicId,
    chapterId: q.topic.chapterId,
    type: q.type,
    marks: q.marks,
  }));

  const quotas = (parsed.chapterQuotas ?? []).filter((q) => q.count > 0);
  const picked =
    quotas.length > 0
      ? selectByChapterQuotas(pool, quotas, parsed.mode)
      : selectQuestions(pool, parsed.count, parsed.mode);

  if (quotas.length > 0) {
    const requested = quotas.reduce((sum, q) => sum + q.count, 0);
    if (picked.length !== requested) {
      throw new Error(
        `Could not pick all planned ${parsed.type} questions (${picked.length}/${requested})`,
      );
    }
  }

  const byId = new Map(questions.map((q) => [q.id, q]));
  const ordered = picked
    .map((p) => byId.get(p.id))
    .filter((q): q is NonNullable<typeof q> => Boolean(q))
    .map(mapQuestion);

  return { questions: ordered };
}

export async function generatePaperFromChapterPlan(input: {
  topicIds: string[];
  chapterRequests: Array<{
    chapterId: string;
    mcqCount: number;
    shortCount: number;
    longCount: number;
  }>;
  excludeIds?: string[];
  source?: QuestionSourceFilter;
  englishField?: EnglishFieldFilter;
  medium?: QuestionMedium;
  mode?: DistributionMode;
}): Promise<{
  sections: Array<{ type: "MCQ" | "SHORT" | "LONG"; questions: PoolQuestionCard[] }>;
}> {
  await requirePaperGeneratorWithOrg();
  const parsed = chapterPlanSchema.parse(input);

  const chapterIds = parsed.chapterRequests.map((item) => item.chapterId);
  const globalUsed = new Set(parsed.excludeIds ?? []);
  const sections: Array<{ type: "MCQ" | "SHORT" | "LONG"; questions: PoolQuestionCard[] }> = [];

  const typeConfigs = [
    { type: "MCQ" as const, key: "mcqCount" as const },
    { type: "SHORT" as const, key: "shortCount" as const },
    { type: "LONG" as const, key: "longCount" as const },
  ];

  for (const config of typeConfigs) {
    const quotas = parsed.chapterRequests
      .map((item) => ({
        chapterId: item.chapterId,
        count: item[config.key],
      }))
      .filter((item) => item.count > 0);

    if (quotas.length === 0) continue;

    const questions = await prisma.question.findMany({
      where: {
        isActive: true,
        type: config.type,
        topicId: { in: parsed.topicIds },
        ...poolSourceWhere({
          source: parsed.source,
          englishField: parsed.englishField,
        }),
        ...mediumWhere(parsed.medium),
        ...(globalUsed.size ? { id: { notIn: [...globalUsed] } } : {}),
        topic: { chapterId: { in: chapterIds } },
      },
      select: POOL_QUESTION_SELECT,
    });

    const availableByChapter = new Map<string, number>();
    for (const q of questions) {
      availableByChapter.set(
        q.topic.chapterId,
        (availableByChapter.get(q.topic.chapterId) ?? 0) + 1,
      );
    }

    for (const quota of quotas) {
      const available = availableByChapter.get(quota.chapterId) ?? 0;
      if (quota.count > available) {
        throw new Error(
          `Requested ${quota.count} ${config.type} questions from a chapter with only ${available} available`,
        );
      }
    }

    const pool = questions.map((q) => ({
      id: q.id,
      topicId: q.topicId,
      chapterId: q.topic.chapterId,
      type: q.type,
      marks: q.marks,
    }));

    const picked = selectByChapterQuotas(pool, quotas, parsed.mode);
    const requestedTotal = quotas.reduce((sum, item) => sum + item.count, 0);
    if (picked.length !== requestedTotal) {
      throw new Error(`Could not generate all requested ${config.type} questions`);
    }

    const byId = new Map(questions.map((q) => [q.id, q]));
    const ordered = picked
      .map((item) => byId.get(item.id))
      .filter((q): q is NonNullable<typeof q> => Boolean(q))
      .map(mapQuestion);

    for (const q of ordered) globalUsed.add(q.id);
    sections.push({ type: config.type, questions: ordered });
  }

  return { sections };
}

const saveSchema = z.object({
  title: z.string().trim().min(2).max(200),
  instructions: z.string().trim().max(2000).optional(),
  durationMinutes: z.number().int().min(5).max(300),
  classSection: z.string().trim().max(120).optional(),
  examDate: z.string().trim().optional(),
  preparedBy: z.string().trim().max(120).optional(),
  paperCode: z.string().trim().max(20).optional(),
  examLabel: z.string().trim().max(20).optional(),
  syllabusNote: z.string().trim().max(120).optional(),
  testType: z.string().trim().max(40).optional(),
  subjectId: z.string().min(1),
  assignmentId: z.string().min(1).optional(),
  mode: z.enum(["BALANCED", "RANDOM"]).optional(),
  medium: z.enum(["ENGLISH", "URDU", "BOTH"]).optional(),
  sections: z
    .array(
      z.object({
        type: z.enum(["MCQ", "SHORT", "LONG"]),
        attemptCount: z.number().int().min(0).max(100).optional(),
        marksEach: z.number().int().min(1).max(100).optional(),
        questionIds: z.array(z.string().min(1)).min(1).max(100),
        marksOverrides: z.record(z.string(), z.number().int().min(1).max(100)).optional(),
      }),
    )
    .min(1)
    .max(3),
});

export async function saveSectionBuiltTest(input: z.infer<typeof saveSchema>) {
  const { organizationId, teacherId, session, isOrgAdmin } =
    await requirePaperGeneratorWithOrg();
  const parsed = saveSchema.parse(input);

  let assignmentId: string | undefined;
  let forcedSubjectId = parsed.subjectId;
  let forcedClassSection = parsed.classSection?.trim() || null;
  let forcedExamDate =
    parsed.examDate && parsed.examDate.length > 0
      ? new Date(`${parsed.examDate}T00:00:00`)
      : null;

  if (parsed.assignmentId) {
    try {
      const assignment = await assertCanCreateFromAssignment({
        assignmentId: parsed.assignmentId,
        teacherId,
        organizationId,
        subjectId: parsed.subjectId,
      });
      assignmentId = assignment.id;
      forcedSubjectId = assignment.scheduleSubjectClass.subjectId;
      if (!forcedClassSection) {
        forcedClassSection =
          assignment.sectionName?.trim() ||
          assignment.scheduleSubjectClass.class.name;
      }
      // Always use schedule test date — teacher cannot override for scheduled papers.
      forcedExamDate = assignment.scheduleSubjectClass.scheduleSubject.testDate;
    } catch (error) {
      if (error instanceof ScheduleAccessError) {
        throw error;
      }
      throw error;
    }
  } else if (!isOrgAdmin) {
    await assertTeacherAssignedToSubject({
      teacherId,
      organizationId,
      subjectId: parsed.subjectId,
    });
  }

  const allIds = parsed.sections.flatMap((s) => s.questionIds);
  if (new Set(allIds).size !== allIds.length) {
    throw new Error("Duplicate questions across sections are not allowed");
  }

  const questions = await prisma.question.findMany({
    where: { id: { in: allIds }, isActive: true },
  });
  const byId = new Map(questions.map((q) => [q.id, q]));

  const orderedItems: Array<{ questionId: string; marks: number; order: number }> = [];
  let order = 1;
  const instructionParts: string[] = [];

  if (parsed.instructions?.trim()) {
    instructionParts.push(parsed.instructions.trim());
  }

  if (parsed.medium === "ENGLISH") {
    instructionParts.push("Medium: English");
  } else if (parsed.medium === "URDU") {
    instructionParts.push("Medium: Urdu");
  } else if (parsed.medium === "BOTH") {
    instructionParts.push("Medium: Dual (English / Urdu)");
  }

  for (const section of parsed.sections) {
    const label =
      section.type === "MCQ"
        ? "Multiple Choice"
        : section.type === "SHORT"
          ? "Short Questions"
          : "Long Questions";

    if (
      section.attemptCount &&
      section.attemptCount > 0 &&
      section.attemptCount < section.questionIds.length
    ) {
      instructionParts.push(
        `${label}: Attempt any ${section.attemptCount} out of ${section.questionIds.length}.`,
      );
    }

    for (const id of section.questionIds) {
      const q = byId.get(id);
      if (!q) continue;
      if (q.type !== section.type) {
        throw new Error(`Question type mismatch for ${section.type} section`);
      }
      const marks =
        section.marksOverrides?.[id] ?? section.marksEach ?? q.marks;
      orderedItems.push({ questionId: id, marks, order });
      order += 1;
    }
  }

  if (orderedItems.length === 0) {
    throw new Error("No valid questions selected");
  }

  const totalMarks = orderedItems.reduce((sum, item) => sum + item.marks, 0);
  const examDate =
    forcedExamDate && !Number.isNaN(forcedExamDate.getTime())
      ? forcedExamDate
      : null;

  try {
    const test = await prisma.$transaction(async (tx) => {
      const created = await tx.test.create({
        data: {
          title: parsed.title,
          instructions: instructionParts.join("\n") || null,
          durationMinutes: parsed.durationMinutes,
          totalMarks,
          classSection: forcedClassSection,
          examDate,
          preparedBy:
            parsed.preparedBy?.trim() || session.user.name || null,
          paperCode:
            parsed.paperCode?.trim() ||
            String(Math.floor(1000 + Math.random() * 9000)),
          examLabel: parsed.examLabel?.trim() || null,
          syllabusNote: parsed.syllabusNote?.trim() || null,
          testType: parsed.testType?.trim() || null,
          distributionMode: parsed.mode ?? "BALANCED",
          status: "FINAL",
          organizationId,
          teacherId,
          subjectId: forcedSubjectId,
          scheduleAssignmentId: assignmentId ?? null,
          questions: {
            create: orderedItems.map((item) => ({
              questionId: item.questionId,
              order: item.order,
              marks: item.marks,
            })),
          },
        },
      });

      if (assignmentId) {
        const primary = await tx.testScheduleAssignment.update({
          where: {
            id: assignmentId,
          },
          data: { completedAt: new Date() },
          select: {
            id: true,
            teacherId: true,
            scheduleSubjectClassId: true,
          },
        });

        await coverSiblingAssignmentsForSections({
          tx,
          primaryAssignmentId: primary.id,
          teacherId: primary.teacherId,
          scheduleSubjectClassId: primary.scheduleSubjectClassId,
          classSection: forcedClassSection,
          testId: created.id,
          completedAt: new Date(),
        });
      }

      return created;
    });

    revalidatePath("/teacher/tests");
    revalidatePath("/teacher");
    revalidatePath("/teacher/schedules");
    revalidatePath("/org-admin/schedules");
    if (isOrgAdmin) {
      revalidatePath("/org-admin/tests");
      revalidatePath("/org-admin");
    }
    return { testId: test.id, questionCount: orderedItems.length };
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "P2002"
    ) {
      throw new Error("You have already created a test for this assignment");
    }
    throw error;
  }
}
