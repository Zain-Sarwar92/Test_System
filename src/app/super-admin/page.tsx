import Link from "next/link";
import {
  Building2,
  BookOpen,
  GraduationCap,
  ClipboardList,
  Inbox,
  BookPlus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { PageHeader, PageStack } from "@/components/page-header";
import { prisma } from "@/lib/prisma";

function pct(part: number, total: number) {
  if (total <= 0) return 0;
  return Math.round((part / total) * 100);
}

function BarRow({
  label,
  value,
  total,
  color,
  delayClass,
}: {
  label: string;
  value: number;
  total: number;
  color: string;
  delayClass: string;
}) {
  const width = total > 0 ? Math.max((value / total) * 100, value > 0 ? 4 : 0) : 0;
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="text-ink-soft">{label}</span>
        <span className="font-semibold text-ink">
          {value}
          <span className="ml-1 text-xs font-medium text-muted">
            ({pct(value, total)}%)
          </span>
        </span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-md bg-[rgba(15,40,70,0.08)]">
        <div
          className={`chart-bar h-full rounded-md ${delayClass}`}
          style={{ width: `${width}%`, background: color }}
        />
      </div>
    </div>
  );
}

export default async function SuperAdminPage() {
  const [
    orgCount,
    activeOrgCount,
    questionCount,
    shortCount,
    longCount,
    mcqCount,
    pendingSuggestions,
    approvedSuggestions,
    rejectedSuggestions,
    teacherCount,
    finalTests,
    orgBreakdown,
    testsLast7Days,
  ] = await Promise.all([
    prisma.organization.count(),
    prisma.organization.count({ where: { isActive: true } }),
    prisma.question.count({ where: { isActive: true } }),
    prisma.question.count({ where: { isActive: true, type: "SHORT" } }),
    prisma.question.count({ where: { isActive: true, type: "LONG" } }),
    prisma.question.count({ where: { isActive: true, type: "MCQ" } }),
    prisma.questionSuggestion.count({ where: { status: "PENDING" } }),
    prisma.questionSuggestion.count({ where: { status: "APPROVED" } }),
    prisma.questionSuggestion.count({ where: { status: "REJECTED" } }),
    prisma.user.count({ where: { role: "TEACHER" } }),
    prisma.test.count({ where: { status: "FINAL" } }),
    prisma.organization.findMany({
      orderBy: { createdAt: "desc" },
      take: 8,
      include: {
        _count: { select: { users: true, tests: true } },
        tests: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { createdAt: true },
        },
      },
    }),
    prisma.test.count({
      where: {
        createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
      },
    }),
  ]);

  const inactiveOrgs = Math.max(orgCount - activeOrgCount, 0);
  const suggestionTotal = pendingSuggestions + approvedSuggestions + rejectedSuggestions;
  const testTotal = finalTests;
  const questionTypeTotal = shortCount + longCount + mcqCount;

  const stats = [
    {
      label: "Organizations",
      value: orgCount,
      hint: `${activeOrgCount} active`,
      tone: "from-[#e8f7f4] to-white",
      icon: Building2,
      className: "stagger-1",
      href: "/super-admin/organizations/list",
    },
    {
      label: "Live questions",
      value: questionCount,
      hint: "Global bank",
      tone: "from-[#eaf1f8] to-white",
      icon: BookOpen,
      className: "stagger-2",
      href: "/super-admin/questions/list",
    },
    {
      label: "Teachers",
      value: teacherCount,
      hint: "Across all orgs",
      tone: "from-[#eef6f3] to-white",
      icon: GraduationCap,
      className: "stagger-3",
      href: "/super-admin/organizations/list",
    },
    {
      label: "Tests created",
      value: testTotal,
      hint: `${finalTests} finalized · ${testsLast7Days} last 7d`,
      tone: "from-[#f3f0ea] to-white",
      icon: ClipboardList,
      className: "stagger-4",
      href: "/super-admin/tests",
    },
  ];

  return (
    <PageStack>
      <PageHeader
        kicker="Control center"
        title="Dashboard"
        description="Platform health — tenants, question bank, and test activity."
        actions={
          pendingSuggestions > 0 ? (
            <Link href="/super-admin/suggestions">
              <Button variant="secondary">
                <Inbox className="h-4 w-4" />
                {pendingSuggestions} pending
              </Button>
            </Link>
          ) : null
        }
      />

      <div className="stats-grid stats-grid-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Link key={stat.label} href={stat.href}>
              <Card
                className={`chart-card ${stat.className} min-h-[8.5rem] bg-gradient-to-br ${stat.tone} transition-transform duration-300 hover:-translate-y-1`}
              >
                <div className="flex items-start justify-between gap-3">
                  <CardDescription>{stat.label}</CardDescription>
                  <span className="stat-icon">
                    <Icon className="h-4 w-4" />
                  </span>
                </div>
                <CardTitle className="mt-3 text-[2rem] md:text-[2.2rem]">
                  {stat.value}
                </CardTitle>
                <p className="mt-2 text-xs text-muted">{stat.hint}</p>
              </Card>
            </Link>
          );
        })}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="chart-card stagger-1">
          <CardTitle>Question mix</CardTitle>
          <CardDescription>
            Active questions by type in the global bank.
          </CardDescription>
          <div className="mt-6 space-y-4">
            <BarRow
              label="Short"
              value={shortCount}
              total={questionTypeTotal}
              color="linear-gradient(90deg, #0f766e, #2dd4bf)"
              delayClass="stagger-1"
            />
            <BarRow
              label="Long"
              value={longCount}
              total={questionTypeTotal}
              color="linear-gradient(90deg, #1a3350, #5b7c99)"
              delayClass="stagger-2"
            />
            <BarRow
              label="MCQ"
              value={mcqCount}
              total={questionTypeTotal}
              color="linear-gradient(90deg, #b45309, #f59e0b)"
              delayClass="stagger-3"
            />
          </div>
          {questionTypeTotal === 0 ? (
            <p className="mt-4 text-sm text-muted">No questions yet.</p>
          ) : null}
        </Card>

        <Card className="chart-card stagger-2">
          <CardTitle>Organization status</CardTitle>
          <CardDescription>Active vs inactive tenants.</CardDescription>
          <div className="mt-6 space-y-4">
            <BarRow
              label="Active"
              value={activeOrgCount}
              total={orgCount}
              color="linear-gradient(90deg, #0f766e, #34d399)"
              delayClass="stagger-1"
            />
            <BarRow
              label="Inactive"
              value={inactiveOrgs}
              total={orgCount}
              color="linear-gradient(90deg, #64748b, #94a3b8)"
              delayClass="stagger-2"
            />
          </div>
          <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="rounded-[0.9rem] bg-[#e8f7f4] px-4 py-3">
              <p className="text-xs text-muted">Active rate</p>
              <p className="mt-1 text-xl font-semibold text-brand-deep">
                {pct(activeOrgCount, orgCount)}%
              </p>
            </div>
            <div className="rounded-[0.9rem] bg-[#eaf1f8] px-4 py-3">
              <p className="text-xs text-muted">Total orgs</p>
              <p className="mt-1 text-xl font-semibold text-ink">{orgCount}</p>
            </div>
          </div>
        </Card>

        <Card className="chart-card stagger-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle>Suggestion pipeline</CardTitle>
              <CardDescription>Teacher contributions waiting for review.</CardDescription>
            </div>
            {pendingSuggestions > 0 ? (
              <span className="status-chip status-chip-warn">{pendingSuggestions} pending</span>
            ) : null}
          </div>
          <div className="mt-6 space-y-4">
            <BarRow
              label="Pending"
              value={pendingSuggestions}
              total={Math.max(suggestionTotal, 1)}
              color="linear-gradient(90deg, #b45309, #fbbf24)"
              delayClass="stagger-1"
            />
            <BarRow
              label="Approved"
              value={approvedSuggestions}
              total={Math.max(suggestionTotal, 1)}
              color="linear-gradient(90deg, #0f766e, #2dd4bf)"
              delayClass="stagger-2"
            />
            <BarRow
              label="Rejected"
              value={rejectedSuggestions}
              total={Math.max(suggestionTotal, 1)}
              color="linear-gradient(90deg, #b42318, #f97066)"
              delayClass="stagger-3"
            />
          </div>
        </Card>

        <Card className="chart-card stagger-4">
          <CardTitle>Test activity</CardTitle>
          <CardDescription>Saved and finalized tests by teachers.</CardDescription>
          <div className="mt-6 space-y-4">
            <BarRow
              label="Final"
              value={finalTests}
              total={Math.max(testTotal, 1)}
              color="linear-gradient(90deg, #0f766e, #14b8a6)"
              delayClass="stagger-1"
            />
          </div>
          <div className="mt-6 flex flex-wrap gap-2">
            <Link href="/super-admin/questions">
              <Button size="sm">
                <BookPlus className="h-4 w-4" />
                Add questions
              </Button>
            </Link>
            <Link href="/super-admin/suggestions">
              <Button size="sm" variant="secondary">
                <Inbox className="h-4 w-4" />
                Review suggestions
              </Button>
            </Link>
            <Link href="/super-admin/tests">
              <Button size="sm" variant="outline">
                <ClipboardList className="h-4 w-4" />
                All tests
              </Button>
            </Link>
          </div>
        </Card>
      </div>

      <Card className="chart-card">
        <CardTitle>Organizations at a glance</CardTitle>
        <CardDescription>Teachers, tests, and last activity per tenant.</CardDescription>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[520px] text-left text-sm">
            <thead>
              <tr className="border-b border-[rgba(15,40,70,0.08)] text-xs text-muted">
                <th className="py-2 pr-4 font-semibold">Organization</th>
                <th className="py-2 pr-4 font-semibold">Users</th>
                <th className="py-2 pr-4 font-semibold">Tests</th>
                <th className="py-2 font-semibold">Last test</th>
              </tr>
            </thead>
            <tbody>
              {orgBreakdown.map((org) => (
                <tr key={org.id} className="border-b border-[rgba(15,40,70,0.06)]">
                  <td className="py-2.5 pr-4">
                    <Link
                      href={`/super-admin/organizations/${org.id}`}
                      className="font-medium text-brand hover:underline"
                    >
                      {org.name}
                    </Link>
                  </td>
                  <td className="py-2.5 pr-4">{org._count.users}</td>
                  <td className="py-2.5 pr-4">{org._count.tests}</td>
                  <td className="py-2.5 text-muted">
                    {org.tests[0]?.createdAt.toLocaleDateString() ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </PageStack>
  );
}
