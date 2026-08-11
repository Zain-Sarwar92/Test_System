import { AppShell } from "@/components/app-shell";
import { requireRole } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";

export default async function SuperAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireRole(["SUPER_ADMIN"]);
  const pendingSuggestions = await prisma.questionSuggestion.count({
    where: { status: "PENDING" },
  });

  const nav = [
    { href: "/super-admin", label: "Overview", icon: "overview" as const },
    {
      href: "/super-admin/organizations/list",
      label: "Organizations",
      icon: "organizations" as const,
    },
    {
      href: "/super-admin/hierarchy",
      label: "Curriculum",
      icon: "hierarchy" as const,
    },
    {
      href: "/super-admin/questions/list",
      label: "Question Bank",
      icon: "questionBank" as const,
    },
    {
      href: "/super-admin/questions",
      label: "Add Question",
      icon: "questions" as const,
    },
    {
      href: "/super-admin/suggestions",
      label: "Suggestions",
      icon: "suggestions" as const,
      badge: pendingSuggestions,
    },
    {
      href: "/super-admin/tests",
      label: "All Tests",
      icon: "tests" as const,
    },
    {
      href: "/super-admin/plans",
      label: "Plans",
      icon: "plans" as const,
    },
    {
      href: "/super-admin/settings",
      label: "Settings",
      icon: "settings" as const,
    },
  ];

  return (
    <AppShell title="Super Admin" subtitle={session.user.name} nav={nav}>
      {children}
    </AppShell>
  );
}
