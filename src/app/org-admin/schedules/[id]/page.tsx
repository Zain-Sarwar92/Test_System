import Link from "next/link";
import { Fragment } from "react";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { PageHeader, PageStack } from "@/components/page-header";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";
import {
  resolveAssignmentStatus,
  statusChipClass,
  formatScheduleDate,
} from "@/lib/test-schedule-status";
import {
  collectClassSections,
  shortClassLabel,
} from "@/lib/test-schedule-sections";
import {
  CancelScheduleButton,
  DeleteScheduleButton,
} from "../schedule-row-actions";

type PageProps = {
  params: Promise<{ id: string }>;
};

function sameCalendarDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function sortClassNames(a: string, b: string) {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
}

// Subjects sharing a test date show under one merged date cell.
function groupSubjectsByTestDate<T extends { testDate: Date }>(subjects: T[]) {
  const groups: Array<{ key: string; label: string; items: T[] }> = [];
  for (const subject of subjects) {
    const key = subject.testDate.toISOString();
    const last = groups[groups.length - 1];
    if (last && last.key === key) {
      last.items.push(subject);
      continue;
    }
    groups.push({
      key,
      label: formatScheduleDate(subject.testDate),
      items: [subject],
    });
  }
  return groups;
}

export default async function OrgScheduleDetailPage({ params }: PageProps) {
  const session = await requireRole(["ORG_ADMIN"]);
  const organizationId = session.user.organizationId;
  const { id } = await params;

  if (!organizationId) {
    notFound();
  }

  const schedule = await prisma.testSchedule.findFirst({
    where: { id, organizationId },
    include: {
      createdBy: { select: { name: true } },
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
                      teacher: { select: { id: true, name: true, email: true } },
                      test: { select: { id: true, examDate: true } },
                      coveredByTest: { select: { id: true, examDate: true } },
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

  const classColumns = [...classSections.entries()]
    .sort(([a], [b]) => sortClassNames(a, b))
    .map(([className]) => className);

  const flatAssignments = allSubjects.flatMap((subjectItem) =>
    subjectItem.classes.flatMap((classItem) =>
      classItem.assignments.map((assignment) => ({
        assignment,
        testDate: subjectItem.testDate,
      })),
    ),
  );
  const completed = flatAssignments.filter(
    (item) => item.assignment.test || item.assignment.coveredByTest,
  ).length;
  const total = flatAssignments.length;
  const percent = total > 0 ? Math.round((completed / total) * 100) : 0;
  const overdue = flatAssignments.filter(
    (item) =>
      resolveAssignmentStatus({
        testDate: item.testDate,
        hasCreatedTest: Boolean(
          item.assignment.test || item.assignment.coveredByTest,
        ),
        completedAt: item.assignment.completedAt,
      }) === "OVERDUE",
  ).length;

  return (
    <PageStack wide>
      <PageHeader
        kicker="Scheduling"
        title={schedule.name}
        description={`Created by ${schedule.createdBy.name}`}
        actions={
          <div className="flex flex-wrap gap-2">
            <Link href={`/org-admin/schedules/${schedule.id}/print`}>
              <Button variant="secondary">Print schedule</Button>
            </Link>
            <Link href="/org-admin/schedules">
              <Button variant="secondary">All schedules</Button>
            </Link>
            <DeleteScheduleButton
              scheduleId={schedule.id}
              size="default"
              redirectToList
            />
          </div>
        }
      />

      <Card className="chart-card">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle className="text-base">Overall progress</CardTitle>
              {schedule.status === "CANCELLED" ? (
                <span className="status-chip status-chip-muted">Cancelled</span>
              ) : overdue > 0 ? (
                <span className={statusChipClass("OVERDUE")}>{overdue} overdue</span>
              ) : completed === total && total > 0 ? (
                <span className={statusChipClass("COMPLETED")}>All complete</span>
              ) : (
                <span className={statusChipClass("PENDING")}>In progress</span>
              )}
            </div>
            <p className="mt-1 text-sm text-muted">
              {schedule.rounds.length} round
              {schedule.rounds.length === 1 ? "" : "s"} · {allSubjects.length}{" "}
              subjects · {completed}/{total} tests ready
            </p>
          </div>
          <p className="text-2xl font-semibold text-ink">{percent}%</p>
        </div>
        <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-[rgba(15,40,70,0.08)]">
          <div
            className="h-full rounded-full bg-gradient-to-r from-brand to-brand-deep"
            style={{ width: `${percent}%` }}
          />
        </div>
      </Card>

      <Card className="overflow-hidden p-0">
        <div className="border-b border-[rgba(15,40,70,0.08)] bg-[#f8fbfd] px-5 py-4">
          <CardTitle className="text-base">Schedule plan</CardTitle>
          <p className="mt-1 text-sm text-muted">
            Grouped by round. Teachers add syllabus per assignment.
          </p>
        </div>

        <div className="nice-scroll overflow-x-auto">
          <table className="min-w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-[rgba(15,40,70,0.08)] bg-white">
                <th className="whitespace-nowrap px-4 py-3 font-semibold text-ink">
                  Date
                </th>
                <th className="whitespace-nowrap px-4 py-3 font-semibold text-ink">
                  Subject
                </th>
                {classColumns.map((className) => (
                  <th
                    key={className}
                    className="min-w-[10rem] whitespace-nowrap px-4 py-3 font-semibold text-ink"
                  >
                    {shortClassLabel(className)} Teacher
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {schedule.rounds.map((round) => {
                const roundFlat = round.subjects.flatMap((subjectItem) =>
                  subjectItem.classes.flatMap((classItem) =>
                    classItem.assignments.map((assignment) => ({
                      assignment,
                      testDate: subjectItem.testDate,
                    })),
                  ),
                );
                const roundCompleted = roundFlat.filter(
                  (item) => item.assignment.test || item.assignment.coveredByTest,
                ).length;
                const roundTotal = roundFlat.length;
                const colSpan = 2 + classColumns.length;

                return (
                  <Fragment key={`round-${round.id}`}>
                    <tr className="bg-[#eef6f4]">
                      <td
                        colSpan={colSpan}
                        className="px-4 py-3 font-semibold text-ink"
                      >
                        {round.name}
                        <span className="ml-2 text-xs font-medium text-muted">
                          {roundCompleted}/{roundTotal} tests ready
                        </span>
                      </td>
                    </tr>
                    {groupSubjectsByTestDate(round.subjects).map((group) =>
                      group.items.map((subjectItem, subjectIndex) => {
                      const byClassName = new Map(
                        subjectItem.classes.map((classItem) => [
                          classItem.class.name,
                          classItem,
                        ]),
                      );

                      return (
                        <tr
                          key={subjectItem.id}
                          className="border-b border-[rgba(15,40,70,0.06)] last:border-b-0"
                        >
                          {subjectIndex === 0 ? (
                            <td
                              rowSpan={group.items.length}
                              className="whitespace-nowrap px-4 py-4 align-top font-medium text-ink"
                            >
                              {group.label}
                            </td>
                          ) : null}
                          <td className="whitespace-nowrap px-4 py-4 align-top font-semibold text-ink">
                            {subjectItem.subjectName}
                          </td>
                          {classColumns.map((className) => {
                            const classItem = byClassName.get(className);
                            return (
                              <td
                                key={`${subjectItem.id}-${className}-teachers`}
                                className="px-4 py-4 align-top"
                              >
                                {!classItem || classItem.assignments.length === 0 ? (
                                  <span className="text-muted">—</span>
                                ) : (
                                  <div className="space-y-2">
                                    {classItem.assignments.map((assignment) => {
                                      const linkedPaper =
                                        assignment.test ?? assignment.coveredByTest;
                                      const status = resolveAssignmentStatus({
                                        testDate: subjectItem.testDate,
                                        hasCreatedTest: Boolean(linkedPaper),
                                        completedAt: assignment.completedAt,
                                      });
                                      const dateMismatch =
                                        linkedPaper?.examDate &&
                                        !sameCalendarDay(
                                          linkedPaper.examDate,
                                          subjectItem.testDate,
                                        );

                                      return (
                                        <div
                                          key={assignment.id}
                                          className="rounded-lg border border-[rgba(15,40,70,0.08)] bg-[#f8fbfd] px-2.5 py-2"
                                        >
                                          {assignment.sectionName ? (
                                            <p className="text-[10px] font-semibold uppercase tracking-wide text-brand">
                                              {assignment.sectionName}
                                            </p>
                                          ) : null}
                                          <p className="font-semibold text-ink">
                                            {assignment.teacher.name}
                                          </p>
                                          <p className="mt-1 text-[11px] text-muted">
                                            {assignment.syllabusText?.trim() ? (
                                              <>
                                                <span className="font-semibold text-ink">
                                                  Syllabus:
                                                </span>{" "}
                                                {assignment.syllabusText.trim()}
                                              </>
                                            ) : (
                                              <span className="italic">
                                                Syllabus not added yet
                                              </span>
                                            )}
                                          </p>
                                          <div className="mt-1 flex flex-wrap items-center gap-1.5">
                                            <span className={statusChipClass(status)}>
                                              {status}
                                            </span>
                                            {assignment.coveredByTest &&
                                            !assignment.test ? (
                                              <span className="text-[10px] font-medium text-muted">
                                                Shared test
                                              </span>
                                            ) : null}
                                          </div>
                                          {dateMismatch ? (
                                            <p className="mt-1 text-[11px] font-medium text-[#8a5a00]">
                                              Test date{" "}
                                              {formatScheduleDate(
                                                linkedPaper!.examDate!,
                                              )}{" "}
                                              ≠ schedule
                                            </p>
                                          ) : null}
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      );
                      }),
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <Card>
        <CardTitle className="text-base">Manage schedule</CardTitle>
        <p className="mt-1 text-sm text-muted">
          Cancel keeps the record but stops it as active. Delete removes the
          schedule completely (teacher tests stay saved).
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          {schedule.status === "ACTIVE" ? (
            <CancelScheduleButton scheduleId={schedule.id} />
          ) : null}
          <DeleteScheduleButton
            scheduleId={schedule.id}
            size="default"
            redirectToList
          />
        </div>
      </Card>
    </PageStack>
  );
}
