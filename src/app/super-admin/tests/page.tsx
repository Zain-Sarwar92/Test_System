import Link from "next/link";
import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { PageHeader, PageStack } from "@/components/page-header";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";

export default async function SuperAdminTestsPage() {
  await requireRole(["SUPER_ADMIN"]);

  const tests = await prisma.test.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
    include: {
      organization: { select: { name: true } },
      teacher: { select: { name: true, email: true } },
      subject: {
        select: {
          name: true,
          class: { select: { name: true } },
        },
      },
    },
  });

  return (
    <PageStack>
      <PageHeader
        kicker="Cross-tenant"
        title="All tests"
        description="Every paper created by teachers across all organizations."
      />

      <div className="list-stack">
        {tests.length === 0 ? (
          <Card>
            <CardTitle>No tests yet</CardTitle>
            <CardDescription className="mt-2">
              Tests appear here when teachers save tests.
            </CardDescription>
          </Card>
        ) : null}

        {tests.map((test) => (
          <div
            key={test.id}
            className="chart-card flex flex-col gap-3 rounded-[1rem] border border-[rgba(15,40,70,0.08)] bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-semibold text-ink">{test.title}</h3>
                <span className="status-chip status-chip-muted">{test.status}</span>
              </div>
              <p className="mt-1 text-sm text-muted">
                {test.organization.name} · {test.teacher.name} ·{" "}
                {test.subject
                  ? `${test.subject.class?.name ?? ""} ${test.subject.name}`.trim()
                  : "No subject"}
              </p>
              <p className="mt-1 text-xs text-muted">
                {test.totalMarks} marks · {test.durationMinutes} min ·{" "}
                {test.createdAt.toLocaleDateString()}
              </p>
            </div>
            <Link href={`/super-admin/tests/${test.id}/print`}>
              <Button size="sm" variant="secondary">
                <Printer className="h-3.5 w-3.5" />
                Print / PDF
              </Button>
            </Link>
          </div>
        ))}
      </div>
    </PageStack>
  );
}
