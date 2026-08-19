import { AppShell } from "@/components/app-shell";
import { getTeacherSubjectNames, getOrganizationName } from "@/lib/cached-queries";
import { getOrgModuleFlags } from "@/lib/org-modules";
import { requireRole, getOrgMemberships } from "@/lib/rbac";

const nav = [
  { href: "/teacher", label: "Overview", icon: "overview" as const },
  { href: "/teacher/schedules", label: "Assigned Tests", icon: "schedule" as const, module: "SCHEDULES" as const },
  { href: "/teacher/tests", label: "Saved Tests", icon: "tests" as const },
  { href: "/teacher/generate", label: "Generate Test", icon: "generate" as const },
  { href: "/teacher/suggestions", label: "Suggest Question", icon: "suggest" as const },
];

export default async function TeacherLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireRole(["TEACHER"]);
  const organizationId = session.user.organizationId;
  const [memberships, orgName, subjectNames, modules] = await Promise.all([
    getOrgMemberships(session.user.id),
    organizationId ? getOrganizationName(organizationId) : Promise.resolve(null),
    getTeacherSubjectNames(session.user.id),
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

  const titleMeta =
    subjectNames.length === 0
      ? null
      : subjectNames.length <= 2
        ? subjectNames.join(", ")
        : `${subjectNames.slice(0, 2).join(", ")} +${subjectNames.length - 2}`;

  return (
    <AppShell
      title="Teacher"
      titleMeta={titleMeta}
      subtitle={session.user.name}
      organizationName={orgName}
      nav={visibleNav}
      showOrgSwitcher={memberships.length > 1}
    >
      {children}
    </AppShell>
  );
}
