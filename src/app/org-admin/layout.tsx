import { AppShell } from "@/components/app-shell";
import { requireRole, getOrgMemberships } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";

const nav = [
  { href: "/org-admin", label: "Overview", icon: "overview" as const },
  { href: "/org-admin/sections", label: "Sections", icon: "hierarchy" as const },
  { href: "/org-admin/teachers", label: "Teachers", icon: "teachers" as const },
  { href: "/org-admin/teachers/new", label: "Add Teacher", icon: "teachers" as const },
  { href: "/org-admin/schedules", label: "Schedules", icon: "schedule" as const },
  { href: "/org-admin/tests", label: "Tests", icon: "tests" as const },
  { href: "/org-admin/profile", label: "Profile", icon: "profile" as const },
];

export default async function OrgAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireRole(["ORG_ADMIN"]);
  const [org, memberships] = await Promise.all([
    session.user.organizationId
      ? prisma.organization.findUnique({
          where: { id: session.user.organizationId },
          select: { name: true },
        })
      : null,
    getOrgMemberships(session.user.id),
  ]);

  return (
    <AppShell
      title="Org Admin"
      subtitle={session.user.name}
      organizationName={org?.name}
      nav={nav}
      showOrgSwitcher={memberships.length > 1}
    >
      {children}
    </AppShell>
  );
}
