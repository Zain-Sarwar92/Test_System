import Link from "next/link";
import { Button } from "@/components/ui/button";
import { PageStack } from "@/components/page-header";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";
import { StudentForm } from "../student-form";

export default async function NewStudentPage({
  searchParams,
}: {
  searchParams: Promise<{ classId?: string; sectionId?: string }>;
}) {
  const session = await requireRole(["ORG_ADMIN"]);
  const organizationId = session.user.organizationId;
  const filters = await searchParams;
  const defaultClassId = filters.classId?.trim() || undefined;
  const defaultSectionId = filters.sectionId?.trim() || undefined;

  const [sectionRows, fieldRows, subjectRows] = organizationId
    ? await Promise.all([
        prisma.section.findMany({
          where: { organizationId },
          orderBy: [
            { class: { board: { name: "asc" } } },
            { class: { name: "asc" } },
            { name: "asc" },
          ],
          select: {
            id: true,
            name: true,
            class: {
              select: {
                id: true,
                name: true,
                board: { select: { id: true, name: true } },
              },
            },
          },
        }),
        prisma.studentFieldDefinition.findMany({
          where: { organizationId, isActive: true },
          orderBy: [{ order: "asc" }, { createdAt: "asc" }],
        }),
        prisma.subject.findMany({
          where: {
            class: { sections: { some: { organizationId } } },
          },
          select: {
            id: true,
            name: true,
            classId: true,
            track: true,
            electiveGroup: true,
          },
        }),
      ])
    : [[], [], []];

  const sections = sectionRows.map((section) => ({
    id: section.id,
    name: section.name,
    classId: section.class.id,
    className: section.class.name,
    boardId: section.class.board.id,
    boardName: section.class.board.name,
  }));
  const fields = fieldRows.map((field) => ({
    id: field.id,
    label: field.label,
    type: field.type,
    options: Array.isArray(field.options)
      ? field.options.filter((option): option is string => typeof option === "string")
      : [],
    isRequired: field.isRequired,
  }));

  return (
    <PageStack>
      <div className="mx-auto w-full max-w-4xl">
        <div className="mb-5 text-center">
          <p className="page-kicker">Students</p>
          <h2 className="page-title mt-1">Add Student</h2>
          <p className="page-subtitle mx-auto mt-1 max-w-xl">
            Class 9–10: Biology / Computer / Arts. Class 11–12: Pre-medical /
            Pre-engineering / ICS / Arts. No separate elective — group sets it.
          </p>
        </div>
        <div className="fade-up rounded-[1.25rem] border border-[rgba(15,40,70,0.1)] bg-card p-6 shadow-[0_10px_30px_rgba(15,40,70,0.06)] sm:p-8">
          {sections.length ? (
            <StudentForm
              sections={sections}
              classSubjects={subjectRows}
              fields={fields}
              defaultClassId={defaultClassId}
              defaultSectionId={defaultSectionId}
            />
          ) : (
            <div className="text-center">
              <h3 className="font-semibold text-ink">Create a section first</h3>
              <p className="mt-2 text-sm text-muted">
                Every student must belong to an organization section.
              </p>
              <Link href="/org-admin/sections/new" className="mt-4 inline-block">
                <Button>Create Section</Button>
              </Link>
            </div>
          )}
        </div>
      </div>
    </PageStack>
  );
}
