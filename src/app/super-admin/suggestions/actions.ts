"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";

function revalidateSuggestions() {
  revalidatePath("/super-admin/suggestions");
  revalidatePath("/super-admin");
  revalidatePath("/super-admin/questions");
  revalidatePath("/super-admin/questions/list");
}

export async function approveSuggestion(formData: FormData) {
  const session = await requireRole(["SUPER_ADMIN"]);
  const id = z.string().min(1).parse(formData.get("id"));

  await prisma.$transaction(async (tx) => {
    const suggestion = await tx.questionSuggestion.findUniqueOrThrow({
      where: { id },
    });

    if (suggestion.status !== "PENDING") {
      throw new Error("Suggestion already reviewed");
    }

    const question = await tx.question.create({
      data: {
        type: suggestion.type,
        text: suggestion.text,
        textUrdu: suggestion.textUrdu,
        optionA: suggestion.optionA,
        optionB: suggestion.optionB,
        optionC: suggestion.optionC,
        optionD: suggestion.optionD,
        correctAnswer: suggestion.correctAnswer,
        marks: suggestion.marks,
        topicId: suggestion.topicId,
        isActive: true,
        source: "Teacher suggestion",
      },
    });

    await tx.questionSuggestion.update({
      where: { id },
      data: {
        status: "APPROVED",
        reviewedById: session.user.id,
        reviewedAt: new Date(),
        questionId: question.id,
        reviewNote: null,
      },
    });
  });

  revalidateSuggestions();
}

export async function rejectSuggestion(formData: FormData) {
  const session = await requireRole(["SUPER_ADMIN"]);
  const id = z.string().min(1).parse(formData.get("id"));
  const reviewNote = String(formData.get("reviewNote") ?? "").trim();

  const suggestion = await prisma.questionSuggestion.findUniqueOrThrow({
    where: { id },
  });

  if (suggestion.status !== "PENDING") {
    throw new Error("Suggestion already reviewed");
  }

  if (!reviewNote) {
    throw new Error("Rejection reason is required");
  }

  await prisma.questionSuggestion.update({
    where: { id },
    data: {
      status: "REJECTED",
      reviewedById: session.user.id,
      reviewedAt: new Date(),
      reviewNote,
    },
  });

  revalidateSuggestions();
}

export async function bulkApproveSuggestions(formData: FormData) {
  await requireRole(["SUPER_ADMIN"]);
  const ids = formData.getAll("ids").map(String).filter(Boolean);
  if (ids.length === 0) throw new Error("No suggestions selected");

  for (const id of ids) {
    const fd = new FormData();
    fd.set("id", id);
    await approveSuggestion(fd);
  }

  revalidateSuggestions();
}
