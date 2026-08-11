"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";

async function requireOrgAdmin() {
  const session = await requireRole(["ORG_ADMIN"]);
  const organizationId = session.user.organizationId;
  if (!organizationId) {
    throw new Error("Organization not linked to this admin");
  }
  return { organizationId };
}

const sectionUpdateSchema = z.object({
  name: z.string().trim().min(1).max(50),
  classId: z.string().min(1),
});

function splitSectionNames(raw: string): string[] {
  return [
    ...new Set(
      raw
        .split(/[,/|]+/)
        .map((part) => part.trim())
        .filter(Boolean),
    ),
  ];
}

function revalidateSections() {
  revalidatePath("/org-admin/sections");
  revalidatePath("/org-admin/sections/new");
  revalidatePath("/org-admin/teachers");
  revalidatePath("/org-admin/teachers/new");
  revalidatePath("/org-admin/schedules/new");
}

export async function createSection(formData: FormData) {
  try {
    const { organizationId } = await requireOrgAdmin();
    const classId = z.string().min(1).parse(formData.get("classId"));
    const namesRaw = z.string().trim().min(1).parse(formData.get("name"));
    const names = splitSectionNames(namesRaw);

    if (names.length === 0) {
      return { ok: false as const, error: "Enter at least one section name" };
    }
    for (const name of names) {
      if (name.length > 50) {
        return {
          ok: false as const,
          error: `Section name is too long: ${name}`,
        };
      }
    }

    const klass = await prisma.class.findUnique({
      where: { id: classId },
      select: { id: true },
    });
    if (!klass) {
      return { ok: false as const, error: "Class not found" };
    }

    const existing = await prisma.section.findMany({
      where: {
        organizationId,
        classId,
        name: { in: names },
      },
      select: { name: true },
    });
    if (existing.length > 0) {
      return {
        ok: false as const,
        error: `Already exists for this class: ${existing.map((s) => s.name).join(", ")}`,
      };
    }

    await prisma.section.createMany({
      data: names.map((name) => ({
        name,
        classId,
        organizationId,
      })),
    });

    revalidateSections();
    return { ok: true as const, createdCount: names.length };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        ok: false as const,
        error: error.issues[0]?.message ?? "Invalid section data",
      };
    }
    return {
      ok: false as const,
      error: error instanceof Error ? error.message : "Failed to create section",
    };
  }
}

export async function updateSection(formData: FormData) {
  try {
    const { organizationId } = await requireOrgAdmin();
    const id = z.string().min(1).parse(formData.get("id"));
    const parsed = sectionUpdateSchema.parse({
      name: formData.get("name"),
      classId: formData.get("classId"),
    });

    if (splitSectionNames(parsed.name).length > 1) {
      return {
        ok: false as const,
        error: "Edit one section at a time. Use Add Section for multiple names.",
      };
    }

    const section = await prisma.section.findFirst({
      where: { id, organizationId },
      select: { id: true, classId: true, _count: { select: { teacherAssignments: true } } },
    });
    if (!section) {
      return { ok: false as const, error: "Section not found" };
    }

    if (
      parsed.classId !== section.classId &&
      section._count.teacherAssignments > 0
    ) {
      return {
        ok: false as const,
        error:
          "Cannot change class while teachers are assigned to this section. Remove assignments first.",
      };
    }

    const klass = await prisma.class.findUnique({
      where: { id: parsed.classId },
      select: { id: true },
    });
    if (!klass) {
      return { ok: false as const, error: "Class not found" };
    }

    const duplicate = await prisma.section.findFirst({
      where: {
        organizationId,
        classId: parsed.classId,
        name: parsed.name,
        NOT: { id },
      },
    });
    if (duplicate) {
      return {
        ok: false as const,
        error: "This section already exists for the selected class",
      };
    }

    await prisma.section.update({
      where: { id },
      data: {
        name: parsed.name,
        classId: parsed.classId,
      },
    });

    revalidateSections();
    revalidatePath(`/org-admin/sections/${id}/edit`);
    return { ok: true as const };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        ok: false as const,
        error: error.issues[0]?.message ?? "Invalid section data",
      };
    }
    return {
      ok: false as const,
      error: error instanceof Error ? error.message : "Failed to update section",
    };
  }
}

export async function deleteSection(formData: FormData) {
  const { organizationId } = await requireOrgAdmin();
  const id = z.string().min(1).parse(formData.get("id"));

  const section = await prisma.section.findFirst({
    where: { id, organizationId },
    select: { id: true },
  });
  if (!section) {
    throw new Error("Section not found");
  }

  await prisma.section.delete({ where: { id } });
  revalidateSections();
}
