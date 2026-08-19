import Link from "next/link";
import { CalendarClock, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { PageHeader, PageStack } from "@/components/page-header";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";
import {
  formatScheduleDate,
  resolveAssignmentStatus,
  statusChipClass,
} from "@/lib/test-schedule-status";
import { DeleteScheduleButton } from "./schedule-row-actions";

export default async function OrgSchedulesPage() {
  const session = await requireRole(["ORG_ADMIN"]);
  const organizationId = session.user.organizationId;

  const schedules = organizationId
    ? await prisma.testSchedule.findMany({
        where: { organizationId },
        orderBy: [{ createdAt: "desc" }],
        include: {
          rounds: {
            orderBy: [{ order: "asc" }, { name: "asc" }],
            include: {
              subjects: {
                include: {
                  classes: {
                    include: {
                      class: { select: { name: true } },
                      assignments: {
                        include: {
                          test: { select: { id: true } },
                        },
                      },
                    },
                  },
                },
                orderBy: [{ testDate: "asc" }, { subjectName: "asc" }],
              },
            },
          },
        },
      })
    : [];

  return (
    <PageStack wide>
      <PageHeader
        kicker="Scheduling"
        title="Test Schedules"
        description="Plan exams by subject and class, then track teacher completion."
        actions={
          <Link href="/org-admin/schedules/new">
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Create schedule
            </Button>
          </Link>
        }
      />

      {schedules.length === 0 ? (
        <Card className="flex flex-col items-center gap-4 py-12 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#fff4e5] text-[#8a5a00]">
            <CalendarClock className="h-7 w-7" />
          </div>
          <div>
            <CardTitle>No schedules yet</CardTitle>
            <p className="mt-1 max-w-sm text-sm text-muted">
              Create a monthly or weekly exam plan, add subjects, and assign teachers.
            </p>
          </div>
          <Link href="/org-admin/schedules/new">
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Create schedule
            </Button>
          </Link>
        </Card>
      ) : (
        <div className="list-stack">
          {schedules.map((schedule, index) => {
            const subjects = schedule.rounds.flatMap((round) => round.subjects);
            const flatAssignments = subjects.flatMap((subjectItem) =>
              subjectItem.classes.flatMap((classItem) =>
                classItem.assignments.map((assignment) => ({
                  assignment,
                  testDate: subjectItem.testDate,
                })),
              ),
            );
            const completed = flatAssignments.filter((item) => item.assignment.test).length;
            const total = flatAssignments.length;
            const percent = total > 0 ? Math.round((completed / total) * 100) : 0;
            const statuses = flatAssignments.map((item) =>
              resolveAssignmentStatus({
                testDate: item.testDate,
                hasCreatedTest: Boolean(item.assignment.test),
                completedAt: item.assignment.completedAt,
              }),
            );
            const overdue = statuses.filter((s) => s === "OVERDUE").length;
            const pending = statuses.filter((s) => s === "PENDING").length;
            const earliestDate = subjects[0]?.testDate;

            return (
              <div
                key={schedule.id}
                style={{ animationDelay: `${index * 40}ms` }}
              >
              <Card className="chart-card">
                <div className="flex flex-col gap-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <CardTitle className="truncate text-lg">{schedule.name}</CardTitle>
                        {schedule.status === "CANCELLED" ? (
                          <span className="status-chip status-chip-muted">Cancelled</span>
                        ) : overdue > 0 ? (
                          <span className={statusChipClass("OVERDUE")}>
                            {overdue} overdue
                          </span>
                        ) : pending > 0 ? (
                          <span className={statusChipClass("PENDING")}>
                            {pending} pending
                          </span>
                        ) : completed === total && total > 0 ? (
                          <span className={statusChipClass("COMPLETED")}>
                            Complete
                          </span>
                        ) : (
                          <span className={statusChipClass("UPCOMING")}>Upcoming</span>
                        )}
                      </div>
                      <p className="mt-1 text-sm text-muted">
                        {schedule.rounds.length} round
                        {schedule.rounds.length === 1 ? "" : "s"} · {subjects.length}{" "}
                        subject
                        {subjects.length === 1 ? "" : "s"}
                        {earliestDate
                          ? ` · starts ${formatScheduleDate(earliestDate)}`
                          : ""}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-wrap gap-2">
                      <Link href={`/org-admin/schedules/${schedule.id}`}>
                        <Button variant="secondary" size="sm">
                          Open
                        </Button>
                      </Link>
                      <DeleteScheduleButton scheduleId={schedule.id} />
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {schedule.rounds.map((round) => (
                      <span
                        key={round.id}
                        className="rounded-full border border-brand/20 bg-brand/5 px-2.5 py-1 text-xs font-semibold text-brand"
                      >
                        {round.name}
                        <span className="font-medium text-muted">
                          {" "}
                          · {round.subjects.length} subject
                          {round.subjects.length === 1 ? "" : "s"}
                        </span>
                      </span>
                    ))}
                  </div>

                  <div>
                    <div className="mb-1.5 flex items-center justify-between text-xs text-muted">
                      <span>Teacher progress</span>
                      <span className="font-semibold text-ink">
                        {completed}/{total} · {percent}%
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-[rgba(15,40,70,0.08)]">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-brand to-brand-deep transition-all"
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                  </div>
                </div>
              </Card>
              </div>
            );
          })}
        </div>
      )}
    </PageStack>
  );
}
