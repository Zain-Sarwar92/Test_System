import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";
import {
  formatScheduleDateShort,
  resolveAssignmentStatus,
  returningDateForTest,
} from "@/lib/test-schedule-status";
import {
  atomicSectionNames,
  collectClassSections,
  shortClassLabel,
  sortSectionNames,
} from "@/lib/test-schedule-sections";
import {
  SchedulePrintView,
  type SchedulePrintClassCell,
  type SchedulePrintRow,
  type SchedulePrintSectionColumn,
} from "./schedule-print-view";

type PageProps = {
  params: Promise<{ id: string }>;
};

function sortClassNames(a: string, b: string) {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
}

export default async function OrgSchedulePrintPage({ params }: PageProps) {
  const session = await requireRole(["ORG_ADMIN"]);
  const organizationId = session.user.organizationId;
  const { id } = await params;

  if (!organizationId) {
    notFound();
  }

  const schedule = await prisma.testSchedule.findFirst({
    where: { id, organizationId },
    include: {
      organization: { select: { name: true } },
      rounds: {
        orderBy: [{ order: "asc" }, { name: "asc" }],
        include: {
          subjects: {
            include: {
              classes: {
                include: {
                  class: { select: { id: true, name: true } },
                  assignments: {
                    include: {
                      teacher: { select: { name: true } },
                      test: { select: { id: true } },
                      coveredByTest: { select: { id: true } },
                    },
                    orderBy: { teacher: { name: "asc" } },
                  },
                },
                orderBy: { class: { name: "asc" } },
              },
            },
            orderBy: [{ testDate: "asc" }, { subjectName: "asc" }],
          },
        },
      },
    },
  });

  if (!schedule) {
    notFound();
  }

  const allSubjects = schedule.rounds.flatMap((round) => round.subjects);

  const classSections = collectClassSections(
    allSubjects.flatMap((subjectItem) =>
      subjectItem.classes.map((classItem) => ({
        className: classItem.class.name,
        sectionNames: classItem.assignments.map((a) => a.sectionName),
      })),
    ),
  );

  const classColumns = [...classSections.keys()].sort(sortClassNames);

  const sectionColumns: SchedulePrintSectionColumn[] = classColumns.flatMap(
    (className) => {
      const sections = [...(classSections.get(className) ?? [])].sort(
        sortSectionNames,
      );
      const classShort = shortClassLabel(className);
      return sections.map((sectionName) => ({
        key: `${className}::${sectionName}`,
        className,
        sectionName,
        label: `${classShort} ${sectionName}`,
      }));
    },
  );

  const rows: SchedulePrintRow[] = [];
  const blocks: Array<
    | { kind: "round"; key: string; title: string }
    | { kind: "data"; key: string; rowId: string }
  > = [];

  for (const round of schedule.rounds) {
    blocks.push({
      kind: "round",
      key: `round-${round.id}`,
      title: round.name,
    });

    for (const subjectItem of round.subjects) {
      const byClass: SchedulePrintRow["byClass"] = {};
      for (const classItem of subjectItem.classes) {
        const teachers: SchedulePrintClassCell["teachers"] = [];
        for (const assignment of classItem.assignments) {
          const sections = atomicSectionNames(assignment.sectionName);
          const status = resolveAssignmentStatus({
            testDate: subjectItem.testDate,
            hasCreatedTest: Boolean(assignment.test || assignment.coveredByTest),
            completedAt: assignment.completedAt,
          });
          for (const sectionName of sections) {
            teachers.push({
              name: assignment.teacher.name,
              sectionName,
              syllabusText: assignment.syllabusText,
              status,
            });
          }
        }
        teachers.sort((a, b) =>
          a.sectionName.localeCompare(b.sectionName, undefined, {
            numeric: true,
            sensitivity: "base",
          }),
        );
        byClass[classItem.class.name] = { teachers };
      }

      rows.push({
        id: subjectItem.id,
        dateLabel: formatScheduleDateShort(subjectItem.testDate),
        returnLabel: formatScheduleDateShort(
          returningDateForTest(subjectItem.testDate),
        ),
        subjectName: subjectItem.subjectName,
        byClass,
      });
      blocks.push({
        kind: "data",
        key: `data-${subjectItem.id}`,
        rowId: subjectItem.id,
      });
    }
  }

  return (
    <SchedulePrintView
      scheduleId={schedule.id}
      scheduleName={schedule.name}
      organizationName={schedule.organization.name}
      classColumns={classColumns}
      sectionColumns={sectionColumns}
      rows={rows}
      initialBlocks={blocks}
    />
  );
}
