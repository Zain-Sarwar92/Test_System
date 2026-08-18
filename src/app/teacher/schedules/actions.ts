"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole, requireActiveOrganizationId } from "@/lib/rbac";
import { assertOrgModule } from "@/lib/org-modules";
import {
  formatScheduleDate,
  isDueTomorrow,
  isDueWithinWeek,
  resolveAssignmentStatus,
  type AssignmentCompletionStatus,
} from "@/lib/test-schedule-status";

const updateSyllabusSchema = z.object({
  assignmentId: z.string().min(1),
  syllabusText: z.string().max(200),
});

export type TeacherAssignedSchedule = {
  assignmentId: string;
  scheduleId: string;
  scheduleName: string;
  roundId: string;
  roundName: string;
  roundOrder: number;
  subjectName: string;
  className: string;
  sectionName: string | null;
  testDate: string;
  testDateLabel: string;
  status: AssignmentCompletionStatus;
  dueTomorrow: boolean;
  dueThisWeek: boolean;
  testId: string | null;
  coveredByTestId: string | null;
  syllabusText: string | null;
};

async function requireTeacherWithOrg() {
  const session = await requireRole(["TEACHER"]);
  const organizationId = await requireActiveOrganizationId(session.user.id);
  await assertOrgModule(organizationId, "SCHEDULES");
  return { session, organizationId, teacherId: session.user.id };
}

export async function getMyAssignedTestSchedules(): Promise<
  TeacherAssignedSchedule[]
> {
  const { organizationId, teacherId } = await requireTeacherWithOrg();

  const assignments = await prisma.testScheduleAssignment.findMany({
    where: {
      teacherId,
      scheduleSubjectClass: {
        scheduleSubject: {
          round: {
            schedule: {
              organizationId,
              status: "ACTIVE",
            },
          },
        },
      },
    },
    include: {
      test: {
        select: { id: true },
      },
      coveredByTest: {
        select: { id: true },
      },
      scheduleSubjectClass: {
        include: {
          class: { select: { name: true } },
          scheduleSubject: {
            include: {
              round: {
                select: {
                  id: true,
                  name: true,
                  order: true,
                  schedule: { select: { id: true, name: true } },
                },
              },
            },
          },
        },
      },
    },
    orderBy: {
      scheduleSubjectClass: {
        scheduleSubject: { testDate: "asc" },
      },
    },
  });

  return assignments.map((a) => {
    const testId = a.test?.id ?? a.coveredByTest?.id ?? null;
    const subjectItem = a.scheduleSubjectClass.scheduleSubject;
    const round = subjectItem.round;
    const schedule = round.schedule;
    const status = resolveAssignmentStatus({
      testDate: subjectItem.testDate,
      hasCreatedTest: Boolean(testId),
      completedAt: a.completedAt,
    });
    return {
      assignmentId: a.id,
      scheduleId: schedule.id,
      scheduleName: schedule.name,
      roundId: round.id,
      roundName: round.name,
      roundOrder: round.order,
      subjectName: subjectItem.subjectName,
      className: a.scheduleSubjectClass.class.name,
      sectionName: a.sectionName,
      testDate: subjectItem.testDate.toISOString(),
      testDateLabel: formatScheduleDate(subjectItem.testDate),
      status,
      dueTomorrow: isDueTomorrow(subjectItem.testDate),
      dueThisWeek: isDueWithinWeek(subjectItem.testDate),
      testId: a.test?.id ?? null,
      coveredByTestId: a.coveredByTest?.id ?? null,
      syllabusText: a.syllabusText,
    };
  });
}

export async function updateAssignmentSyllabus(input: {
  assignmentId: string;
  syllabusText: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const { organizationId, teacherId } = await requireTeacherWithOrg();
    const parsed = updateSyllabusSchema.parse(input);
    const trimmed = parsed.syllabusText.trim();
    const syllabusText = trimmed.length > 0 ? trimmed : null;

    const assignment = await prisma.testScheduleAssignment.findFirst({
      where: {
        id: parsed.assignmentId,
        teacherId,
        scheduleSubjectClass: {
          scheduleSubject: {
            round: {
              schedule: {
                organizationId,
                status: "ACTIVE",
              },
            },
          },
        },
      },
      select: { id: true },
    });

    if (!assignment) {
      return { ok: false, error: "Assignment not found or not available." };
    }

    await prisma.testScheduleAssignment.update({
      where: { id: assignment.id },
      data: { syllabusText },
    });

    return { ok: true };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        ok: false,
        error: error.issues[0]?.message ?? "Invalid syllabus.",
      };
    }
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Failed to save syllabus.",
    };
  }
}
