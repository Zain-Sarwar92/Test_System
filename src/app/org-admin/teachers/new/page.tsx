import Link from "next/link";
import { Button } from "@/components/ui/button";
import { PageStack } from "@/components/page-header";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";
import { CreateTeacherForm } from "./create-teacher-form";

export default async function NewTeacherPage() {
  const session = await requireRole(["ORG_ADMIN"]);
  const organizationId = session.user.organizationId;

  const [classRows, sectionRows, subjectRows, takenAssignmentRows] =
    await Promise.all([
      prisma.class.findMany({
        orderBy: [{ board: { name: "asc" } }, { name: "asc" }],
        select: {
          id: true,
          name: true,
          board: { select: { id: true, name: true } },
        },
      }),
      organizationId
        ? prisma.section.findMany({
            where: { organizationId },
            orderBy: { name: "asc" },
            select: { id: true, name: true, classId: true },
          })
        : Promise.resolve([]),
      prisma.subject.findMany({
        orderBy: { name: "asc" },
        select: { id: true, name: true, classId: true },
      }),
      organizationId
        ? prisma.teacherAssignment.findMany({
            where: { section: { organizationId } },
            select: {
              sectionId: true,
              subject: { select: { name: true } },
              teacher: { select: { name: true } },
            },
            orderBy: { createdAt: "asc" },
          })
        : Promise.resolve([]),
    ]);

  const classes = classRows.map((klass) => ({
    id: klass.id,
    name: klass.name,
    boardId: klass.board.id,
    boardName: klass.board.name,
  }));
  const boards = [
    ...new Map(
      classRows.map((klass) => [
        klass.board.id,
        { id: klass.board.id, name: klass.board.name },
      ]),
    ).values(),
  ].sort((a, b) => a.name.localeCompare(b.name));
  const takenSections = [
    ...new Map(
      takenAssignmentRows.map((row) => {
        const key = `${row.sectionId}::${row.subject.name.trim().toLowerCase()}`;
        return [
          key,
          {
            sectionId: row.sectionId,
            subjectName: row.subject.name,
            teacherName: row.teacher.name,
          },
        ];
      }),
    ).values(),
  ];
  const hasClasses = classes.length > 0;
  const hasSections = sectionRows.length > 0;
  const hasSubjects = subjectRows.length > 0;
  const canAssign = hasClasses && hasSections && hasSubjects;

  return (
    <PageStack>
      <div className="mx-auto flex w-full max-w-4xl flex-col items-center">
        <div className="mb-5 w-full text-center">
          <h2 className="page-title mt-1">Add Teacher</h2>
         
          <div className="mt-3 flex justify-center gap-2">
            <Link href="/org-admin/teachers">
              <Button variant="secondary" size="sm">
                Back to Teachers
              </Button>
            </Link>
          </div>
        </div>

        <div className="fade-up w-full rounded-[1.25rem] border border-[rgba(15,40,70,0.1)] bg-white p-6 shadow-[0_10px_30px_rgba(15,40,70,0.06)] sm:p-8">
          {!canAssign ? (
            <div className="space-y-4 text-left">
              <h3 className="text-base font-semibold text-ink">
                You cannot add a teacher yet
              </h3>
              <p className="text-sm text-muted">
                Master data must exist before teaching assignments can be created.
              </p>
              <ul className="space-y-2 text-sm">
                <li className={hasClasses ? "text-brand" : "text-ink"}>
                  {hasClasses ? "✓" : "○"} Classes{" "}
                  {hasClasses
                    ? "(from Super Admin curriculum)"
                    : "— ask Super Admin to add classes"}
                </li>
                <li className={hasSections ? "text-brand" : "text-ink"}>
                  {hasSections ? "✓" : "○"} Sections{" "}
                  {!hasSections ? "— create org sections first" : ""}
                </li>
                <li className={hasSubjects ? "text-brand" : "text-ink"}>
                  {hasSubjects ? "✓" : "○"} Subjects{" "}
                  {hasSubjects
                    ? "(from Super Admin curriculum)"
                    : "— ask Super Admin to add subjects"}
                </li>
              </ul>
              <div className="flex flex-wrap gap-2 pt-2">
                {!hasSections ? (
                  <Link href="/org-admin/sections/new">
                    <Button>Create Section</Button>
                  </Link>
                ) : null}
                <Link href="/org-admin/sections">
                  <Button variant="secondary">View Sections</Button>
                </Link>
              </div>
            </div>
          ) : (
            <>
              <p className="mb-6 text-center text-sm text-muted">
                Required fields are marked with{" "}
                <span className="font-semibold text-red-500">*</span>
              </p>
              <CreateTeacherForm
                boards={boards}
                classes={classes}
                sections={sectionRows}
                subjects={subjectRows}
                takenSections={takenSections}
              />
            </>
          )}
        </div>
      </div>
    </PageStack>
  );
}
