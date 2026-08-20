import Link from "next/link";
import { FileText, FilePlus2, CheckCircle2, AlertTriangle } from "lucide-react";
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

      <div className="grid grid-cols-2 gap-3 sm:gap-5">
        <Link href="/teacher/tests" className="block min-w-0">
          <Card className="group h-full min-h-[7.25rem] cursor-pointer bg-gradient-to-br from-[#eaf1f8] to-card p-4 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg sm:min-h-[9rem] sm:p-6">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-xs font-medium text-muted sm:text-sm">Total Tests</p>
                <CardTitle className="mt-1.5 text-[1.65rem] leading-none sm:mt-2 sm:text-[2.4rem]">
                  {totalCount}
                </CardTitle>
              </div>
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#1a3350]/10 text-[#1a3350] transition-transform duration-300 group-hover:scale-110 sm:h-11 sm:w-11">
                <FileText className="h-4 w-4 sm:h-5 sm:w-5" />
              </div>
            </div>
          </Card>
        </Link>

        <Link href="/teacher/tests?status=FINAL" className="block min-w-0">
          <Card className="group h-full min-h-[7.25rem] cursor-pointer bg-gradient-to-br from-[#e8f7f4] to-card p-4 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg sm:min-h-[9rem] sm:p-6">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-xs font-medium text-muted sm:text-sm">Saved Tests</p>
                <CardTitle className="mt-1.5 text-[1.65rem] leading-none sm:mt-2 sm:text-[2.4rem]">
                  {finalCount}
                </CardTitle>
                <p className="mt-1 text-[10px] leading-snug text-muted sm:mt-2 sm:text-xs">
                  Ready to edit or export
                </p>
              </div>
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand/10 text-brand transition-transform duration-300 group-hover:scale-110 sm:h-11 sm:w-11">
                <CheckCircle2 className="h-4 w-4 sm:h-5 sm:w-5" />
              </div>
            </div>
          </Card>
        </Link>
      </div>

      {openAssignments.length > 0 ? (
        <Card className="chart-card">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle>My Assigned Tests</CardTitle>
              <p className="mt-1 text-sm text-muted">
                Upcoming and pending tests assigned by your organization admin.
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
                className="flex flex-col gap-3 rounded-[0.9rem] border border-[rgba(15,40,70,0.08)] bg-card/85 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
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
                  {item.dueTomorrow ? (
                    <p className="mt-1 flex items-center gap-1 text-xs font-semibold text-[#8a5a00]">
                      <AlertTriangle className="h-3.5 w-3.5" />
                      Test due tomorrow
                    </p>
                  ) : null}
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
                className="flex items-center justify-between rounded-[0.9rem] border border-[rgba(15,40,70,0.08)] bg-card/85 px-4 py-3 transition-colors hover:bg-mist"
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
                <span
                  className={
                    "status-chip status-chip-success"
                  }
                >
                  Final
                </span>
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
