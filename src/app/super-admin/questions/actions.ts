"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";
import type { Prisma } from "@/generated/prisma/client";

const questionSchema = z.object({
  type: z.enum(["MCQ", "SHORT", "LONG"]),
  text: z.string().trim().min(3),
  textUrdu: z.string().trim().optional(),
  topicId: z.string().min(1),
  marks: z.coerce.number().int().min(1).max(100).default(1),
  optionA: z.string().trim().optional(),
  optionB: z.string().trim().optional(),
  optionC: z.string().trim().optional(),
  optionD: z.string().trim().optional(),
  correctAnswer: z.string().trim().optional(),
  source: z.string().trim().optional(),
});

const listSchema = z.object({
  q: z.string().trim().optional(),
  type: z.enum(["MCQ", "SHORT", "LONG", "ALL"]).optional(),
  active: z.enum(["active", "inactive", "all"]).optional(),
  topicId: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(10).max(100).default(25),
});

function revalidateQuestionPaths() {
  revalidatePath("/super-admin/questions");
  revalidatePath("/super-admin/questions/list");
  revalidatePath("/super-admin");
}

export async function createQuestion(formData: FormData) {
  await requireRole(["SUPER_ADMIN"]);
  const parsed = questionSchema.parse({
    type: formData.get("type"),
    text: formData.get("text"),
    textUrdu: formData.get("textUrdu") || undefined,
    topicId: formData.get("topicId"),
    marks: formData.get("marks") || 1,
    optionA: formData.get("optionA") || undefined,
    optionB: formData.get("optionB") || undefined,
    optionC: formData.get("optionC") || undefined,
    optionD: formData.get("optionD") || undefined,
    correctAnswer: formData.get("correctAnswer") || undefined,
    source: formData.get("source") || undefined,
  });

  if (parsed.type === "MCQ") {
    if (!parsed.optionA || !parsed.optionB || !parsed.optionC || !parsed.optionD) {
      throw new Error("MCQ requires 4 options");
    }
    if (!parsed.correctAnswer) {
      throw new Error("MCQ requires a correct answer");
    }
  }

  await prisma.question.create({
    data: {
      type: parsed.type,
      text: parsed.text,
      textUrdu: parsed.textUrdu || null,
      topicId: parsed.topicId,
      marks: parsed.marks,
      optionA: parsed.optionA || null,
      optionB: parsed.optionB || null,
      optionC: parsed.optionC || null,
      optionD: parsed.optionD || null,
      correctAnswer: parsed.correctAnswer || null,
      source: parsed.source || null,
      isActive: true,
    },
  });

  revalidateQuestionPaths();
}

export async function updateQuestion(formData: FormData) {
  await requireRole(["SUPER_ADMIN"]);
  const id = z.string().min(1).parse(formData.get("id"));
  const parsed = questionSchema.parse({
    type: formData.get("type"),
    text: formData.get("text"),
    textUrdu: formData.get("textUrdu") || undefined,
    topicId: formData.get("topicId"),
    marks: formData.get("marks") || 1,
    optionA: formData.get("optionA") || undefined,
    optionB: formData.get("optionB") || undefined,
    optionC: formData.get("optionC") || undefined,
    optionD: formData.get("optionD") || undefined,
    correctAnswer: formData.get("correctAnswer") || undefined,
    source: formData.get("source") || undefined,
  });

  if (parsed.type === "MCQ") {
    if (!parsed.optionA || !parsed.optionB || !parsed.optionC || !parsed.optionD) {
      throw new Error("MCQ requires 4 options");
    }
  }

  await prisma.question.update({
    where: { id },
    data: {
      type: parsed.type,
      text: parsed.text,
      textUrdu: parsed.textUrdu || null,
      topicId: parsed.topicId,
      marks: parsed.marks,
      optionA: parsed.optionA || null,
      optionB: parsed.optionB || null,
      optionC: parsed.optionC || null,
      optionD: parsed.optionD || null,
      correctAnswer: parsed.correctAnswer || null,
      source: parsed.source || null,
    },
  });

  revalidateQuestionPaths();
}

export async function toggleQuestionActive(formData: FormData) {
  await requireRole(["SUPER_ADMIN"]);
  const id = z.string().min(1).parse(formData.get("id"));
  const question = await prisma.question.findUniqueOrThrow({ where: { id } });
  await prisma.question.update({
    where: { id },
    data: { isActive: !question.isActive },
  });
  revalidateQuestionPaths();
}

export async function deleteQuestion(formData: FormData) {
  await requireRole(["SUPER_ADMIN"]);
  const id = z.string().min(1).parse(formData.get("id"));
  await prisma.question.delete({ where: { id } });
  revalidateQuestionPaths();
}

export async function searchQuestions(input: z.infer<typeof listSchema>) {
  await requireRole(["SUPER_ADMIN"]);
  const parsed = listSchema.parse(input);
  const where: Prisma.QuestionWhereInput = {};

  if (parsed.type && parsed.type !== "ALL") {
    where.type = parsed.type;
  }
  if (parsed.active === "active") where.isActive = true;
  if (parsed.active === "inactive") where.isActive = false;
  if (parsed.topicId) where.topicId = parsed.topicId;
  if (parsed.q) {
    where.OR = [
      { text: { contains: parsed.q } },
      { textUrdu: { contains: parsed.q } },
      { source: { contains: parsed.q } },
    ];
  }

  const skip = (parsed.page - 1) * parsed.pageSize;
  const [items, total] = await Promise.all([
    prisma.question.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      skip,
      take: parsed.pageSize,
      include: {
        topic: {
          include: {
            chapter: {
              include: {
                subject: {
                  include: {
                    class: { include: { board: true } },
                  },
                },
              },
            },
          },
        },
      },
    }),
    prisma.question.count({ where }),
  ]);

  return {
    items: items.map((q) => ({
      id: q.id,
      type: q.type,
      text: q.text,
      marks: q.marks,
      isActive: q.isActive,
      path: [
        q.topic.chapter.subject.class.board.name,
        q.topic.chapter.subject.class.name,
        q.topic.chapter.subject.name,
        q.topic.chapter.name,
        q.topic.name,
      ].join(" → "),
    })),
    total,
    page: parsed.page,
    pageSize: parsed.pageSize,
    totalPages: Math.max(1, Math.ceil(total / parsed.pageSize)),
  };
}

export async function getQuestionForEdit(id: string) {
  await requireRole(["SUPER_ADMIN"]);
  return prisma.question.findUniqueOrThrow({
    where: { id },
    include: {
      topic: {
        include: {
          chapter: {
            include: {
              subject: {
                include: { class: { include: { board: true } } },
              },
            },
          },
        },
      },
    },
  });
}
