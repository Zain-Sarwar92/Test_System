"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole, requireActiveOrganizationId } from "@/lib/rbac";
import { syncAssignmentCoverageForTest } from "@/lib/test-schedules";
import {
  parseAttemptCountFromInstructions,
  sectionTotalMarks,
} from "@/lib/paper-marks";

async function requireOwnedTest(testId: string) {
  const session = await requireRole(["TEACHER"]);
  const organizationId = await requireActiveOrganizationId(session.user.id);
  const test = await prisma.test.findFirst({
    where: {
      id: testId,
      teacherId: session.user.id,
      organizationId,
    },
  });
  if (!test) {
    throw new Error("Test not found");
  }
  return { session, test, organizationId };
}

export async function savePaperQuestionOverrides(input: {
  testId: string;
  updates: Array<{
    questionId: string;
    text: string;
    textUrdu?: string | null;
    optionA?: string | null;
    optionB?: string | null;
    optionC?: string | null;
    optionD?: string | null;
  }>;
}) {
  const testId = z.string().min(1).parse(input.testId);
  await requireOwnedTest(testId);

  for (const item of input.updates) {
    await prisma.testQuestion.updateMany({
      where: { testId, questionId: item.questionId },
      data: {
        textOverride: item.text,
        textUrduOverride: item.textUrdu ?? null,
        optionAOverride: item.optionA ?? null,
        optionBOverride: item.optionB ?? null,
        optionCOverride: item.optionC ?? null,
        optionDOverride: item.optionD ?? null,
      },
    });
  }

  revalidatePath(`/teacher/tests/${testId}`);
  revalidatePath(`/teacher/tests/${testId}/print`);
  revalidatePath("/teacher/tests");
  return { ok: true };
}

export async function updateTestMeta(formData: FormData) {
  const testId = z.string().min(1).parse(formData.get("testId"));
  const { test } = await requireOwnedTest(testId);

  const title = z.string().trim().min(2).max(200).parse(formData.get("title"));
  const instructions = String(formData.get("instructions") ?? "").trim();
  const durationMinutes = z.coerce
    .number()
    .int()
    .min(5)
    .max(300)
    .parse(formData.get("durationMinutes"));
  const status = z.enum(["FINAL"]).parse(formData.get("status"));
  const classSection = String(formData.get("classSection") ?? "")
    .trim()
    .slice(0, 120);
  const preparedBy = String(formData.get("preparedBy") ?? "").trim();
  const examDateRaw = String(formData.get("examDate") ?? "").trim();
  const examDate =
    examDateRaw.length > 0 ? new Date(`${examDateRaw}T00:00:00`) : null;

  const nextSection = classSection || null;

  await prisma.$transaction(async (tx) => {
    await tx.test.update({
      where: { id: testId },
      data: {
        title,
        instructions: instructions || null,
        durationMinutes,
        status,
        classSection: nextSection,
        preparedBy: preparedBy || null,
        examDate: examDate && !Number.isNaN(examDate.getTime()) ? examDate : null,
      },
    });

    if (test.scheduleAssignmentId) {
      await syncAssignmentCoverageForTest({
        tx,
        testId,
        teacherId: test.teacherId,
        scheduleAssignmentId: test.scheduleAssignmentId,
        classSection: nextSection,
      });
    }
  });

  revalidatePath(`/teacher/tests/${testId}`);
  revalidatePath("/teacher/tests");
  revalidatePath("/teacher/schedules");
  revalidatePath("/org-admin/schedules");
}

const saveSavedPaperSchema = z.object({
  testId: z.string().min(1),
  title: z.string().trim().min(2).max(200),
  classSection: z.string().trim().max(120).optional(),
  examDate: z.string().trim().optional(),
  durationMinutes: z.number().int().min(5).max(300),
  paperCode: z.string().trim().max(20).optional(),
  examLabel: z.string().trim().max(20).optional(),
  syllabusNote: z.string().trim().max(120).optional(),
  preparedBy: z.string().trim().max(120).optional(),
  instructions: z.string().trim().max(2000).optional(),
  questionOverrides: z
    .array(
      z.object({
        questionId: z.string().min(1),
        text: z.string().min(1),
        textUrdu: z.string().nullable().optional(),
        optionA: z.string().nullable().optional(),
        optionB: z.string().nullable().optional(),
        optionC: z.string().nullable().optional(),
        optionD: z.string().nullable().optional(),
      }),
    )
    .optional(),
});

