"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";

const schema = z.object({
  type: z.enum(["MCQ", "SHORT", "LONG"]),
  text: z.string().trim().min(3),
  textUrdu: z.string().trim().optional(),
  topicId: z.string().min(1),
  marks: z.coerce.number().int().min(1).max(100).default(2),
  optionA: z.string().trim().optional(),
  optionB: z.string().trim().optional(),
  optionC: z.string().trim().optional(),
  optionD: z.string().trim().optional(),
  correctAnswer: z.string().trim().optional(),
});

export async function submitSuggestion(formData: FormData) {
  const session = await requireRole(["TEACHER"]);

  const parsed = schema.parse({
    type: formData.get("type"),
    text: formData.get("text"),
    textUrdu: formData.get("textUrdu") || undefined,
    topicId: formData.get("topicId"),
    marks: formData.get("marks") || 2,
    optionA: formData.get("optionA") || undefined,
    optionB: formData.get("optionB") || undefined,
    optionC: formData.get("optionC") || undefined,
    optionD: formData.get("optionD") || undefined,
    correctAnswer: formData.get("correctAnswer") || undefined,
  });

  if (parsed.type === "MCQ") {
    if (!parsed.optionA || !parsed.optionB || !parsed.optionC || !parsed.optionD) {
      throw new Error("MCQ requires 4 options");
    }
    if (!parsed.correctAnswer) {
      throw new Error("MCQ requires a correct answer");
    }
  }

  await prisma.questionSuggestion.create({
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
      teacherId: session.user.id,
      status: "PENDING",
    },
  });

  revalidatePath("/teacher/suggestions");
  revalidatePath("/super-admin/suggestions");
  revalidatePath("/super-admin");
}
