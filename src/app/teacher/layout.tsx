import { AppShell } from "@/components/app-shell";
import { getTeacherSubjectNames, getOrganizationName } from "@/lib/cached-queries";
import { requireRole, getOrgMemberships } from "@/lib/rbac";

const nav = [
  { href: "/teacher", label: "Overview", icon: "overview" as const },
  { href: "/teacher/schedules", label: "Assigned Tests", icon: "schedule" as const },
  { href: "/teacher/tests", label: "Saved Papers", icon: "tests" as const },
  { href: "/teacher/generate", label: "Generate Paper", icon: "generate" as const },
  { href: "/teacher/suggestions", label: "Suggest Question", icon: "suggest" as const },
];

export default async function TeacherLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireRole(["TEACHER"]);
  const [memberships, orgName, subjectNames] = await Promise.all([
    getOrgMemberships(session.user.id),
    session.user.organizationId
      ? getOrganizationName(session.user.organizationId)
      : Promise.resolve(null),
    getTeacherSubjectNames(session.user.id),
  ]);

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
      nav={nav}
      showOrgSwitcher={memberships.length > 1}
    >
      {children}
    </AppShell>
  );
}
