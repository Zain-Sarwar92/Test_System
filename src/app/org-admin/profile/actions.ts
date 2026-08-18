"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";

const profileSchema = z.object({
  name: z.string().trim().min(2).max(120),
  phone: z.string().trim().max(40).optional(),
  address: z.string().trim().max(300).optional(),
  logoUrl: z.string().trim().url().optional().or(z.literal("")),
  curriculumAccessMode: z.enum(["ASSIGNED_ONLY", "ALL_CURRICULUM"]),
});

export async function updateOrgProfile(formData: FormData) {
  const session = await requireRole(["ORG_ADMIN"]);
  const organizationId = session.user.organizationId;
  if (!organizationId) {
    throw new Error("Organization not linked");
  }

  const parsed = profileSchema.parse({
    name: formData.get("name"),
    phone: formData.get("phone") || undefined,
    address: formData.get("address") || undefined,
    logoUrl: formData.get("logoUrl") || "",
    curriculumAccessMode: formData.get("curriculumAccessMode"),
  });

  await prisma.organization.update({
    where: { id: organizationId },
    data: {
      name: parsed.name,
      phone: parsed.phone || null,
      address: parsed.address || null,
      logoUrl: parsed.logoUrl || null,
      curriculumAccessMode: parsed.curriculumAccessMode,
    },
  });

  revalidatePath("/org-admin/profile");
  revalidatePath("/org-admin");
  revalidatePath("/teacher/generate");
}
