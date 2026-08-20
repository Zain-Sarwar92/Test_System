import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { PageHeader, PageStack } from "@/components/page-header";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";
import { orgHasModule } from "@/lib/org-modules";
import { DeleteSectionButton } from "./section-actions";

type SectionsPageProps = {
  searchParams?:
    | {
        classId?: string | string[];
      }
    | Promise<{
        classId?: string | string[];
      }>;
};

export default async function SectionsPage({ searchParams }: SectionsPageProps) {
  const session = await requireRole(["ORG_ADMIN"]);
  const organizationId = session.user.organizationId;

  const studentsEnabled = organizationId
    ? await orgHasModule(organizationId, "STUDENTS")
    : false;

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

  const resolvedSearchParams = searchParams
    ? await Promise.resolve(searchParams)
    : undefined;
  const selectedClassIdRaw = resolvedSearchParams?.classId;
  const selectedClassId =
    typeof selectedClassIdRaw === "string"
      ? selectedClassIdRaw
      : Array.isArray(selectedClassIdRaw)
        ? selectedClassIdRaw[0]
        : undefined;

  const selectedGroup =
    groups.find((group) => group.classId === selectedClassId) ?? groups[0] ?? null;

  return (
    <PageStack wide>
      <PageHeader
        kicker="Academic Setup"
        title="Sections"
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

          {groups.length > 0 ? (
            <div className="grid gap-5 lg:grid-cols-[minmax(260px,320px)_minmax(0,1fr)]">
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-[0.04em] text-muted">
                  Classes
                </p>
                {groups.map((group) => {
                  const isActive = selectedGroup?.classId === group.classId;
                  return (
                    <Link
                      key={group.classId}
                      href={`/org-admin/sections?classId=${group.classId}`}
                      className={`block rounded-[0.9rem] border px-3 py-3 transition ${
                        isActive
                          ? "border-brand/45 bg-brand/10"
                          : "border-[rgba(15,40,70,0.1)] bg-card hover:border-brand/30 hover:bg-brand/5"
                      }`}
                    >
                      <p className="font-semibold text-ink">{group.className}</p>
                      <p className="mt-0.5 text-xs text-muted">
                        {group.boardName} · {group.sections.length} section
                        {group.sections.length === 1 ? "" : "s"}
                      </p>
                    </Link>
                  );
                })}
              </div>

              <div className="space-y-3">
                {selectedGroup ? (
                  <>
                    <div>
                      <h3 className="font-display text-lg font-semibold text-ink">
                        {selectedGroup.className}
                      </h3>
                      <p className="text-xs text-muted">
                        {selectedGroup.boardName} · {selectedGroup.sections.length} section
                        {selectedGroup.sections.length === 1 ? "" : "s"}
                      </p>
                    </div>
                    <div className="list-stack">
                      {selectedGroup.sections.map((section) => (
                        <div
                          key={section.id}
                          className="flex flex-col gap-3 rounded-[1rem] border border-[rgba(15,40,70,0.08)] bg-gradient-to-br from-card to-mist px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                        >
                          <div>
                            <p className="font-semibold text-ink">{section.name}</p>
                            <p className="mt-0.5 text-xs text-muted">
                              {section._count.teacherAssignments} teacher assignment
                              {section._count.teacherAssignments === 1 ? "" : "s"}
                              {studentsEnabled
                                ? ` · ${section._count.students} student${
                                    section._count.students === 1 ? "" : "s"
                                  }`
                                : ""}
                            </p>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {studentsEnabled ? (
                              <>
                                <Link
                                  href={`/org-admin/students?classId=${section.class.id}&sectionId=${section.id}`}
                                >
                                  <Button type="button" variant="secondary" size="sm">
                                    Students
                                  </Button>
                                </Link>
                                <Link href={`/org-admin/students/print/${section.id}`}>
                                  <Button type="button" variant="outline" size="sm">
                                    Print List
                                  </Button>
                                </Link>
                              </>
                            ) : null}
                            <Link href={`/org-admin/sections/${section.id}/edit`}>
                              <Button type="button" variant="outline" size="sm">
                                Edit
                              </Button>
                            </Link>
                            <DeleteSectionButton
                              sectionId={section.id}
                              sectionName={section.name}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>
      </Card>
    </PageStack>
  );
}
