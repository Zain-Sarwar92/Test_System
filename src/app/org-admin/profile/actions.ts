"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";
import { resolveLogoUrlFromForm } from "@/lib/org-logo";

const profileSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Enter the organization name (at least 2 characters).")
    .max(120, "Organization name must be 120 characters or fewer."),
  phone: z.string().trim().max(40, "Phone number must be 40 characters or fewer.").optional(),
  address: z.string().trim().max(300, "Address must be 300 characters or fewer.").optional(),
  logoUrl: z
    .string()
    .trim()
    .optional()
    .or(z.literal(""))
    .refine(
      (value) =>
        !value ||
        value.startsWith("/") ||
        value.startsWith("data:image/") ||
        /^https?:\/\//i.test(value),
      "Enter a valid logo URL starting with http:// or https://, or upload an image",
    ),
  curriculumAccessMode: z.enum(["ASSIGNED_ONLY", "ALL_CURRICULUM"]),
});

export async function updateOrgProfile(formData: FormData) {
  try {
    const session = await requireRole(["ORG_ADMIN"]);
    const organizationId = session.user.organizationId;
    if (!organizationId) {
      return { ok: false as const, error: "No organization is linked to this account." };
    }

    const parsed = profileSchema.parse({
      name: formData.get("name"),
      phone: formData.get("phone") || undefined,
      address: formData.get("address") || undefined,
      logoUrl: (await resolveLogoUrlFromForm(formData)) || "",
      curriculumAccessMode: formData.get("curriculumAccessMode"),
    });

    if (parsed.phone) {
      const digits = parsed.phone.replace(/\D/g, "").length;
      if (digits < 10) {
        return {
          ok: false as const,
          error: "Enter a valid phone number with at least 10 digits.",
        };
      }
    }

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
    return { ok: true as const };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        ok: false as const,
        error: error.issues[0]?.message ?? "Please check the form and try again.",
      };
    }
    return {
      ok: false as const,
      error: error instanceof Error ? error.message : "Failed to save the organization profile.",
    };
  }
}
