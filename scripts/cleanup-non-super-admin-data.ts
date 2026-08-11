import "dotenv/config";
import { prisma } from "../src/lib/prisma";

async function main() {
  const superAdmins = await prisma.user.findMany({
    where: { role: "SUPER_ADMIN" },
    select: { id: true, email: true },
  });

  if (superAdmins.length === 0) {
    throw new Error("No SUPER_ADMIN found. Aborting cleanup.");
  }

  const keepUserIds = superAdmins.map((user) => user.id);

  const summaryBefore = {
    organizations: await prisma.organization.count(),
    orgMemberships: await prisma.orgMembership.count(),
    usersToDelete: await prisma.user.count({
      where: { id: { notIn: keepUserIds } },
    }),
    teacherSubjects: await prisma.teacherSubject.count(),
    teacherAssignments: await prisma.teacherAssignment.count(),
    sections: await prisma.section.count(),
    tests: await prisma.test.count(),
    schedules: await prisma.testSchedule.count(),
    suggestions: await prisma.questionSuggestion.count(),
  };

  await prisma.$transaction(async (tx) => {
    await tx.testQuestion.deleteMany();
    await tx.test.deleteMany();

    await tx.testScheduleAssignment.deleteMany();
    await tx.testScheduleSubjectClass.deleteMany();
    await tx.testScheduleSubject.deleteMany();
    await tx.testSchedule.deleteMany();

    await tx.orgMembership.deleteMany();
    await tx.organization.deleteMany();

    await tx.questionSuggestion.deleteMany({
      where: {
        OR: [
          { teacherId: { notIn: keepUserIds } },
          { reviewedById: { notIn: keepUserIds } },
        ],
      },
    });

    await tx.teacherAssignment.deleteMany({
      where: { teacherId: { notIn: keepUserIds } },
    });
    await tx.section.deleteMany();
    await tx.teacherSubject.deleteMany({
      where: { teacherId: { notIn: keepUserIds } },
    });

    await tx.session.deleteMany({
      where: { userId: { notIn: keepUserIds } },
    });
    await tx.account.deleteMany({
      where: { userId: { notIn: keepUserIds } },
    });

    await tx.user.deleteMany({
      where: { id: { notIn: keepUserIds } },
    });

    await tx.user.updateMany({
      where: { id: { in: keepUserIds } },
      data: {
        organizationId: null,
        isActive: true,
      },
    });
  });

  const summaryAfter = {
    organizations: await prisma.organization.count(),
    orgMemberships: await prisma.orgMembership.count(),
    remainingUsers: await prisma.user.count(),
    teacherSubjects: await prisma.teacherSubject.count(),
    teacherAssignments: await prisma.teacherAssignment.count(),
    sections: await prisma.section.count(),
    tests: await prisma.test.count(),
    schedules: await prisma.testSchedule.count(),
    questions: await prisma.question.count(),
    subjects: await prisma.subject.count(),
  };

  console.log("Cleanup complete");
  console.log({ superAdminsKept: superAdmins, summaryBefore, summaryAfter });
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
