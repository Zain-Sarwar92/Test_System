import { prisma } from "@/lib/prisma";
import {
  buildTestReminderDigestEmail,
  sendEmail,
} from "@/lib/email";
import {
  formatScheduleDate,
  isDueTomorrow,
} from "@/lib/test-schedule-status";

export type ReminderRunResult = {
  checked: number;
  sent: number;
  skipped: number;
  failed: number;
  errors: string[];
};

function dayBounds(date: Date) {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
}

type ReminderAssignment = Awaited<
  ReturnType<typeof loadDueTomorrowAssignments>
>[number];

async function loadDueTomorrowAssignments(start: Date, end: Date) {
  return prisma.testScheduleAssignment.findMany({
    where: {
      reminderSentAt: null,
      completedAt: null,
      coveredByTestId: null,
      test: null,
      scheduleSubjectClass: {
        scheduleSubject: {
          testDate: { gte: start, lt: end },
          round: { schedule: { status: "ACTIVE" } },
        },
      },
    },
    include: {
      teacher: {
        select: { id: true, name: true, email: true, isActive: true },
      },
      scheduleSubjectClass: {
        include: {
          class: { select: { name: true } },
          scheduleSubject: {
            include: {
              round: {
                include: {
                  schedule: {
                    select: {
                      name: true,
                      organization: { select: { name: true } },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  });
}

/**
 * Email reminders only for papers due tomorrow that are still missing.
 * Disabled — set TEST_REMINDER_EMAILS=1 to enable. In-app due reminders are also off.
 */
export async function runTestScheduleReminders(
  now: Date = new Date(),
): Promise<ReminderRunResult> {
  const enabled =
    process.env.TEST_REMINDER_EMAILS === "1" ||
    process.env.TEST_REMINDER_EMAILS === "true";

  if (!enabled) {
    return {
      checked: 0,
      sent: 0,
      skipped: 0,
      failed: 0,
      errors: [],
    };
  }

  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const { start, end } = dayBounds(tomorrow);

  const assignments = await loadDueTomorrowAssignments(start, end);

  const result: ReminderRunResult = {
    checked: assignments.length,
    sent: 0,
    skipped: 0,
    failed: 0,
    errors: [],
  };

  const eligible: ReminderAssignment[] = [];
  for (const assignment of assignments) {
    const testDate = assignment.scheduleSubjectClass.scheduleSubject.testDate;
    if (!isDueTomorrow(testDate, now) || !assignment.teacher.isActive) {
      result.skipped += 1;
      continue;
    }
    eligible.push(assignment);
  }

  const byTeacher = new Map<string, ReminderAssignment[]>();
  for (const assignment of eligible) {
    const list = byTeacher.get(assignment.teacherId) ?? [];
    list.push(assignment);
    byTeacher.set(assignment.teacherId, list);
  }

  const appUrl = process.env.APP_URL ?? process.env.NEXT_PUBLIC_APP_URL;

  for (const teacherAssignments of byTeacher.values()) {
    const teacher = teacherAssignments[0]!.teacher;
    const organizationName =
      teacherAssignments[0]!.scheduleSubjectClass.scheduleSubject.round.schedule
        .organization.name;

    const items = teacherAssignments.map((assignment) => {
      const subjectName =
        assignment.scheduleSubjectClass.scheduleSubject.subjectName;
      const className = assignment.scheduleSubjectClass.class.name;
      const classSection = assignment.sectionName
        ? `${className} ${assignment.sectionName}`
        : className;
      const testDate = assignment.scheduleSubjectClass.scheduleSubject.testDate;
      const roundName =
        assignment.scheduleSubjectClass.scheduleSubject.round.name;
      return {
        subjectName,
        classSection,
        testDateLabel: formatScheduleDate(testDate),
        examName: `${assignment.scheduleSubjectClass.scheduleSubject.round.schedule.name} · ${roundName}`,
      };
    });

    const email = buildTestReminderDigestEmail({
      teacherName: teacher.name,
      organizationName,
      appUrl,
      items,
    });

    const sent = await sendEmail({
      to: teacher.email,
      subject: email.subject,
      text: email.text,
    });

    if (!sent.ok) {
      result.failed += 1;
      result.errors.push(
        `${teacher.email}: ${sent.error ?? "send failed"}`,
      );
      continue;
    }

    const ids = teacherAssignments.map((a) => a.id);
    await prisma.testScheduleAssignment.updateMany({
      where: { id: { in: ids } },
      data: { reminderSentAt: new Date() },
    });
    result.sent += 1;
  }

  return result;
}
