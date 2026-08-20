import Link from "next/link";
import { Button } from "@/components/ui/button";
import { PageHeader, PageStack } from "@/components/page-header";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";
import { CreateScheduleForm, type ScheduleCatalogBoard } from "../create-schedule-form";

type TeacherOption = {
  id: string;
  name: string;
  email: string;
};

export default async function NewSchedulePage() {
  const session = await requireRole(["ORG_ADMIN"]);
  const organizationId = session.user.organizationId;

  const [boards, orgSections, teacherAssignments] = await Promise.all([
    prisma.board.findMany({
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        classes: {
          orderBy: { name: "asc" },
          select: {
            id: true,
            name: true,
            subjects: {
              orderBy: { name: "asc" },
              select: { id: true, name: true },
            },
          },
        },
      },
    }),
    organizationId
      ? prisma.section.findMany({
          where: { organizationId },
          orderBy: { name: "asc" },
          select: { id: true, name: true, classId: true },
        })
      : Promise.resolve([]),
    organizationId
      ? prisma.teacherAssignment.findMany({
          where: {
            section: { organizationId },
            teacher: {
              isActive: true,
              orgMemberships: {
                some: {
                  organizationId,
                  role: "TEACHER",
                  isActive: true,
                },
              },
            },
          },
          select: {
            classId: true,
            sectionId: true,
            subjectId: true,
            teacher: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        })
      : Promise.resolve([]),
  ]);

  const sectionsByClassId = new Map<
    string,
    Array<{ id: string; name: string }>
  >();
  for (const section of orgSections) {
    const list = sectionsByClassId.get(section.classId) ?? [];
    list.push({ id: section.id, name: section.name });
    sectionsByClassId.set(section.classId, list);
  }

  type SectionTeacherMap = Map<string, TeacherOption[]>;
  const teachersBySubjectClass = new Map<string, SectionTeacherMap>();

  for (const mapping of teacherAssignments) {
    const subjectClassKey = `${mapping.subjectId}:${mapping.classId}`;
    let sectionMap = teachersBySubjectClass.get(subjectClassKey);
    if (!sectionMap) {
      sectionMap = new Map();
      teachersBySubjectClass.set(subjectClassKey, sectionMap);
    }
    const list = sectionMap.get(mapping.sectionId) ?? [];
    if (!list.some((t) => t.id === mapping.teacher.id)) {
      list.push({
        id: mapping.teacher.id,
        name: mapping.teacher.name,
        email: mapping.teacher.email,
      });
    }
    sectionMap.set(mapping.sectionId, list);
  }

  const catalog: ScheduleCatalogBoard[] = boards
    .map((board) => ({
      boardId: board.id,
      boardName: board.name,
      classes: board.classes
        .map((classItem) => ({
          classId: classItem.id,
          className: classItem.name,
          sections: sectionsByClassId.get(classItem.id) ?? [],
          subjects: classItem.subjects.map((subject) => {
            const sectionMap: SectionTeacherMap =
              teachersBySubjectClass.get(`${subject.id}:${classItem.id}`) ??
              new Map();
            const teachersBySectionId: Record<
              string,
              Array<{ id: string; name: string; email: string }>
            > = {};
            for (const [sectionId, teachers] of sectionMap.entries()) {
              teachersBySectionId[sectionId] = teachers.map((teacher) => ({
                id: teacher.id,
                name: teacher.name,
                email: teacher.email,
              }));
            }
            return {
              subjectId: subject.id,
              subjectName: subject.name,
              teachersBySectionId,
            };
          }),
        }))
        .sort((a, b) =>
          a.className.localeCompare(b.className, undefined, {
            numeric: true,
            sensitivity: "base",
          }),
        ),
    }))
    .filter((board) => board.classes.length > 0);

  const hasAnySection = orgSections.length > 0;

  return (
    <PageStack wide>
      <PageHeader
        kicker="Scheduling"
        title="Create Test Schedule"
        description="Name → board → classes → subjects → dates & teachers. Sections come from Academic Setup."
        actions={
          <Link href="/org-admin/schedules">
            <Button variant="secondary">Back to schedules</Button>
          </Link>
        }
      />

      {!hasAnySection ? (
        <div className="mx-auto max-w-lg rounded-[1.25rem] border border-[rgba(15,40,70,0.1)] bg-card p-8 text-center shadow-[0_10px_30px_rgba(15,40,70,0.05)]">
          <p className="text-base font-semibold text-ink">No sections yet</p>
          <p className="mt-1 text-sm text-muted">
            Create org sections before scheduling teachers by Class + Section + Subject.
          </p>
          <Link href="/org-admin/sections/new" className="mt-4 inline-block">
            <Button>Create Section</Button>
          </Link>
        </div>
      ) : catalog.length === 0 ? (
        <div className="mx-auto max-w-lg rounded-[1.25rem] border border-[rgba(15,40,70,0.1)] bg-card p-8 text-center shadow-[0_10px_30px_rgba(15,40,70,0.05)]">
          <p className="text-base font-semibold text-ink">No curriculum yet</p>
          <p className="mt-1 text-sm text-muted">
            Ask Super Admin to add boards, classes, and subjects first.
          </p>
        </div>
      ) : (
        <CreateScheduleForm catalog={catalog} />
      )}
    </PageStack>
  );
}
