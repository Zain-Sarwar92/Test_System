"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";

const planSchema = z.object({
  name: z.string().trim().min(2).max(80),
  maxTeachers: z.coerce.number().int().min(0).optional(),
  maxTests: z.coerce.number().int().min(0).optional(),
});

function revalidatePlans() {
  revalidatePath("/super-admin/plans");
  revalidatePath("/super-admin/organizations");
}

export async function createPlan(formData: FormData) {
  await requireRole(["SUPER_ADMIN"]);
  const parsed = planSchema.parse({
    name: formData.get("name"),
    maxTeachers: formData.get("maxTeachers") || undefined,
    maxTests: formData.get("maxTests") || undefined,
  });

  await prisma.subscriptionPlan.create({
    data: {
      name: parsed.name,
      maxTeachers: parsed.maxTeachers ?? null,
      maxTests: parsed.maxTests ?? null,
      isActive: true,
    },
  });
  revalidatePlans();
}

export async function togglePlanActive(formData: FormData) {
  await requireRole(["SUPER_ADMIN"]);
  const id = z.string().min(1).parse(formData.get("id"));
  const plan = await prisma.subscriptionPlan.findUniqueOrThrow({ where: { id } });
  await prisma.subscriptionPlan.update({
    where: { id },
    data: { isActive: !plan.isActive },
  });
  revalidatePlans();
}

export async function deletePlan(formData: FormData) {
  await requireRole(["SUPER_ADMIN"]);
  const id = z.string().min(1).parse(formData.get("id"));
  await prisma.organization.updateMany({
    where: { planId: id },
    data: { planId: null },
  });
  await prisma.subscriptionPlan.delete({ where: { id } });
  revalidatePlans();
}
