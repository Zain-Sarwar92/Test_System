import { prisma } from "@/lib/prisma";
import { atomicSectionNames } from "@/lib/test-schedule-sections";

export class ScheduleAccessError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ScheduleAccessError";
  }
}

/**
 * Verify the authenticated teacher may create a paper for this class-level assignment.
 */
export async function assertCanCreateFromAssignment(input: {
  assignmentId: string;
  teacherId: string;
  organizationId: string;
  subjectId?: string;
}) {
  const assignment = await prisma.testScheduleAssignment.findFirst({
    where: {
      id: input.assignmentId,
      teacherId: input.teacherId,
      scheduleSubjectClass: {
        scheduleSubject: {
          round: {
            schedule: {
              organizationId: input.organizationId,
            },
          },
        },
      },
    },
    include: {
      test: { select: { id: true } },
      coveredByTest: { select: { id: true } },
      scheduleSubjectClass: {
        include: {
          class: {
            select: {
              id: true,
              name: true,
              boardId: true,
              board: { select: { id: true, name: true } },
            },
          },
          subject: {
            select: {
              id: true,
              name: true,
              classId: true,
            },
          },
          scheduleSubject: {
            include: {
              round: {
                include: {
                  schedule: {
                    select: {
                      id: true,
                      name: true,
                      status: true,
                      organizationId: true,
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

  if (!assignment) {
    throw new ScheduleAccessError("Assignment not found or not assigned to you");
  }

  const schedule = assignment.scheduleSubjectClass.scheduleSubject.round.schedule;
  if (schedule.status !== "ACTIVE") {
    throw new ScheduleAccessError("This schedule has been cancelled");
  }

  const membership = await prisma.orgMembership.findFirst({
    where: {
      userId: input.teacherId,
      organizationId: input.organizationId,
      role: "TEACHER",
      isActive: true,
    },
  });
  if (!membership) {
    throw new ScheduleAccessError(
      "Your teacher account is inactive for this organization",
    );
  }

  if (assignment.test || assignment.coveredByTest) {
    throw new ScheduleAccessError(
      "You have already created a test for this assignment",
    );
  }

  const subjectId = assignment.scheduleSubjectClass.subjectId;
  if (input.subjectId && input.subjectId !== subjectId) {
    throw new ScheduleAccessError("Subject must match the scheduled subject");
  }

  return assignment;
}

function sectionKey(sectionName: string | null | undefined) {
  return (sectionName?.trim() || "General").toLowerCase();
}

type TxClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

/**
 * When classSection lists multiple sections (e.g. "Blue, A"), mark matching
 * sibling assignments for the same class/date/teacher as covered by this paper.
 */
export async function coverSiblingAssignmentsForSections(input: {
  tx: TxClient;
  primaryAssignmentId: string;
  teacherId: string;
  scheduleSubjectClassId: string;
  classSection: string | null;
  testId: string;
  completedAt?: Date;
}) {
  if (!input.classSection?.trim()) return [] as string[];

  const requested = new Set(
    atomicSectionNames(input.classSection).map((s) => s.toLowerCase()),
  );
  if (requested.size === 0) return [] as string[];

  const siblings = await input.tx.testScheduleAssignment.findMany({
    where: {
      scheduleSubjectClassId: input.scheduleSubjectClassId,
      teacherId: input.teacherId,
      id: { not: input.primaryAssignmentId },
      test: null,
      coveredByTestId: null,
    },
    select: { id: true, sectionName: true },
  });

  const toCover = siblings.filter((sibling) =>
    requested.has(sectionKey(sibling.sectionName)),
  );
  if (toCover.length === 0) return [] as string[];

  const completedAt = input.completedAt ?? new Date();
  await input.tx.testScheduleAssignment.updateMany({
    where: { id: { in: toCover.map((s) => s.id) } },
    data: {
      coveredByTestId: input.testId,
      completedAt,
    },
  });

  return toCover.map((s) => s.id);
}

/**
 * Re-apply section coverage after editing a paper's classSection field.
 * Uncovers sections no longer listed; covers newly listed open siblings.
 */
export async function syncAssignmentCoverageForTest(input: {
  tx?: TxClient;
  testId: string;
  teacherId: string;
  scheduleAssignmentId: string;
  classSection: string | null;
}) {
  const run = async (tx: TxClient) => {
    const primary = await tx.testScheduleAssignment.findFirst({
      where: {
        id: input.scheduleAssignmentId,
        teacherId: input.teacherId,
      },
      select: {
        id: true,
        teacherId: true,
        scheduleSubjectClassId: true,
      },
    });
    if (!primary) return;

    await tx.testScheduleAssignment.updateMany({
      where: {
        coveredByTestId: input.testId,
        id: { not: primary.id },
      },
      data: { coveredByTestId: null, completedAt: null },
    });

    await coverSiblingAssignmentsForSections({
      tx,
      primaryAssignmentId: primary.id,
      teacherId: primary.teacherId,
      scheduleSubjectClassId: primary.scheduleSubjectClassId,
      classSection: input.classSection,
      testId: input.testId,
    });
  };

  if (input.tx) {
    await run(input.tx);
    return;
  }
  await prisma.$transaction(run);
}
