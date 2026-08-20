import Link from "next/link";
import { ChevronRight, GraduationCap, Layers } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { PageHeader, PageStack } from "@/components/page-header";
import { HubCrumb } from "@/components/hub-crumb";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";
import { orgHasModule } from "@/lib/org-modules";
import { DeleteSectionButton } from "./section-actions";

function plural(count: number, singular: string, pluralForm = `${singular}s`) {
  return `${count} ${count === 1 ? singular : pluralForm}`;
}

const HUB_TONES = ["students", "teachers", "tests", "sections"] as const;

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

  const classes = [
    ...new Map(
      sections.map((section) => [
        section.class.id,
        {
          id: section.class.id,
          name: section.class.name,
          boardName: section.class.board.name,
          sectionCount: 0,
          studentCount: 0,
          teacherAssignmentCount: 0,
        },
      ]),
    ).values(),
  ]
    .map((klass) => {
      const classSections = sections.filter((section) => section.class.id === klass.id);
      return {
        ...klass,
        sectionCount: classSections.length,
        studentCount: classSections.reduce(
          (sum, section) => sum + section._count.students,
          0,
        ),
        teacherAssignmentCount: classSections.reduce(
          (sum, section) => sum + section._count.teacherAssignments,
          0,
        ),
      };
    })
    .sort(
      (a, b) =>
        a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" }) ||
        a.boardName.localeCompare(b.boardName),
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

  const selectedClass = classes.find((klass) => klass.id === selectedClassId);
  const classSections = selectedClass
    ? sections.filter((section) => section.class.id === selectedClass.id)
    : [];

  const addSectionHref = selectedClass
    ? `/org-admin/sections/new?classId=${selectedClass.id}`
    : "/org-admin/sections/new";

  return (
    <PageStack wide>
      <PageHeader
        kicker="Academic Setup"
        title={selectedClass ? selectedClass.name : "Sections"}
        description={
          selectedClass
            ? `Manage sections in ${selectedClass.name}.`
            : "Choose a class to view and manage its sections."
        }
        actions={
          <Link href={addSectionHref}>
            <Button>Add Section</Button>
          </Link>
        }
      />

      {selectedClass ? (
        <HubCrumb>
          <Link href="/org-admin/sections" className="font-medium text-brand hover:underline">
            Classes
          </Link>
          <ChevronRight className="h-3.5 w-3.5 text-muted" />
          <span className="font-semibold text-ink">{selectedClass.name}</span>
        </HubCrumb>
      ) : null}

      {!selectedClass ? (
        classes.length === 0 ? (
          <Card className="fade-up">
            <CardTitle>No sections yet</CardTitle>
            <CardDescription>
              Add sections before assigning teachers to class + section + subject.
            </CardDescription>
            <Link href="/org-admin/sections/new" className="mt-4 inline-block">
              <Button size="sm">Add Section</Button>
            </Link>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {classes.map((klass, index) => (
              <Link
                key={klass.id}
                href={`/org-admin/sections?classId=${klass.id}`}
                className={`org-dash-card tone-surface-${HUB_TONES[index % HUB_TONES.length]} chart-card group p-5 transition-transform duration-300 hover:-translate-y-1`}
                style={{ animationDelay: `${index * 40}ms` }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="org-dash-card-label">{klass.boardName}</p>
                    <h3 className="org-dash-card-value mt-1 text-2xl">{klass.name}</h3>
                  </div>
                  <span
                    className={`org-dash-icon org-dash-icon-tone-${HUB_TONES[index % HUB_TONES.length]}`}
                  >
                    <GraduationCap className="h-4 w-4" />
                  </span>
                </div>
                <p className="org-dash-card-hint mt-4">
                  {plural(klass.sectionCount, "section")}
                  {studentsEnabled
                    ? ` · ${plural(klass.studentCount, "student")}`
                    : ` · ${plural(klass.teacherAssignmentCount, "assignment")}`}
                </p>
                <p className="mt-3 text-sm font-medium text-brand">
                  View sections
                  <ChevronRight className="ml-0.5 inline h-4 w-4 align-text-bottom" />
                </p>
              </Link>
            ))}
          </div>
        )
      ) : classSections.length === 0 ? (
        <Card className="fade-up">
          <CardTitle>No sections in this class</CardTitle>
          <CardDescription>
            Add a section for {selectedClass.name} before assigning teachers or students.
          </CardDescription>
          <Link href={addSectionHref} className="mt-4 inline-block">
            <Button size="sm">Add Section</Button>
          </Link>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {classSections.map((section, index) => (
            <div
              key={section.id}
              className={`org-dash-card tone-surface-${HUB_TONES[index % HUB_TONES.length]} chart-card p-5`}
              style={{ animationDelay: `${index * 40}ms` }}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="org-dash-card-label">Section</p>
                  <h3 className="org-dash-card-value mt-1 text-2xl">{section.name}</h3>
                </div>
                <span
                  className={`org-dash-icon org-dash-icon-tone-${HUB_TONES[index % HUB_TONES.length]}`}
                >
                  <Layers className="h-4 w-4" />
                </span>
              </div>
              <p className="org-dash-card-hint mt-4">
                {plural(section._count.teacherAssignments, "teacher assignment")}
                {studentsEnabled
                  ? ` · ${plural(section._count.students, "student")}`
                  : ""}
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
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
                <DeleteSectionButton sectionId={section.id} sectionName={section.name} />
              </div>
            </div>
          ))}
        </div>
      )}
    </PageStack>
  );
}
