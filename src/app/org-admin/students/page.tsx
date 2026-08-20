import Link from "next/link";
import { ChevronRight, GraduationCap, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PageHeader, PageStack } from "@/components/page-header";
import { HubCrumb } from "@/components/hub-crumb";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";
import { StudentRowActions } from "./student-row-actions";

function plural(count: number, singular: string, pluralForm = `${singular}s`) {
  return `${count} ${count === 1 ? singular : pluralForm}`;
}

const HUB_TONES = ["students", "teachers", "tests", "sections"] as const;

export default async function StudentsPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    classId?: string;
    sectionId?: string;
    status?: string;
  }>;
}) {
  const session = await requireRole(["ORG_ADMIN"]);
  const organizationId = session.user.organizationId;
  const filters = await searchParams;
  const query = filters.q?.trim() ?? "";
  const requestedClassId = filters.classId?.trim() ?? "";
  const requestedSectionId = filters.sectionId?.trim() ?? "";
  const status = filters.status === "active" || filters.status === "inactive"
    ? filters.status
    : "";

  const sections = organizationId
    ? await prisma.section.findMany({
        where: { organizationId },
        orderBy: [{ class: { name: "asc" } }, { name: "asc" }],
        select: {
          id: true,
          name: true,
          class: {
            select: {
              id: true,
              name: true,
              board: { select: { name: true } },
            },
          },
          _count: { select: { students: true } },
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
      };
    })
    .sort(
      (a, b) =>
        a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" }) ||
        a.boardName.localeCompare(b.boardName),
    );

  const requestedSection = requestedSectionId
    ? sections.find((section) => section.id === requestedSectionId)
    : undefined;
  const classId = requestedClassId || requestedSection?.class.id || "";
  const selectedClass = classes.find((klass) => klass.id === classId);
  const classSections = selectedClass
    ? sections.filter((section) => section.class.id === selectedClass.id)
    : [];
  const selectedSection = classSections.find((section) => section.id === requestedSectionId);

  const students =
    organizationId && selectedSection
      ? await prisma.student.findMany({
          where: {
            organizationId,
            sectionId: selectedSection.id,
            ...(status ? { isActive: status === "active" } : {}),
            ...(query
              ? {
                  OR: [
                    { name: { contains: query, mode: "insensitive" } },
                    { rollNumber: { contains: query, mode: "insensitive" } },
                    { fatherName: { contains: query, mode: "insensitive" } },
                    { phone: { contains: query, mode: "insensitive" } },
                  ],
                }
              : {}),
          },
          orderBy: [{ rollNumber: "asc" }, { name: "asc" }],
          include: {
            customValues: {
              where: { field: { organizationId, isActive: true } },
              orderBy: { field: { order: "asc" } },
              select: {
                value: true,
                field: { select: { label: true, type: true } },
              },
            },
            feeCharges: {
              where: { organizationId },
              select: { amount: true, allocations: { select: { amount: true } } },
            },
            feePayments: {
              where: { organizationId },
              select: { amount: true },
            },
          },
        })
      : [];

  const addStudentHref = selectedSection
    ? `/org-admin/students/new?sectionId=${selectedSection.id}`
    : selectedClass
      ? `/org-admin/students/new?classId=${selectedClass.id}`
      : "/org-admin/students/new";

  return (
    <PageStack wide>
      <PageHeader
        kicker="People"
        title={
          selectedSection
            ? `${selectedClass?.name} · ${selectedSection.name}`
            : selectedClass
              ? selectedClass.name
              : "Students"
        }
        description={
          selectedSection
            ? `Students in ${selectedClass?.name} ${selectedSection.name}.`
            : selectedClass
              ? `Choose a section in ${selectedClass.name} to view its students.`
              : "Choose a class, then a section, to manage that group of students."
        }
        actions={
          <div className="flex flex-wrap gap-2">
            {selectedSection ? (
              <Link href={`/org-admin/students/print/${selectedSection.id}`}>
                <Button variant="outline">Print List</Button>
              </Link>
            ) : null}
            <Link href="/org-admin/students/fields">
              <Button variant="secondary">Custom Fields</Button>
            </Link>
            <Link href={addStudentHref}>
              <Button>Add Student</Button>
            </Link>
          </div>
        }
      />

      {selectedClass ? (
        <HubCrumb>
          <Link href="/org-admin/students" className="font-medium text-brand hover:underline">
            Classes
          </Link>
          <ChevronRight className="h-3.5 w-3.5 text-muted" />
          {selectedSection ? (
            <>
              <Link
                href={`/org-admin/students?classId=${selectedClass.id}`}
                className="font-medium text-brand hover:underline"
              >
                {selectedClass.name}
              </Link>
              <ChevronRight className="h-3.5 w-3.5 text-muted" />
              <span className="font-semibold text-ink">{selectedSection.name}</span>
            </>
          ) : (
            <span className="font-semibold text-ink">{selectedClass.name}</span>
          )}
        </HubCrumb>
      ) : null}

      {!selectedClass ? (
        sections.length === 0 ? (
          <Card className="fade-up">
            <CardTitle>No classes with sections yet</CardTitle>
            <CardDescription>
              Create a section for a class first. Students are then listed under that class and section.
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
                href={`/org-admin/students?classId=${klass.id}`}
                className={`org-dash-card tone-surface-${HUB_TONES[index % HUB_TONES.length]} chart-card group p-5 transition-transform duration-300 hover:-translate-y-1`}
                style={{ animationDelay: `${index * 40}ms` }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="org-dash-card-label">{klass.boardName}</p>
                    <h3 className="org-dash-card-value mt-1 text-2xl">{klass.name}</h3>
                  </div>
                  <span className={`org-dash-icon org-dash-icon-tone-${HUB_TONES[index % HUB_TONES.length]}`}>
                    <GraduationCap className="h-4 w-4" />
                  </span>
                </div>
                <p className="org-dash-card-hint mt-4">
                  {plural(klass.sectionCount, "section")} · {plural(klass.studentCount, "student")}
                </p>
                <p className="mt-3 text-sm font-medium text-brand">
                  View sections
                  <ChevronRight className="ml-0.5 inline h-4 w-4 align-text-bottom" />
                </p>
              </Link>
            ))}
          </div>
        )
      ) : !selectedSection ? (
        classSections.length === 0 ? (
          <Card className="fade-up">
            <CardTitle>No sections in this class</CardTitle>
            <CardDescription>
              Add a section for {selectedClass.name} before you can place students here.
            </CardDescription>
            <Link href="/org-admin/sections/new" className="mt-4 inline-block">
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
                <Link
                  href={`/org-admin/students?classId=${selectedClass.id}&sectionId=${section.id}`}
                  className="group block"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="org-dash-card-label">Section</p>
                      <h3 className="org-dash-card-value mt-1 text-2xl">{section.name}</h3>
                    </div>
                    <span className={`org-dash-icon org-dash-icon-tone-${HUB_TONES[index % HUB_TONES.length]}`}>
                      <Users className="h-4 w-4" />
                    </span>
                  </div>
                  <p className="org-dash-card-hint mt-4">
                    {plural(section._count.students, "student")}
                  </p>
                </Link>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Link
                    href={`/org-admin/students?classId=${selectedClass.id}&sectionId=${section.id}`}
                  >
                    <Button size="sm" variant="secondary">Students</Button>
                  </Link>
                  <Link href={`/org-admin/students/print/${section.id}`}>
                    <Button size="sm" variant="outline">Print List</Button>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )
      ) : (
        <Card className="fade-up overflow-hidden p-0">
          <div className="p-4 md:p-5">
            <form className="mb-4 grid gap-2 rounded-[0.9rem] border border-[rgba(15,40,70,0.08)] bg-card/70 p-3 md:grid-cols-[1.4fr_1fr_auto]">
              <input type="hidden" name="classId" value={selectedClass.id} />
              <input type="hidden" name="sectionId" value={selectedSection.id} />
              <Input
                name="q"
                defaultValue={query}
                placeholder="Search name, roll, father, or phone"
              />
              <select name="status" defaultValue={status} className="field-control h-11">
                <option value="">Any status</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
              <Button type="submit" variant="secondary">Apply</Button>
            </form>

            <div className="list-stack">
              {students.length === 0 ? (
                <div className="rounded-[1rem] border border-[rgba(15,40,70,0.08)] bg-mist/40 px-4 py-8">
                  <CardTitle>No students in this section</CardTitle>
                  <CardDescription>
                    Add a student to {selectedClass.name} {selectedSection.name}, or adjust the search.
                  </CardDescription>
                  <Link href={addStudentHref} className="mt-4 inline-block">
                    <Button size="sm">Add Student</Button>
                  </Link>
                </div>
              ) : null}
              {students.map((student, index) => {
                const charged = student.feeCharges.reduce(
                  (sum, charge) => sum + Number(charge.amount),
                  0,
                );
                const allocated = student.feeCharges.reduce(
                  (sum, charge) =>
                    sum +
                    charge.allocations.reduce(
                      (allocationSum, allocation) =>
                        allocationSum + Number(allocation.amount),
                      0,
                    ),
                  0,
                );
                const paid = student.feePayments.reduce(
                  (sum, payment) => sum + Number(payment.amount),
                  0,
                );
                return (
                  <div
                    key={student.id}
                    className="chart-card rounded-[1.15rem] border border-line bg-card px-4 py-4 shadow-[var(--shadow-soft)] transition hover:border-brand/30 hover:shadow-[var(--shadow-elevated)]"
                    style={{ animationDelay: `${index * 35}ms` }}
                  >
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <Link
                            href={`/org-admin/students/${student.id}`}
                            className="font-display text-lg font-semibold text-ink hover:text-brand"
                          >
                            {student.name}
                          </Link>
                          <span className={student.isActive ? "status-chip status-chip-success" : "status-chip status-chip-muted"}>
                            {student.isActive ? "Active" : "Inactive"}
                          </span>
                        </div>
                        <p className="mt-1 text-sm text-muted">
                          Roll {student.rollNumber} · Father: {student.fatherName} · Phone: {student.phone}
                        </p>
                        {student.customValues.length ? (
                          <p className="mt-2 text-xs text-muted">
                            {student.customValues
                              .map(({ field, value }) =>
                                `${field.label}: ${
                                  field.type === "BOOLEAN"
                                    ? value === "true" ? "Yes" : "No"
                                    : value
                                }`,
                              )
                              .join(" · ")}
                          </p>
                        ) : null}
                        {(charged > 0 || paid > 0) ? (
                          <p className="mt-2 text-xs font-medium text-ink">
                            Fees: charged {charged.toFixed(2)} · paid {paid.toFixed(2)} · outstanding{" "}
                            {Math.max(0, charged - allocated).toFixed(2)}
                          </p>
                        ) : null}
                      </div>
                      <div className="flex shrink-0 flex-wrap gap-2">
                        <Link href={`/org-admin/students/${student.id}`}>
                          <Button size="sm" variant="outline">View</Button>
                        </Link>
                        <Link href={`/org-admin/students/${student.id}/edit`}>
                          <Button size="sm" variant="secondary">Edit</Button>
                        </Link>
                        <StudentRowActions
                          studentId={student.id}
                          studentName={student.name}
                          isActive={student.isActive}
                          canDelete={!student.isActive && charged === 0 && paid === 0}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </Card>
      )}
    </PageStack>
  );
}
