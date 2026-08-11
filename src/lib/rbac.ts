import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { Role } from "@/generated/prisma/client";

export type AppSession = NonNullable<
  Awaited<ReturnType<typeof auth.api.getSession>>
>;

export async function getSession() {
  return auth.api.getSession({
    headers: await headers(),
  });
}

export async function resolveUserRole(session: AppSession): Promise<Role> {
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });

  return (user?.role as Role | undefined) ?? "TEACHER";
}

/**
 * Always read active org from DB (never trust stale session alone).
 * Prisma omits `undefined` filters — missing orgId would leak cross-org data.
 */
export async function requireActiveOrganizationId(
  userId: string,
): Promise<string> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { organizationId: true },
  });

  const organizationId = user?.organizationId;
  if (!organizationId) {
    redirect("/select-org");
  }

  const membership = await prisma.orgMembership.findFirst({
    where: {
      userId,
      organizationId,
      isActive: true,
      organization: { isActive: true },
    },
  });

  if (!membership) {
    redirect("/select-org");
  }

  return organizationId;
}

export type DashboardAccess =
  | { ok: true; path: string }
  | { ok: false; reason: "inactive" | "no_org" | "org_inactive" };

export async function resolveDashboardAccess(
  session: AppSession,
): Promise<DashboardAccess> {
  const dbUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { isActive: true, organizationId: true },
  });

  if (!dbUser?.isActive) {
    return { ok: false, reason: "inactive" };
  }

  const role = await resolveUserRole(session);
  if (role === "SUPER_ADMIN") {
    return { ok: true, path: dashboardPathForRole(role) };
  }

  const memberships = await getOrgMemberships(session.user.id);
  if (memberships.length === 0) {
    return { ok: false, reason: "no_org" };
  }

  if (memberships.length > 1) {
    return { ok: true, path: "/select-org" };
  }

  const m = memberships[0];
  if (dbUser.organizationId !== m.organizationId) {
    await switchActiveOrg(session.user.id, m.organizationId);
  }

  return { ok: true, path: dashboardPathForRole(m.role) };
}

async function assertOrgActive(session: AppSession, role: Role) {
  if (role === "SUPER_ADMIN") return;
  await requireActiveOrganizationId(session.user.id);
}

export async function requireSession() {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }
  return session;
}

export async function requireRole(allowed: Role[]) {
  const session = await requireSession();
  const role = await resolveUserRole(session);

  const dbUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { isActive: true, organizationId: true, role: true },
  });

  if (!dbUser?.isActive) {
    redirect("/login?error=inactive");
  }

  await assertOrgActive(session, role);

  if (!allowed.includes(role)) {
    redirect(dashboardPathForRole(role));
  }

  // Fresh org/role for all callers (never stale cookie values)
  (session.user as { organizationId?: string | null }).organizationId =
    dbUser.organizationId;
  (session.user as { role?: string }).role = dbUser.role;

  return session;
}

export function dashboardPathForRole(role: Role | string) {
  switch (role) {
    case "SUPER_ADMIN":
      return "/super-admin";
    case "ORG_ADMIN":
      return "/org-admin";
    case "TEACHER":
      return "/teacher";
    default:
      return "/login";
  }
}

export function canViewAllOrgTests(role: Role | string) {
  return role === "SUPER_ADMIN" || role === "ORG_ADMIN";
}

export function canManageQuestionBank(role: Role | string) {
  return role === "SUPER_ADMIN";
}

export async function getOrgMemberships(userId: string) {
  return prisma.orgMembership.findMany({
    where: { userId, isActive: true, organization: { isActive: true } },
    include: {
      organization: {
        select: { id: true, name: true, slug: true, logoUrl: true, isActive: true },
      },
    },
    orderBy: { createdAt: "asc" },
  });
}

export async function switchActiveOrg(userId: string, organizationId: string) {
  const membership = await prisma.orgMembership.findUnique({
    where: { userId_organizationId: { userId, organizationId } },
    include: { organization: { select: { isActive: true } } },
  });
  if (!membership || !membership.isActive || !membership.organization.isActive) {
    throw new Error("Invalid organization membership");
  }
  await prisma.user.update({
    where: { id: userId },
    data: { organizationId, role: membership.role },
  });
  return membership;
}
