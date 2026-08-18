import Link from "next/link";
import { Users, FileText, CalendarClock, GraduationCap, WalletCards, Trophy } from "lucide-react";
import { Card, CardTitle } from "@/components/ui/card";
import { PageHeader, PageStack } from "@/components/page-header";
import { prisma } from "@/lib/prisma";
import { flagsFromOrg } from "@/lib/org-modules";
import { requireRole } from "@/lib/rbac";

export default async function OrgAdminPage() {
  const session = await requireRole(["ORG_ADMIN"]);
  const organizationId = session.user.organizationId;

  if (!organizationId) {
    return (
      <PageStack>
        <PageHeader
          title="Organization"
          description="No organization is linked to this account."
        />
      </PageStack>
    );
  }

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
    feeCollection,
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
        take: 5,
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
      prisma.feePayment.aggregate({
        where: { organizationId },
        _sum: { amount: true },
      }),
    ]);

  const modules = flagsFromOrg(org);
  const extras = [
    modules.STUDENTS ? "students" : null,
    "teachers",
    modules.RESULTS ? "results" : null,
    modules.FEES ? "fees" : null,
    modules.SCHEDULES ? "schedules" : null,
    "papers",
  ].filter(Boolean);
  const description = `Manage ${extras.join(", ")} for your organization.`;

  return (
    <PageStack wide>
      <PageHeader
        kicker={org.isActive ? "Active organization" : "Inactive organization"}
        title={org.name}
        description={description}
      />

      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
        {modules.STUDENTS ? (
        <Link href="/org-admin/students" className="block">
          <Card className="group relative min-h-[10rem] cursor-pointer overflow-hidden bg-gradient-to-br from-[#eef7ff] to-white transition-all duration-300 hover:-translate-y-1 hover:shadow-lg">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-muted">Students</p>
                <CardTitle className="mt-2 text-[2.6rem] leading-none tracking-tight">
                  {studentCount}
                </CardTitle>
                <p className="mt-3 text-sm text-muted">
                  {activeStudents} active · {studentCount - activeStudents} inactive
                </p>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-500/10 text-blue-700 transition-transform duration-300 group-hover:scale-110">
                <GraduationCap className="h-6 w-6" />
              </div>
            </div>
          </Card>
        </Link>
        ) : null}

        <Link href="/org-admin/teachers" className="block">
          <Card className="group relative min-h-[10rem] cursor-pointer overflow-hidden bg-gradient-to-br from-[#e8f7f4] to-white transition-all duration-300 hover:-translate-y-1 hover:shadow-lg">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-muted">Teachers</p>
                <CardTitle className="mt-2 text-[2.6rem] leading-none tracking-tight">
                  {teacherCount}
                </CardTitle>
                <p className="mt-3 text-sm text-muted">
                  {activeTeachers} active · {teacherCount - activeTeachers} inactive
                </p>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand/10 text-brand transition-transform duration-300 group-hover:scale-110">
                <Users className="h-6 w-6" />
              </div>
            </div>
          </Card>
        </Link>

        {modules.RESULTS ? (
        <Link href="/org-admin/results" className="block">
          <Card className="group relative min-h-[10rem] cursor-pointer overflow-hidden bg-gradient-to-br from-[#fff4e8] to-white transition-all duration-300 hover:-translate-y-1 hover:shadow-lg">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-muted">Results</p>
                <CardTitle className="mt-2 text-[2.6rem] leading-none tracking-tight">
                  Compile
                </CardTitle>
                <p className="mt-3 text-sm text-muted">Section-wise marks and gazette</p>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-orange-500/10 text-orange-700 transition-transform duration-300 group-hover:scale-110">
                <Trophy className="h-6 w-6" />
              </div>
            </div>
          </Card>
        </Link>
        ) : null}

        {modules.FEES ? (
        <Link href="/org-admin/fees" className="block">
          <Card className="group relative min-h-[10rem] cursor-pointer overflow-hidden bg-gradient-to-br from-[#f3edff] to-white transition-all duration-300 hover:-translate-y-1 hover:shadow-lg">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-muted">Fee Collection</p>
                <CardTitle className="mt-2 text-2xl leading-none tracking-tight">
                  PKR {Number(feeCollection._sum.amount ?? 0).toLocaleString()}
                </CardTitle>
                <p className="mt-3 text-sm text-muted">All recorded payments</p>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-violet-500/10 text-violet-700 transition-transform duration-300 group-hover:scale-110">
                <WalletCards className="h-6 w-6" />
              </div>
            </div>
          </Card>
        </Link>
        ) : null}

        {modules.SCHEDULES ? (
        <Link href="/org-admin/schedules" className="block">
          <Card className="group relative min-h-[10rem] cursor-pointer overflow-hidden bg-gradient-to-br from-[#fff7eb] to-white transition-all duration-300 hover:-translate-y-1 hover:shadow-lg">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-muted">Schedules</p>
                <CardTitle className="mt-2 text-[2.6rem] leading-none tracking-tight">
                  {activeSchedules}
                </CardTitle>
                <p className="mt-3 text-sm text-muted">Active test schedules</p>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#8a5a00]/10 text-[#8a5a00] transition-transform duration-300 group-hover:scale-110">
                <CalendarClock className="h-6 w-6" />
              </div>
            </div>
          </Card>
        </Link>
        ) : null}

        <Link href="/org-admin/tests" className="block">
          <Card className="group relative min-h-[10rem] cursor-pointer overflow-hidden bg-gradient-to-br from-[#eaf1f8] to-white transition-all duration-300 hover:-translate-y-1 hover:shadow-lg">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-muted">Papers</p>
                <CardTitle className="mt-2 text-[2.6rem] leading-none tracking-tight">
                  {testCount}
                </CardTitle>
                <p className="mt-3 text-sm text-muted">
                  {finalTests} finalized · {testCount - finalTests} drafts
                </p>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#1a3350]/10 text-[#1a3350] transition-transform duration-300 group-hover:scale-110">
                <FileText className="h-6 w-6" />
              </div>
            </div>
          </Card>
        </Link>
      </div>

      {recentTests.length > 0 ? (
        <Card className="chart-card stagger-1">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle>Recent papers</CardTitle>
              <p className="mt-1 text-sm text-muted">
                Latest papers created by teachers in {org.name}.
              </p>
            </div>
            <Link
              href="/org-admin/tests"
              className="text-sm font-semibold text-brand hover:underline"
            >
              See all →
            </Link>
          </div>

          <div className="mt-5 list-stack">
            {recentTests.map((test) => (
              <div
                key={test.id}
                className="flex flex-col gap-2 rounded-[0.9rem] border border-[rgba(15,40,70,0.08)] bg-white/85 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0 text-left">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-sm font-semibold text-ink">{test.title}</p>
                    <span
                      className={
                        test.status === "FINAL"
                          ? "status-chip status-chip-success"
                          : "status-chip status-chip-warn"
                      }
                    >
                      {test.status}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted">
                    {test.teacher.name} · {test.subject?.name ?? "Subject"} ·{" "}
                    {test._count.questions} questions · {test.totalMarks} marks
                  </p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      ) : null}
    </PageStack>
  );
}
