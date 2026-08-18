import { cache } from "react";
import { AppShell } from "@/components/app-shell";
import { getOrganizationName } from "@/lib/cached-queries";
import { requireRole, getOrgMemberships } from "@/lib/rbac";

const nav = [
  { href: "/org-admin", label: "Overview", icon: "overview" as const },
  { href: "/org-admin/sections", label: "Sections", icon: "hierarchy" as const },
  { href: "/org-admin/students", label: "Students", icon: "students" as const },
  { href: "/org-admin/results", label: "Results", icon: "results" as const },
  { href: "/org-admin/fees", label: "Fees", icon: "fees" as const },
  { href: "/org-admin/teachers", label: "Teachers", icon: "teachers" as const },
  { href: "/org-admin/teachers/new", label: "Add Teacher", icon: "teachers" as const },
  { href: "/org-admin/schedules", label: "Schedules", icon: "schedule" as const },
  { href: "/org-admin/generate", label: "Generate Paper", icon: "generate" as const },
  { href: "/org-admin/tests", label: "Tests", icon: "tests" as const },
  { href: "/org-admin/profile", label: "Profile", icon: "profile" as const },
];

export default async function OrgAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireRole(["ORG_ADMIN"]);
  const [orgName, memberships] = await Promise.all([
    session.user.organizationId
      ? getOrganizationName(session.user.organizationId)
      : Promise.resolve(null),
    getOrgMemberships(session.user.id),
  ]);

  return (
    <AppShell
      title="Org Admin"
      subtitle={session.user.name}
      organizationName={orgName}
      nav={nav}
      showOrgSwitcher={memberships.length > 1}
    >
      {children}
    </AppShell>
  );
}
