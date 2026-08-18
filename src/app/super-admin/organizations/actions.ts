"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createCredentialUser } from "@/lib/create-credential-user";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";
import { parseOrgModulesFromForm } from "@/lib/org-modules";

const orgSchema = z.object({
  name: z.string().trim().min(2).max(120),
  slug: z
    .string()
    .trim()
    .min(2)
    .max(60)
    .regex(/^[a-z0-9-]+$/, "Slug must be lowercase letters, numbers, hyphens"),
  address: z.string().trim().max(300).optional(),
  phone: z.string().trim().max(40).optional(),
  logoUrl: z.string().trim().url().optional().or(z.literal("")),
  planId: z.string().trim().optional(),
  adminName: z.string().trim().min(2).max(120),
  adminEmail: z.string().email(),
  adminPassword: z.string().min(8).max(72),
});

const updateOrgSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(2).max(120),
  slug: z
    .string()
    .trim()
    .min(2)
    .max(60)
    .regex(/^[a-z0-9-]+$/, "Slug must be lowercase letters, numbers, hyphens"),
  address: z.string().trim().max(300).optional(),
  phone: z.string().trim().max(40).optional(),
  logoUrl: z.string().trim().url().optional().or(z.literal("")),
  planId: z.string().trim().optional(),
});

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function revalidateOrgPaths(id?: string) {
  revalidatePath("/super-admin/organizations");
  revalidatePath("/super-admin/organizations/list");
  revalidatePath("/super-admin");
  revalidatePath("/org-admin", "layout");
  revalidatePath("/teacher", "layout");
  if (id) revalidatePath(`/super-admin/organizations/${id}`);
}

export async function createOrganizationAction(formData: FormData): Promise<
  | { ok: true; name: string; id: string }
  | { ok: false; error: string }
> {
  try {
    await requireRole(["SUPER_ADMIN"]);

    const rawSlug =
      String(formData.get("slug") ?? "").trim() ||
      slugify(String(formData.get("name") ?? ""));
    const slug =
      rawSlug.length >= 2
        ? rawSlug
        : `org-${Date.now().toString(36)}`;

    const parsed = orgSchema.parse({
      name: formData.get("name"),
      slug,
      address: formData.get("address") || undefined,
      phone: formData.get("phone") || undefined,
      logoUrl: formData.get("logoUrl") || "",
      planId: formData.get("planId") || undefined,
      adminName: formData.get("adminName"),
      adminEmail: formData.get("adminEmail"),
      adminPassword: formData.get("adminPassword"),
    });

    const existingOrg = await prisma.organization.findUnique({
      where: { slug: parsed.slug },
    });
    if (existingOrg) {
      return { ok: false, error: "Organization slug already exists" };
    }

    const existingUser = await prisma.user.findUnique({
      where: { email: parsed.adminEmail },
    });
    if (existingUser) {
      return { ok: false, error: "Admin email already exists" };
    }

    const organization = await prisma.organization.create({
      data: {
        name: parsed.name,
        slug: parsed.slug,
        address: parsed.address || null,
        phone: parsed.phone || null,
        logoUrl: parsed.logoUrl || null,
        planId: parsed.planId || null,
        isActive: true,
        ...parseOrgModulesFromForm(formData),
      },
    });

    try {
      await createCredentialUser({
        email: parsed.adminEmail,
        password: parsed.adminPassword,
        name: parsed.adminName,
      });

      const adminUser = await prisma.user.update({
        where: { email: parsed.adminEmail },
        data: {
          role: "ORG_ADMIN",
          organizationId: organization.id,
          isActive: true,
        },
      });

      await prisma.orgMembership.create({
        data: {
          userId: adminUser.id,
          organizationId: organization.id,
          role: "ORG_ADMIN",
          isActive: true,
        },
      });
    } catch (signupErr) {
      await prisma.organization.delete({ where: { id: organization.id } }).catch(() => {});
      throw signupErr;
    }

    revalidateOrgPaths(organization.id);
    return { ok: true, name: organization.name, id: organization.id };
  } catch (err) {
    if (err instanceof z.ZodError) {
      const first = err.issues[0];
      return {
        ok: false,
        error: first?.message ?? "Invalid form data",
      };
    }
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to create organization",
    };
  }
}

export async function updateOrganization(formData: FormData) {
  await requireRole(["SUPER_ADMIN"]);
  const parsed = updateOrgSchema.parse({
    id: formData.get("id"),
    name: formData.get("name"),
    slug: formData.get("slug"),
    address: formData.get("address") || undefined,
    phone: formData.get("phone") || undefined,
    logoUrl: formData.get("logoUrl") || "",
    planId: formData.get("planId") || undefined,
  });

  const existing = await prisma.organization.findFirst({
    where: { slug: parsed.slug, NOT: { id: parsed.id } },
  });
  if (existing) {
    throw new Error("Slug already in use by another organization");
  }

  await prisma.organization.update({
    where: { id: parsed.id },
    data: {
      name: parsed.name,
      slug: parsed.slug,
      address: parsed.address || null,
      phone: parsed.phone || null,
      logoUrl: parsed.logoUrl || null,
      planId: parsed.planId || null,
    },
  });

  revalidateOrgPaths(parsed.id);
}

export async function updateOrganizationModules(formData: FormData) {
  await requireRole(["SUPER_ADMIN"]);
  const id = z.string().min(1).parse(formData.get("id"));
  await prisma.organization.update({
    where: { id },
    data: parseOrgModulesFromForm(formData),
  });

  revalidateOrgPaths(id);
}

export async function deleteOrganization(formData: FormData) {
  await requireRole(["SUPER_ADMIN"]);
  const id = z.string().min(1).parse(formData.get("id"));
  await prisma.organization.delete({ where: { id } });
  revalidateOrgPaths();
}

export async function toggleOrganizationActive(formData: FormData) {
  await requireRole(["SUPER_ADMIN"]);
  const id = z.string().min(1).parse(formData.get("id"));
  const org = await prisma.organization.findUniqueOrThrow({ where: { id } });
  const nextActive = !org.isActive;

  await prisma.$transaction([
    prisma.organization.update({
      where: { id },
      data: { isActive: nextActive },
    }),
    ...(nextActive
      ? []
      : [
          prisma.user.updateMany({
            where: { organizationId: id },
            data: { isActive: false },
          }),
        ]),
  ]);

  revalidateOrgPaths(id);
}
