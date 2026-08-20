import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { PageHeader, PageStack } from "@/components/page-header";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";
import { TeachersFilter } from "./teachers-filter";
import {
  DeleteTeacherButton,
  ToggleTeacherActiveButton,
} from "./teacher-row-actions";

type OrgTeachersPageProps = {
  searchParams: Promise<{ subject?: string; q?: string }>;
};

function uniqueSorted(values: string[]) {
  return [
    ...new Map(values.map((value) => [value.trim().toLowerCase(), value.trim()])).values(),
  ]
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b));
}

export default async function OrgTeachersPage({
  searchParams,
}: OrgTeachersPageProps) {
  const session = await requireRole(["ORG_ADMIN"]);
  const organizationId = session.user.organizationId;
  const { subject, q } = await searchParams;
  const query = q?.trim() ?? "";
  const subjectFilter = subject?.trim() ?? "";

  const subjectRows = await prisma.subject.findMany({
    select: { name: true },
    orderBy: { name: "asc" },
  });
  const subjectNames = uniqueSorted(subjectRows.map((s) => s.name));

  const memberships = organizationId
    ? await prisma.orgMembership.findMany({
        where: {
          organizationId,
          role: "TEACHER",
          ...(query || subjectFilter
            ? {
                user: {
                  AND: [
                    ...(query
                      ? [
                          {
                            OR: [
                              { name: { contains: query, mode: "insensitive" as const } },
                              { email: { contains: query, mode: "insensitive" as const } },
                              {
                                teacherAssignments: {
                                  some: {
                                    OR: [
                                      { subject: { name: { contains: query, mode: "insensitive" as const } } },
                                      { class: { name: { contains: query, mode: "insensitive" as const } } },
                                      { section: { name: { contains: query, mode: "insensitive" as const } } },
                                    ],
                                  },
                                },
                              },
                            ],
                          },
                        ]
                      : []),
                    ...(subjectFilter
                      ? [
                          {
                            teacherAssignments: {
                              some: {
                                subject: { name: { equals: subjectFilter } },
                              },
                            },
                          },
                        ]
                      : []),
                  ],
                },
              }
            : {}),
        },
        orderBy: { createdAt: "desc" },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              _count: { select: { tests: { where: { organizationId } } } },
              teacherAssignments: {
                select: {
                  class: { select: { name: true } },
                  section: { select: { name: true } },
                  subject: { select: { name: true } },
                },
                orderBy: { subject: { name: "asc" } },
              },
            },
          },
        },
      })
    : [];

  const teachers = memberships.map((m) => {
    const subjects = uniqueSorted(
      m.user.teacherAssignments.map((row) => row.subject.name),
    );
    const classes = uniqueSorted(
      m.user.teacherAssignments.map((row) => row.class.name),
    );
    const sections = uniqueSorted(
      m.user.teacherAssignments.map((row) => row.section.name),
    );

    return {
      id: m.user.id,
      name: m.user.name,
      email: m.user.email,
      testCount: m.user._count.tests,
      membershipActive: m.isActive,
      subjects,
      classes,
      sections,
    };
  });

  return (
    <PageStack wide>
      <PageHeader
        kicker="People"
        title="Teachers"
        actions={
          <Link href="/org-admin/teachers/new">
            <Button>Add Teacher</Button>
          </Link>
        }
      />

      <Card className="fade-up overflow-hidden p-0">
        <div className="nice-scroll max-h-[min(68vh,720px)] p-4 md:p-5">
          <TeachersFilter
            subjectNames={subjectNames}
            defaultQuery={query}
            defaultSubject={subjectFilter}
          />

          <div className="list-stack">
            {teachers.length === 0 ? (
              <div className="rounded-[1rem] border border-[rgba(15,40,70,0.08)] bg-mist/40 px-4 py-8 text-left">
                <CardTitle>No teachers yet</CardTitle>
                <CardDescription className="mt-2">
                  Create sections first, then add teachers with teaching assignments.
                </CardDescription>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Link href="/org-admin/sections/new">
                    <Button size="sm" variant="secondary">
                      Create Section
                    </Button>
                  </Link>
                  <Link href="/org-admin/teachers/new">
                    <Button size="sm">Add Teacher</Button>
                  </Link>
                </div>
              </div>
            ) : null}

            {teachers.map((teacher, index) => (
              <div
                key={teacher.id}
                className="chart-card flex flex-col gap-4 rounded-[1rem] border border-[rgba(15,40,70,0.08)] bg-gradient-to-br from-card to-mist px-4 py-4 sm:flex-row sm:items-center sm:justify-between"
                style={{ animationDelay: `${index * 40}ms` }}
              >
                <div className="min-w-0 text-left">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      href={`/org-admin/teachers/${teacher.id}`}
                      className="font-display text-lg font-semibold text-ink hover:text-brand"
                    >
                      {teacher.name}
                    </Link>
                    <span
                      className={
                        teacher.membershipActive
                          ? "status-chip status-chip-success"
                          : "status-chip status-chip-muted"
                      }
                    >
                      {teacher.membershipActive ? "Active" : "Inactive"}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-muted">
                    {teacher.email} · {teacher.testCount} tests
                  </p>
                  <div className="mt-2 space-y-1.5 text-xs text-muted">
                    <p>
                      <span className="font-semibold text-ink">Subjects:</span>{" "}
                      {teacher.subjects.length > 0
                        ? teacher.subjects.join(", ")
                        : "—"}
                    </p>
                    <p>
                      <span className="font-semibold text-ink">Classes:</span>{" "}
                      {teacher.classes.length > 0 ? teacher.classes.join(", ") : "—"}
                    </p>
                    <p>
                      <span className="font-semibold text-ink">Sections:</span>{" "}
                      {teacher.sections.length > 0
                        ? teacher.sections.join(", ")
                        : "—"}
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                  <Link href={`/org-admin/teachers/${teacher.id}`}>
                    <Button type="button" variant="outline" size="sm">
                      View
                    </Button>
                  </Link>
                  <Link href={`/org-admin/teachers/${teacher.id}/edit`}>
                    <Button type="button" variant="secondary" size="sm">
                      Edit
                    </Button>
                  </Link>
                  <ToggleTeacherActiveButton
                    teacherId={teacher.id}
                    teacherName={teacher.name}
                    isActive={teacher.membershipActive}
                  />
                  {!teacher.membershipActive ? (
                    <DeleteTeacherButton
                      teacherId={teacher.id}
                      teacherName={teacher.name}
                    />
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </div>
      </Card>
    </PageStack>
  );
}
