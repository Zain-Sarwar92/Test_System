import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { PageHeader, PageStack } from "@/components/page-header";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";
import { deleteSection } from "./actions";

export default async function SectionsPage() {
  const session = await requireRole(["ORG_ADMIN"]);
  const organizationId = session.user.organizationId;

  const sections = organizationId
    ? await prisma.section.findMany({
        where: { organizationId },
        orderBy: [{ class: { name: "asc" } }, { name: "asc" }],
        include: {
          class: {
            select: {
              id: true,
              name: true,
              board: { select: { name: true } },
            },
          },
          _count: { select: { teacherAssignments: true, students: true } },
        },
      })
    : [];

  const grouped = new Map<
    string,
    {
      classId: string;
      className: string;
      boardName: string;
      sections: typeof sections;
    }
  >();

  for (const section of sections) {
    const key = section.classId;
    const existing = grouped.get(key);
    if (existing) {
      existing.sections.push(section);
    } else {
      grouped.set(key, {
        classId: section.class.id,
        className: section.class.name,
        boardName: section.class.board.name,
        sections: [section],
      });
    }
  }

  const groups = [...grouped.values()].sort((a, b) =>
    a.className.localeCompare(b.className, undefined, {
      numeric: true,
      sensitivity: "base",
    }),
  );

  return (
    <PageStack wide>
      <PageHeader
        kicker="Academic Setup"
        title="Sections"
        description="Create sections for each class (Red, Green, A, B). Classes and subjects come from the global curriculum."
        actions={
          <Link href="/org-admin/sections/new">
            <Button>Add Section</Button>
          </Link>
        }
      />

      <Card className="fade-up overflow-hidden p-0">
        <div className="nice-scroll max-h-[min(68vh,720px)] space-y-5 p-4 md:p-5">
          {groups.length === 0 ? (
            <div className="rounded-[1rem] border border-[rgba(15,40,70,0.08)] bg-mist/40 px-4 py-8 text-left">
              <CardTitle>No sections yet</CardTitle>
              <CardDescription className="mt-2">
                Add sections before assigning teachers to class + section + subject.
              </CardDescription>
              <Link href="/org-admin/sections/new" className="mt-4 inline-block">
                <Button size="sm">Add Section</Button>
              </Link>
            </div>
          ) : null}

          {groups.map((group) => (
            <div key={group.classId} className="space-y-3">
              <div>
                <h3 className="font-display text-lg font-semibold text-ink">
                  {group.className}
                </h3>
                <p className="text-xs text-muted">{group.boardName}</p>
              </div>
              <div className="list-stack">
                {group.sections.map((section) => (
                  <div
                    key={section.id}
                    className="flex flex-col gap-3 rounded-[1rem] border border-[rgba(15,40,70,0.08)] bg-gradient-to-br from-white to-[#f7fafc] px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <p className="font-semibold text-ink">{section.name}</p>
                      <p className="mt-0.5 text-xs text-muted">
                        {section._count.teacherAssignments} teacher assignment
                        {section._count.teacherAssignments === 1 ? "" : "s"} ·{" "}
                        {section._count.students} student
                        {section._count.students === 1 ? "" : "s"}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Link href={`/org-admin/students?classId=${section.class.id}&sectionId=${section.id}`}>
                        <Button type="button" variant="secondary" size="sm">
                          Students
                        </Button>
                      </Link>
                      <Link href={`/org-admin/students/print/${section.id}`}>
                        <Button type="button" variant="outline" size="sm">
                          Print List
                        </Button>
                      </Link>
                      <Link href={`/org-admin/sections/${section.id}/edit`}>
                        <Button type="button" variant="outline" size="sm">
                          Edit
                        </Button>
                      </Link>
                      <form action={deleteSection}>
                        <input type="hidden" name="id" value={section.id} />
                        <Button type="submit" variant="danger" size="sm">
                          Delete
                        </Button>
                      </form>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Card>
    </PageStack>
  );
}
