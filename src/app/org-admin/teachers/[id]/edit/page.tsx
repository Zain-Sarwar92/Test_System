import Link from "next/link";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { PageStack } from "@/components/page-header";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";
import { EditTeacherForm } from "./edit-teacher-form";

export default async function EditTeacherPage({
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
            select: {
              classId: true,
              sectionId: true,
              class: { select: { boardId: true } },
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
    prisma.section.findMany({
      where: { organizationId },
      orderBy: { name: "asc" },
      select: { id: true, name: true, classId: true },
    }),
    prisma.subject.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, classId: true },
    }),
    prisma.teacherAssignment.findMany({
      where: {
        section: { organizationId },
        teacherId: { not: id },
      },
      select: {
        sectionId: true,
        subject: { select: { name: true } },
        teacher: { select: { name: true } },
      },
      orderBy: { createdAt: "asc" },
    }),
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

  return (
    <PageStack>
      <div className="mx-auto flex w-full max-w-4xl flex-col items-center">
        <div className="mb-5 w-full text-center">
          <p className="page-kicker">People</p>
          <h2 className="page-title mt-1">Edit Teacher</h2>
          <div className="mt-3 flex justify-center gap-2">
            <Link href={`/org-admin/teachers/${id}`}>
              <Button variant="secondary" size="sm">
                Back to details
              </Button>
            </Link>
          </div>
        </div>

        <div className="fade-up w-full rounded-[1.25rem] border border-[rgba(15,40,70,0.1)] bg-white p-6 shadow-[0_10px_30px_rgba(15,40,70,0.06)] sm:p-8">
          <EditTeacherForm
            teacher={{
              id: membership.user.id,
              name: membership.user.name,
              email: membership.user.email,
              assignments: membership.user.teacherAssignments.map((row) => ({
                boardId: row.class.boardId,
                classId: row.classId,
                sectionId: row.sectionId,
                subjectName: row.subject.name,
              })),
            }}
            boards={boards}
            classes={classes}
            sections={sectionRows}
            subjects={subjectRows}
            takenSections={takenSections}
          />
        </div>
      </div>
    </PageStack>
  );
}
