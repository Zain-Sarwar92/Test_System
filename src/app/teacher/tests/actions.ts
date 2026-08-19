"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole, requireActiveOrganizationId } from "@/lib/rbac";

export async function deleteTeacherTest(testId: string) {
  const session = await requireRole(["TEACHER"]);
  const id = z.string().min(1).parse(testId);

  const organizationId = await requireActiveOrganizationId(session.user.id);
  const existing = await prisma.test.findFirst({
    where: { id, teacherId: session.user.id, organizationId },
    select: { id: true, scheduleAssignmentId: true },
  });
  if (!existing) {
    throw new Error("Test not found");
  }

  await prisma.$transaction(async (tx) => {
    await tx.testScheduleAssignment.updateMany({
      where: { coveredByTestId: existing.id },
      data: { coveredByTestId: null, completedAt: null },
    });
    if (existing.scheduleAssignmentId) {
      await tx.testScheduleAssignment.update({
        where: { id: existing.scheduleAssignmentId },
        data: { completedAt: null },
      });
    }
    await tx.test.delete({ where: { id } });
  });

  revalidatePath("/teacher/tests");
  revalidatePath("/teacher");
  revalidatePath("/teacher/schedules");
  revalidatePath("/org-admin/schedules");
  if (existing.scheduleAssignmentId) {
    revalidatePath("/org-admin");
  }
}
