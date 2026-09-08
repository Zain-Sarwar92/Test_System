import { AppShell, type NavIcon } from "@/components/app-shell";
import { getOrganizationName } from "@/lib/cached-queries";
import { getOrgDeskMode } from "@/lib/org-desk-mode";
import { getOrgModuleFlags } from "@/lib/org-modules";
import { requireRole, getOrgMemberships } from "@/lib/rbac";
import { DeskModeToggle } from "./desk-mode-toggle";

const fullNav: Array<{
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
  { href: "/org-admin/schedules", label: "Schedules", icon: "schedule", module: "SCHEDULES" },
  { href: "/org-admin/generate", label: "Generate Test", icon: "generate" },
  { href: "/org-admin/tests", label: "Tests", icon: "tests" },
  { href: "/org-admin/profile", label: "Profile", icon: "profile" },
];

const paperNav: Array<{
  href: string;
  label: string;
  icon: NavIcon;
}> = [
  { href: "/org-admin/generate", label: "Generate Test", icon: "generate" },
  { href: "/org-admin/tests", label: "Saved Tests", icon: "tests" },
  { href: "/org-admin/profile", label: "Profile", icon: "profile" },
];

export default async function OrgAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireRole(["ORG_ADMIN"]);
  const organizationId = session.user.organizationId;
  const [orgName, memberships, modules, deskMode] = await Promise.all([
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
    getOrgDeskMode(),
  ]);

  const visibleNav =
    deskMode === "paper"
      ? paperNav
      : fullNav.filter((item) => !item.module || modules[item.module]);

  return (
    <AppShell
      title={deskMode === "paper" ? "Paper Desk" : "Org Admin"}
      subtitle={session.user.name}
      organizationName={orgName}
      nav={visibleNav}
      showOrgSwitcher={memberships.length > 1 && deskMode === "full"}
      sidebarExtra={<DeskModeToggle mode={deskMode} />}
    >
      {children}
    </AppShell>
  );
}