/** Save paper settings (+ optional manual question text edits) from preview Save popup */
export async function saveSavedPaper(
  input: z.infer<typeof saveSavedPaperSchema>,
) {
  const parsed = saveSavedPaperSchema.parse(input);
  const { test } = await requireOwnedTest(parsed.testId);

  const examDate =
    parsed.examDate && parsed.examDate.length > 0
      ? new Date(`${parsed.examDate}T00:00:00`)
      : null;
  const nextSection = parsed.classSection?.trim() || null;

  await prisma.$transaction(async (tx) => {
    await tx.test.update({
      where: { id: parsed.testId },
      data: {
        title: parsed.title,
        classSection: nextSection,
        durationMinutes: parsed.durationMinutes,
        paperCode: parsed.paperCode?.trim() || null,
        examLabel: parsed.examLabel?.trim() || null,
        syllabusNote: parsed.syllabusNote?.trim() || null,
        preparedBy: parsed.preparedBy?.trim() || null,
        instructions: parsed.instructions?.trim() || null,
        examDate:
          examDate && !Number.isNaN(examDate.getTime()) ? examDate : null,
        status: "FINAL",
      },
    });

    if (test.scheduleAssignmentId) {
      await syncAssignmentCoverageForTest({
        tx,
        testId: parsed.testId,
        teacherId: test.teacherId,
        scheduleAssignmentId: test.scheduleAssignmentId,
        classSection: nextSection,
      });
    }

    if (parsed.questionOverrides?.length) {
      for (const item of parsed.questionOverrides) {
        await tx.testQuestion.updateMany({
          where: { testId: parsed.testId, questionId: item.questionId },
          data: {
            textOverride: item.text,
            textUrduOverride: item.textUrdu ?? null,
            optionAOverride: item.optionA ?? null,
            optionBOverride: item.optionB ?? null,
            optionCOverride: item.optionC ?? null,
            optionDOverride: item.optionD ?? null,
          },
        });
      }
    }
  });

  revalidatePath(`/teacher/tests/${parsed.testId}`);
  revalidatePath(`/teacher/tests/${parsed.testId}/print`);
  revalidatePath("/teacher/tests");
  revalidatePath("/teacher/schedules");
  revalidatePath("/org-admin/schedules");
  return { ok: true };
}

export async function removeTestQuestion(formData: FormData) {
  const testId = z.string().min(1).parse(formData.get("testId"));
  const testQuestionId = z.string().min(1).parse(formData.get("testQuestionId"));
  await requireOwnedTest(testId);

  await prisma.testQuestion.delete({
    where: { id: testQuestionId },
  });

  await recalculateMarksAndOrder(testId);
  revalidatePath(`/teacher/tests/${testId}`);
}

export async function reorderTestQuestion(formData: FormData) {
  const testId = z.string().min(1).parse(formData.get("testId"));
  const testQuestionId = z.string().min(1).parse(formData.get("testQuestionId"));
  const direction = z.enum(["up", "down"]).parse(formData.get("direction"));
  await requireOwnedTest(testId);

  const items = await prisma.testQuestion.findMany({
    where: { testId },
    orderBy: { order: "asc" },
  });

  const index = items.findIndex((item) => item.id === testQuestionId);
  if (index < 0) return;

  const swapWith = direction === "up" ? index - 1 : index + 1;
  if (swapWith < 0 || swapWith >= items.length) return;

  const a = items[index];
  const b = items[swapWith];

  await prisma.$transaction([
    prisma.testQuestion.update({
      where: { id: a.id },
      data: { order: b.order },
    }),
    prisma.testQuestion.update({
      where: { id: b.id },
      data: { order: a.order },
    }),
  ]);

  revalidatePath(`/teacher/tests/${testId}`);
}

export async function replaceTestQuestion(formData: FormData) {
  const testId = z.string().min(1).parse(formData.get("testId"));
  const testQuestionId = z.string().min(1).parse(formData.get("testQuestionId"));
  const newQuestionId = z.string().min(1).parse(formData.get("newQuestionId"));
  await requireOwnedTest(testId);

  const existingIds = await prisma.testQuestion.findMany({
    where: { testId },
    select: { questionId: true },
  });
  if (existingIds.some((q) => q.questionId === newQuestionId)) {
    throw new Error("Question already in this test");
  }

  const question = await prisma.question.findFirst({
    where: { id: newQuestionId, isActive: true },
  });
  if (!question) {
    throw new Error("Replacement question not found");
  }

  await prisma.testQuestion.update({
    where: { id: testQuestionId },
    data: {
      questionId: question.id,
      marks: question.marks,
    },
  });

  await recalculateMarksAndOrder(testId);
  revalidatePath(`/teacher/tests/${testId}`);
}

