import Link from "next/link";
import {
  Users,
  FileText,
  CalendarClock,
  GraduationCap,
  WalletCards,
  Trophy,
  UserPlus,
  FilePlus2,
  Layers,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader, PageStack } from "@/components/page-header";
import { prisma } from "@/lib/prisma";
import { flagsFromOrg } from "@/lib/org-modules";
import { requireRole } from "@/lib/rbac";

function pct(part: number, total: number) {
  if (total <= 0) return 0;
  return Math.round((part / total) * 100);
}

function BarRow({
  label,
  value,
  total,
}: {
  label: string;
  value: number;
  total: number;
}) {
  const width = total > 0 ? Math.max((value / total) * 100, value > 0 ? 6 : 0) : 0;
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-3 text-[0.92rem]">
        <span className="text-ink-soft">{label}</span>
        <span className="font-semibold text-ink">
          {value}
          <span className="ml-1 text-sm font-medium text-muted">({pct(value, total)}%)</span>
        </span>
      </div>
      <div className="org-dash-bar-track">
        <div className="org-dash-bar-fill" style={{ width: `${width}%` }} />
      </div>
    </div>
  );
}

export default async function OrgAdminPage() {
  const session = await requireRole(["ORG_ADMIN"]);
  const organizationId = session.user.organizationId;

  if (!organizationId) {
    return (
      <PageStack>
        <PageHeader
          kicker="Overview"
          title="Dashboard"
          description="No organization is linked to this account. Ask Super Admin to assign you to a school."
        />
      </PageStack>
    );
  }

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const [
    org,
    teacherCount,
    activeTeachers,
    testCount,
    finalTests,
    recentTests,
    activeSchedules,
    studentCount,
    activeStudents,
    sectionCount,
    feeCollection,
    unpaidCharges,
    upcomingSubjects,
  ] = await Promise.all([
    prisma.organization.findUniqueOrThrow({
      where: { id: organizationId },
      select: {
        name: true,
        isActive: true,
        moduleStudents: true,
        moduleResults: true,
        moduleFees: true,
        moduleSchedules: true,
      },
    }),
    prisma.orgMembership.count({ where: { organizationId, role: "TEACHER" } }),
    prisma.orgMembership.count({
      where: { organizationId, role: "TEACHER", isActive: true },
    }),
    prisma.test.count({ where: { organizationId } }),
    prisma.test.count({ where: { organizationId, status: "FINAL" } }),
    prisma.test.findMany({
      where: { organizationId },
      orderBy: { updatedAt: "desc" },
      take: 6,
      include: {
        teacher: { select: { name: true } },
        subject: { select: { name: true } },
        _count: { select: { questions: true } },
      },
    }),
    prisma.testSchedule.count({
      where: { organizationId, status: "ACTIVE" },
    }),
    prisma.student.count({ where: { organizationId } }),
    prisma.student.count({ where: { organizationId, isActive: true } }),
    prisma.section.count({ where: { organizationId } }),
    prisma.feePayment.aggregate({
      where: { organizationId },
      _sum: { amount: true },
    }),
    prisma.feeCharge.count({
      where: { organizationId, status: { in: ["UNPAID", "PARTIAL"] } },
    }),
    prisma.testScheduleSubject.findMany({
      where: {
        testDate: { gte: startOfToday },
        round: { schedule: { organizationId, status: "ACTIVE" } },
      },
      orderBy: { testDate: "asc" },
      take: 6,
      select: {
        id: true,
        subjectName: true,
        testDate: true,
        round: {
          select: {
            name: true,
            schedule: { select: { id: true, name: true } },
          },
        },
      },
    }),
  ]);

  const modules = flagsFromOrg(org);
  const draftTests = Math.max(testCount - finalTests, 0);
  const inactiveTeachers = Math.max(teacherCount - activeTeachers, 0);
  const inactiveStudents = Math.max(studentCount - activeStudents, 0);
  const firstName = session.user.name?.split(" ")[0] ?? "Admin";

  const actions = [
    modules.STUDENTS
      ? {
          href: "/org-admin/students/new",
          title: "Add student",
          hint: "Admit a student to a section",
          icon: GraduationCap,
        }
      : null,
    {
      href: "/org-admin/teachers/new",
      title: "Add teacher",
      hint: "Create an account and assignments",
      icon: UserPlus,
    },
    modules.SCHEDULES
      ? {
          href: "/org-admin/schedules/new",
          title: "Create schedule",
          hint: "Plan rounds and paper dates",
          icon: CalendarClock,
        }
      : null,
    {
      href: "/org-admin/generate",
      title: "Generate paper",
      hint: "Build an exam paper",
      icon: FilePlus2,
    },
    modules.RESULTS
      ? {
          href: "/org-admin/results",
          title: "Compile results",
          hint: "Marks entry and gazette",
          icon: Trophy,
        }
      : null,
    modules.FEES
      ? {
          href: "/org-admin/fees/collect",
          title: "Collect fees",
          hint:
            unpaidCharges > 0 ? `${unpaidCharges} dues outstanding` : "Record a payment",
          icon: WalletCards,
        }
      : null,
  ].filter(Boolean) as Array<{
    href: string;
    title: string;
    hint: string;
    icon: typeof Users;
  }>;

  const stats = [
    modules.STUDENTS
      ? {
          label: "Students",
          value: studentCount,
          hint: `${activeStudents} active · ${inactiveStudents} inactive`,
          icon: GraduationCap,
          href: "/org-admin/students",
        }
      : null,
    {
      label: "Teachers",
      value: teacherCount,
      hint: `${activeTeachers} active · ${inactiveTeachers} inactive`,
      icon: Users,
      href: "/org-admin/teachers",
    },
    {
      label: "Papers",
      value: testCount,
      hint: `${finalTests} finalized · ${draftTests} drafts`,
      icon: FileText,
      href: "/org-admin/tests",
    },
    {
      label: "Sections",
      value: sectionCount,
      hint: "Class sections in this school",
      icon: Layers,
      href: "/org-admin/sections",
    },
    modules.SCHEDULES
      ? {
          label: "Schedules",
          value: activeSchedules,
          hint: "Active test schedules",
          icon: CalendarClock,
          href: "/org-admin/schedules",
        }
      : null,
    modules.FEES
      ? {
          label: "Fee collection",
          value: `PKR ${Number(feeCollection._sum.amount ?? 0).toLocaleString()}`,
          hint:
            unpaidCharges > 0
              ? `${unpaidCharges} unpaid or partial dues`
              : "All recorded payments",
          icon: WalletCards,
          href: "/org-admin/fees",
        }
      : null,
  ].filter(Boolean) as Array<{
    label: string;
    value: string | number;
    hint: string;
    icon: typeof Users;
    href: string;
  }>;

  return (
    <PageStack wide>
      <PageHeader
        kicker={org.isActive ? "Overview" : "Inactive organization"}
        title="Dashboard"
        description={`Welcome back, ${firstName}. Manage people, papers, and operations for ${org.name}.`}
        actions={
          <div className="flex flex-wrap gap-2">
            <Link href="/org-admin/generate">
              <Button>
                <FilePlus2 className="h-4 w-4" />
                Generate paper
              </Button>
            </Link>
            <Link href="/org-admin/teachers/new">
              <Button variant="secondary">
                <UserPlus className="h-4 w-4" />
                Add teacher
              </Button>
            </Link>
          </div>
        }
      />

      {!org.isActive ? (
        <div className="flex items-start gap-3 rounded-[0.95rem] border border-amber-200 bg-amber-50 px-4 py-3 text-[0.95rem] text-amber-900">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
          <p>
            This organization is inactive. Teachers cannot sign in until Super Admin
            reactivates it.
          </p>
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {actions.map((action) => {
          const Icon = action.icon;
          return (
            <Link key={action.href} href={action.href} className="org-dash-card org-dash-action">
              <span className="org-dash-icon">
                <Icon className="h-4 w-4" />
              </span>
              <span>
                <p className="org-dash-action-title">{action.title}</p>
                <p className="org-dash-card-hint">{action.hint}</p>
              </span>
            </Link>
          );
        })}
      </div>

      <div
        className={
          stats.length >= 4
            ? "stats-grid stats-grid-4"
            : "grid gap-3 sm:grid-cols-2 xl:grid-cols-3"
        }
      >
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Link key={stat.label} href={stat.href} className="org-dash-card">
              <div className="org-dash-card-head">
                <p className="org-dash-card-label">{stat.label}</p>
                <span className="org-dash-icon">
                  <Icon className="h-4 w-4" />
                </span>
              </div>
              <p className="org-dash-card-value">{stat.value}</p>
              <p className="org-dash-card-hint">{stat.hint}</p>
            </Link>
          );
        })}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="org-dash-panel">
          <h3 className="font-display text-lg font-semibold text-ink">
            {modules.STUDENTS ? "People snapshot" : "Staff snapshot"}
          </h3>
          <p className="mt-1 text-sm text-muted">
            {modules.STUDENTS
              ? "Active versus inactive records in this school."
              : "Teachers currently linked to this organization."}
          </p>
          <div className="mt-5 space-y-4">
            {modules.STUDENTS ? (
              <>
                <BarRow label="Active students" value={activeStudents} total={Math.max(studentCount, 1)} />
                <BarRow
                  label="Inactive students"
                  value={inactiveStudents}
                  total={Math.max(studentCount, 1)}
                />
              </>
            ) : null}
            <BarRow
              label="Active teachers"
              value={activeTeachers}
              total={Math.max(teacherCount, 1)}
            />
            {!modules.STUDENTS ? (
              <BarRow
                label="Inactive teachers"
                value={inactiveTeachers}
                total={Math.max(teacherCount, 1)}
              />
            ) : null}
          </div>
        </div>

        <div className="org-dash-panel">
          <h3 className="font-display text-lg font-semibold text-ink">Paper status</h3>
          <p className="mt-1 text-sm text-muted">
            Finalized papers versus drafts across the school.
          </p>
          <div className="mt-5 space-y-4">
            <BarRow label="Finalized" value={finalTests} total={Math.max(testCount, 1)} />
            <BarRow label="Drafts" value={draftTests} total={Math.max(testCount, 1)} />
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            <Link href="/org-admin/generate">
              <Button size="sm">
                <FilePlus2 className="h-4 w-4" />
                Generate paper
              </Button>
            </Link>
            <Link href="/org-admin/tests">
              <Button size="sm" variant="outline">
                <FileText className="h-4 w-4" />
                View papers
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {modules.SCHEDULES && upcomingSubjects.length > 0 ? (
        <div className="org-dash-panel">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="font-display text-lg font-semibold text-ink">Upcoming tests</h3>
              <p className="mt-1 text-sm text-muted">Next scheduled papers for your teachers.</p>
            </div>
            <Link
              href="/org-admin/schedules"
              className="text-[0.95rem] font-semibold text-brand hover:underline"
            >
              View schedules →
            </Link>
          </div>
          <div className="mt-4">
            {upcomingSubjects.map((item) => (
              <Link
                key={item.id}
                href={`/org-admin/schedules/${item.round.schedule.id}`}
                className="org-dash-row"
              >
                <span>
                  <span className="org-dash-row-title">{item.subjectName}</span>
                  <span className="mt-0.5 block text-sm text-muted">
                    {item.round.schedule.name} · {item.round.name}
                  </span>
                </span>
                <span className="text-sm font-semibold text-ink-soft">
                  {item.testDate.toLocaleDateString()}
                </span>
              </Link>
            ))}
          </div>
        </div>
      ) : null}

      <div className="org-dash-panel">
        {recentTests.length > 0 ? (
          <>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="font-display text-lg font-semibold text-ink">Recent papers</h3>
                <p className="mt-1 text-sm text-muted">Latest papers created for {org.name}.</p>
              </div>
              <Link
                href="/org-admin/tests"
                className="text-[0.95rem] font-semibold text-brand hover:underline"
              >
                See all →
              </Link>
            </div>
            <div className="mt-4">
              {recentTests.map((test) => (
                <Link
                  key={test.id}
                  href={`/org-admin/tests/${test.id}/print`}
                  className="org-dash-row"
                >
                  <span className="min-w-0">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="org-dash-row-title truncate">{test.title}</span>
                      <span
                        className={
                          test.status === "FINAL"
                            ? "status-chip status-chip-success"
                            : "status-chip status-chip-warn"
                        }
                      >
                        {test.status === "FINAL" ? "Final" : "Draft"}
                      </span>
                    </span>
                    <span className="mt-0.5 block text-sm text-muted">
                      {test.teacher.name} · {test.subject?.name ?? "Subject"} ·{" "}
                      {test._count.questions} questions · {test.totalMarks} marks
                    </span>
                  </span>
                </Link>
              ))}
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <FileText className="h-10 w-10 text-muted/40" />
            <div>
              <h3 className="font-display text-lg font-semibold text-ink">No papers yet</h3>
              <p className="mt-1 text-sm text-muted">
                Generate the first paper for {org.name} to see activity here.
              </p>
            </div>
            <Link href="/org-admin/generate">
              <Button>Generate paper</Button>
            </Link>
          </div>
        )}
      </div>
    </PageStack>
  );
}
