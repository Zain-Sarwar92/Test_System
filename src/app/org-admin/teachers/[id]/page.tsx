import Link from "next/link";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader, PageStack } from "@/components/page-header";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";

export default async function TeacherDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireRole(["ORG_ADMIN"]);
  const organizationId = session.user.organizationId;
  const { id } = await params;

  if (!organizationId) {
    notFound();
  }

  const membership = await prisma.orgMembership.findFirst({
    where: { userId: id, organizationId, role: "TEACHER" },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          teacherAssignments: {
            orderBy: [
              { class: { name: "asc" } },
              { section: { name: "asc" } },
              { subject: { name: "asc" } },
            ],
            select: {
              id: true,
              class: { select: { name: true } },
              section: { select: { name: true } },
              subject: { select: { name: true } },
            },
          },
        },
      },
    },
  });

  if (!membership) {
    notFound();
  }

  const teacher = membership.user;

  return (
    <PageStack wide>
      <PageHeader
        kicker="People"
        title={teacher.name}
        description={teacher.email}
        actions={
          <div className="flex flex-wrap gap-2">
            <Link href="/org-admin/teachers">
              <Button variant="secondary">All Teachers</Button>
            </Link>
            <Link href={`/org-admin/teachers/${teacher.id}/edit`}>
              <Button>Edit Teacher</Button>
            </Link>
          </div>
        }
      />

      <Card className="fade-up overflow-hidden p-0">
        <div className="border-b border-[rgba(15,40,70,0.08)] px-5 py-4">
          <h3 className="font-display text-lg font-semibold text-ink">
            Teaching Assignments
          </h3>
          <p className="mt-1 text-sm text-muted">
            Class + Section + Subject combinations for this teacher.
          </p>
        </div>
        <div className="p-5">
          {teacher.teacherAssignments.length === 0 ? (
            <p className="text-sm text-muted">No assignments yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-[rgba(15,40,70,0.08)] text-xs uppercase tracking-wide text-muted">
                    <th className="px-2 py-2 font-semibold">Class</th>
                    <th className="px-2 py-2 font-semibold">Section</th>
                    <th className="px-2 py-2 font-semibold">Subject</th>
                  </tr>
                </thead>
                <tbody>
                  {teacher.teacherAssignments.map((row) => (
                    <tr
                      key={row.id}
                      className="border-b border-[rgba(15,40,70,0.06)] last:border-0"
                    >
                      <td className="px-2 py-2.5 font-medium text-ink">
                        {row.class.name}
                      </td>
                      <td className="px-2 py-2.5 text-ink">{row.section.name}</td>
                      <td className="px-2 py-2.5 text-ink">{row.subject.name}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </Card>
    </PageStack>
  );
}
