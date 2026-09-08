import Link from "next/link";
import { FileText, FilePlus2, CheckCircle2, CalendarClock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { PageHeader, PageStack } from "@/components/page-header";
import { prisma } from "@/lib/prisma";
import { requireRole, requireActiveOrganizationId } from "@/lib/rbac";
import { orgHasModule } from "@/lib/org-modules";
import { statusChipClass } from "@/lib/test-schedule-status";
import { getMyAssignedTestSchedules } from "./schedules/actions";

export default async function TeacherPage() {
  const session = await requireRole(["TEACHER"]);
  const organizationId = await requireActiveOrganizationId(session.user.id);

  const [finalCount, recentTests, org, schedulesEnabled] = await Promise.all([
    prisma.test.count({
      where: { teacherId: session.user.id, organizationId, status: "FINAL" },
    }),
    prisma.test.findMany({
      where: { teacherId: session.user.id, organizationId },
      orderBy: { updatedAt: "desc" },
      take: 5,
      include: {
        subject: { select: { name: true } },
        _count: { select: { questions: true } },
      },
    }),
    prisma.organization.findUnique({
      where: { id: organizationId },
      select: { name: true },
    }),
    orgHasModule(organizationId, "SCHEDULES"),
  ]);
  const assigned = schedulesEnabled ? await getMyAssignedTestSchedules() : [];

  const totalCount = finalCount;
  const openAssignments = assigned
    .filter((a) => a.status !== "COMPLETED")
    .sort((a, b) => {
      const rank = { OVERDUE: 0, PENDING: 1, UPCOMING: 2, COMPLETED: 3 };
      return rank[a.status] - rank[b.status];
    })
    .slice(0, 5);
  const openCount = assigned.filter((a) => a.status !== "COMPLETED").length;

  const stats = [
    {
      label: "Saved tests",
      value: totalCount,
      hint: "Ready to edit or export",
      toneClass: "org-dash-card-tone-tests",
      iconClass: "org-dash-icon-tone-tests",
      icon: FileText,
      href: "/teacher/tests",
    },
    {
      label: "Finalized",
      value: finalCount,
      hint: "Published papers",
      toneClass: "org-dash-card-tone-students",
      iconClass: "org-dash-icon-tone-students",
      icon: CheckCircle2,
      href: "/teacher/tests?status=FINAL",
    },
    schedulesEnabled
      ? {
          label: "Open assignments",
          value: openCount,
          hint: openCount > 0 ? "Assigned schedules" : "No open items",
          toneClass: "org-dash-card-tone-schedules",
          iconClass: "org-dash-icon-tone-schedules",
          icon: CalendarClock,
          href: "/teacher/schedules",
        }
      : null,
  ].filter(Boolean) as Array<{
    label: string;
    value: number;
    hint: string;
    toneClass: string;
    iconClass: string;
    icon: typeof FileText;
    href: string;
  }>;

  return (
    <PageStack wide>
      <PageHeader
        kicker="Workspace"
        title={`Welcome, ${session.user.name?.split(" ")[0] ?? "Teacher"}`}
        description={
          org?.name
            ? `Signed in to ${org.name}. Generate, manage, and export your tests.`
            : "Generate, manage, and export your tests."
        }
        actions={
          <Link href="/teacher/generate">
            <Button className="h-11 gap-2 px-5">
              <FilePlus2 className="h-4 w-4" />
              Generate Test
            </Button>
          </Link>
        }
      />

      <div className={`stats-grid ${stats.length >= 3 ? "stats-grid-3" : "stats-grid-2"}`}>
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Link key={stat.label} href={stat.href} className={`org-dash-card ${stat.toneClass}`}>
              <div className="org-dash-card-head">
                <p className="org-dash-card-label">{stat.label}</p>
                <span className={`org-dash-icon ${stat.iconClass}`}>
                  <Icon className="h-4 w-4" />
                </span>
              </div>
              <p className="org-dash-card-value">{stat.value}</p>
              <p className="org-dash-card-hint">{stat.hint}</p>
            </Link>
          );
        })}
      </div>

      {openAssignments.length > 0 ? (
        <Card className="chart-card">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle>My Assigned Tests</CardTitle>
              <p className="mt-1 text-sm text-muted">
                Open tests assigned by your organization admin.
              </p>
            </div>
            <Link
              href="/teacher/schedules"
              className="text-sm font-semibold text-brand hover:underline"
            >
              View all →
            </Link>
          </div>
          <div className="mt-4 list-stack">
            {openAssignments.map((item) => (
              <div
                key={item.assignmentId}
                className="flex flex-col gap-3 rounded-xl border border-line bg-card px-4 py-3 shadow-[var(--shadow-soft)] transition hover:border-brand/30 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-sm font-semibold text-ink">
                      {item.subjectName}
                    </p>
                    <span className={statusChipClass(item.status)}>{item.status}</span>
                  </div>
                  <p className="mt-0.5 text-xs text-muted">
                    {item.scheduleName} · {item.className}
                    {item.sectionName ? ` · ${item.sectionName}` : ""} · {item.testDateLabel}
                  </p>
                </div>
                <Link href={`/teacher/generate?assignmentId=${item.assignmentId}`}>
                  <Button size="sm" className="gap-1.5">
                    <FilePlus2 className="h-3.5 w-3.5" />
                    Create Test
                  </Button>
                </Link>
              </div>
            ))}
          </div>
        </Card>
      ) : null}

      {recentTests.length > 0 ? (
        <Card className="chart-card stagger-1">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <CardTitle>Recent Tests</CardTitle>
            <Link
              href="/teacher/tests"
              className="text-sm font-semibold text-brand hover:underline"
            >
              View all →
            </Link>
          </div>
          <div className="mt-4 list-stack">
            {recentTests.map((test) => (
              <Link
                key={test.id}
                href={`/teacher/tests/${test.id}`}
                className="flex items-center justify-between rounded-xl border border-line bg-card px-4 py-3 shadow-[var(--shadow-soft)] transition hover:border-brand/30 hover:shadow-[var(--shadow-elevated)]"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-ink">
                    {test.title}
                  </p>
                  <p className="mt-0.5 text-xs text-muted">
                    {test.subject?.name ?? "—"} · {test._count.questions} Q ·{" "}
                    {test.totalMarks} marks
                  </p>
                </div>
                <span className="status-chip status-chip-success">Final</span>
              </Link>
            ))}
          </div>
        </Card>
      ) : (
        <Card className="flex flex-col items-center gap-4 py-10 text-center">
          <FileText className="h-12 w-12 text-muted/40" />
          <div>
            <CardTitle>No tests yet</CardTitle>
            <p className="mt-1 text-sm text-muted">
              Generate your first test to get started.
            </p>
          </div>
          <Link href="/teacher/generate">
            <Button>Generate Test</Button>
          </Link>
        </Card>
      )}
    </PageStack>
  );
}