export async function addTestQuestion(formData: FormData) {
  const testId = z.string().min(1).parse(formData.get("testId"));
  const questionId = z.string().min(1).parse(formData.get("questionId"));
  await requireOwnedTest(testId);

  const exists = await prisma.testQuestion.findFirst({
    where: { testId, questionId },
  });
  if (exists) {
    throw new Error("Question already in this test");
  }

  const question = await prisma.question.findFirst({
    where: { id: questionId, isActive: true },
  });
  if (!question) {
    throw new Error("Question not found");
  }

  const maxOrder = await prisma.testQuestion.aggregate({
    where: { testId },
    _max: { order: true },
  });

  await prisma.testQuestion.create({
    data: {
      testId,
      questionId,
      marks: question.marks,
      order: (maxOrder._max.order ?? 0) + 1,
    },
  });

  await recalculateMarksAndOrder(testId);
  revalidatePath(`/teacher/tests/${testId}`);
}

export async function replaceSectionOnSavedTest(input: {
  testId: string;
  type: "MCQ" | "SHORT" | "LONG";
  questionIds: string[];
  marksEach: number;
}) {
  const testId = z.string().min(1).parse(input.testId);
  const type = z.enum(["MCQ", "SHORT", "LONG"]).parse(input.type);
  const questionIds = z.array(z.string().min(1)).min(1).parse(input.questionIds);
  const marksEach = z.number().int().min(1).max(100).parse(input.marksEach);

  await requireOwnedTest(testId);

  // Unique preserve order
  const uniqueIds = [...new Set(questionIds)];

  const questions = await prisma.question.findMany({
    where: { id: { in: uniqueIds }, isActive: true, type },
    select: { id: true, marks: true, type: true },
  });
  if (questions.length !== uniqueIds.length) {
    throw new Error("Some questions invalid or wrong type");
  }

  const byId = new Map(questions.map((q) => [q.id, q]));

  // Remove all existing questions of this type from the paper
  const existingOfType = await prisma.testQuestion.findMany({
    where: { testId, question: { type } },
    select: { id: true },
  });
  if (existingOfType.length > 0) {
    await prisma.testQuestion.deleteMany({
      where: { id: { in: existingOfType.map((e) => e.id) } },
    });
  }

  const maxOrder = await prisma.testQuestion.aggregate({
    where: { testId },
    _max: { order: true },
  });
  let order = (maxOrder._max.order ?? 0) + 1;

  await prisma.testQuestion.createMany({
    data: uniqueIds.map((qid) => ({
      testId,
      questionId: qid,
      marks: marksEach || byId.get(qid)?.marks || 1,
      order: order++,
    })),
  });

  await recalculateMarksAndOrder(testId);
  revalidatePath(`/teacher/tests/${testId}`);
  revalidatePath(`/teacher/tests/${testId}/print`);
  revalidatePath("/teacher/tests");
  return { replaced: uniqueIds.length };
}

async function recalculateMarksAndOrder(testId: string) {
  const test = await prisma.test.findUnique({
    where: { id: testId },
    select: { instructions: true },
  });
  const items = await prisma.testQuestion.findMany({
    where: { testId },
    orderBy: { order: "asc" },
    include: {
      question: { select: { marks: true, type: true } },
    },
  });

  const byType = new Map<
    "MCQ" | "SHORT" | "LONG",
    Array<(typeof items)[number]>
  >();
  for (const item of items) {
    const type = item.question.type as "MCQ" | "SHORT" | "LONG";
    const list = byType.get(type) ?? [];
    list.push(item);
    byType.set(type, list);
  }

  let totalMarks = 0;
  for (const type of ["MCQ", "SHORT", "LONG"] as const) {
    const rows = byType.get(type);
    if (!rows?.length) continue;
    const marksEach = rows[0].marks || rows[0].question.marks || 1;
    totalMarks += sectionTotalMarks({
      questionCount: rows.length,
      marksEach,
      attemptCount: parseAttemptCountFromInstructions(
        test?.instructions,
        type,
      ),
    });
  }

  await prisma.$transaction([
    ...items.map((item, index) =>
      prisma.testQuestion.update({
        where: { id: item.id },
        data: {
          order: index + 1,
          marks: item.marks || item.question.marks,
        },
      }),
    ),
    prisma.test.update({
      where: { id: testId },
      data: { totalMarks },
    }),
  ]);
}
