import { AppShell, type NavIcon } from "@/components/app-shell";
import { getOrganizationName } from "@/lib/cached-queries";
import { getOrgModuleFlags } from "@/lib/org-modules";
import { requireRole, getOrgMemberships } from "@/lib/rbac";

const nav: Array<{
  href: string;
  label: string;
  icon: NavIcon;
  module?: "STUDENTS" | "RESULTS" | "FEES" | "SCHEDULES";
}> = [
  { href: "/org-admin", label: "Overview", icon: "overview" },
  { href: "/org-admin/sections", label: "Sections", icon: "hierarchy" },
  { href: "/org-admin/students", label: "Students", icon: "students", module: "STUDENTS" },
  { href: "/org-admin/results", label: "Results", icon: "results", module: "RESULTS" },
  { href: "/org-admin/fees", label: "Fees", icon: "fees", module: "FEES" },
  { href: "/org-admin/teachers", label: "Teachers", icon: "teachers" },
  { href: "/org-admin/teachers/new", label: "Add Teacher", icon: "teachers" },
  { href: "/org-admin/schedules", label: "Schedules", icon: "schedule", module: "SCHEDULES" },
  { href: "/org-admin/generate", label: "Generate Test", icon: "generate" },
  { href: "/org-admin/tests", label: "Tests", icon: "tests" },
  { href: "/org-admin/profile", label: "Profile", icon: "profile" },
];

export default async function OrgAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireRole(["ORG_ADMIN"]);
  const organizationId = session.user.organizationId;
  const [orgName, memberships, modules] = await Promise.all([
    organizationId ? getOrganizationName(organizationId) : Promise.resolve(null),
    getOrgMemberships(session.user.id),
    organizationId
      ? getOrgModuleFlags(organizationId)
      : Promise.resolve({
          STUDENTS: false,
          RESULTS: false,
          FEES: false,
          SCHEDULES: false,
        }),
  ]);
  const visibleNav = nav.filter((item) => !item.module || modules[item.module]);

  return (
    <AppShell
      title="Org Admin"
      subtitle={session.user.name}
      organizationName={orgName}
      nav={visibleNav}
      showOrgSwitcher={memberships.length > 1}
    >
      {children}
    </AppShell>
  );
}
