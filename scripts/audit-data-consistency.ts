import "dotenv/config";
import { prisma } from "../src/lib/prisma";

const EXPECTED_CLASSES = ["Class 9", "Class 10", "Class 11", "Class 12"];
const EXPECTED_SUBJECTS = [
  "Physics",
  "Chemistry",
  "Biology",
  "Mathematics",
  "English",
  "Urdu",
  "Islamiyat",
];

async function main() {
  const issues: string[] = [];

  const boards = await prisma.board.findMany({
    include: {
      classes: {
        include: {
          subjects: {
            include: {
              chapters: {
                include: {
                  topics: {
                    include: {
                      _count: { select: { questions: true } },
                    },
                  },
                },
              },
              _count: { select: { teachers: true } },
            },
            orderBy: { name: "asc" },
          },
        },
        orderBy: { name: "asc" },
      },
    },
    orderBy: { name: "asc" },
  });

  const ordinalClasses = await prisma.class.findMany({
    where: { name: { in: ["9th", "10th", "11th", "12th"] } },
  });
  if (ordinalClasses.length > 0) {
    issues.push(
      `Ordinal duplicate classes still exist: ${ordinalClasses
        .map((c) => c.name)
        .join(", ")}`,
    );
  }

  console.log("=== BOARDS / CLASSES / SUBJECTS ===");
  for (const board of boards) {
    console.log(`\nBoard: ${board.name}`);
    const classNames = board.classes.map((c) => c.name);

    for (const expected of EXPECTED_CLASSES) {
      if (!classNames.includes(expected)) {
        issues.push(`${board.name}: missing ${expected}`);
      }
    }

    for (const klass of board.classes) {
      if (!EXPECTED_CLASSES.includes(klass.name)) {
        issues.push(
          `${board.name}: unexpected class name "${klass.name}"`,
        );
      }

      const subjectNames = klass.subjects.map((s) => s.name);
      const qCount = klass.subjects.reduce(
        (sum, s) =>
          sum +
          s.chapters.reduce(
            (cSum, ch) =>
              cSum + ch.topics.reduce((tSum, t) => tSum + t._count.questions, 0),
            0,
          ),
        0,
      );

      const missingSubjects = EXPECTED_SUBJECTS.filter(
        (s) => !subjectNames.includes(s),
      );
      const extraSubjects = subjectNames.filter(
        (s) => !EXPECTED_SUBJECTS.includes(s),
      );

      if (missingSubjects.length) {
        issues.push(
          `${board.name}/${klass.name}: missing subjects ${missingSubjects.join(", ")}`,
        );
      }
      if (extraSubjects.length) {
        issues.push(
          `${board.name}/${klass.name}: extra subjects ${extraSubjects.join(", ")}`,
        );
      }

      for (const subject of klass.subjects) {
        if (subject.chapters.length === 0) {
          issues.push(
            `${board.name}/${klass.name}/${subject.name}: no chapters`,
          );
        }
        for (const chapter of subject.chapters) {
          if (chapter.topics.length === 0) {
            issues.push(
              `${board.name}/${klass.name}/${subject.name}/${chapter.name}: no topics`,
            );
          }
        }
      }

      console.log(
        `  ${klass.name}: ${klass.subjects.length} subjects · ${qCount} questions · [${subjectNames.join(", ")}]`,
      );
    }
  }

  const byType = await prisma.question.groupBy({
    by: ["type"],
    _count: { _all: true },
  });

  const users = await prisma.user.groupBy({
    by: ["role"],
    _count: { _all: true },
  });

  const orgCount = await prisma.organization.count();
  const scheduleCount = await prisma.testSchedule.count();
  const testCount = await prisma.test.count();
  const teacherSubjectCount = await prisma.teacherSubject.count();
  const teacherAssignmentCount = await prisma.teacherAssignment.count();
  const sectionCount = await prisma.section.count();
  const questionCount = await prisma.question.count();

  // Check for duplicate class names within same board
  for (const board of boards) {
    const seen = new Map<string, number>();
    for (const c of board.classes) {
      const key = c.name.trim().toLowerCase();
      seen.set(key, (seen.get(key) ?? 0) + 1);
    }
    for (const [name, count] of seen) {
      if (count > 1) {
        issues.push(`${board.name}: duplicate class "${name}" x${count}`);
      }
    }
  }

  // Check for duplicate subject names within same class
  for (const board of boards) {
    for (const klass of board.classes) {
      const seen = new Map<string, number>();
      for (const s of klass.subjects) {
        const key = s.name.trim().toLowerCase();
        seen.set(key, (seen.get(key) ?? 0) + 1);
      }
      for (const [name, count] of seen) {
        if (count > 1) {
          issues.push(
            `${board.name}/${klass.name}: duplicate subject "${name}" x${count}`,
          );
        }
      }
    }
  }

  console.log("\n=== COUNTS ===");
  console.log({
    boards: boards.length,
    classes: boards.reduce((n, b) => n + b.classes.length, 0),
    subjects: boards.reduce(
      (n, b) => n + b.classes.reduce((m, c) => m + c.subjects.length, 0),
      0,
    ),
    questions: questionCount,
    questionsByType: Object.fromEntries(
      byType.map((r) => [r.type, r._count._all]),
    ),
    usersByRole: Object.fromEntries(users.map((u) => [u.role, u._count._all])),
    organizations: orgCount,
    teacherSubjects: teacherSubjectCount,
    teacherAssignments: teacherAssignmentCount,
    sections: sectionCount,
    schedules: scheduleCount,
    tests: testCount,
  });

  console.log("\n=== CONSISTENCY ===");
  if (issues.length === 0) {
    console.log("OK: curriculum naming and structure look consistent.");
  } else {
    console.log(`ISSUES (${issues.length}):`);
    for (const issue of issues) {
      console.log(`- ${issue}`);
    }
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
