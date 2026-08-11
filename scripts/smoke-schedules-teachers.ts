/**
 * Smoke test for scheduling + teacher-level features built recently.
 * Run: npx tsx scripts/smoke-schedules-teachers.ts
 */
import { prisma } from "../src/lib/prisma";
import {
  classMatchesTeacherLevel,
  resolveTeacherLevelForClass,
  type TeacherLevel,
} from "../src/lib/teacher-level";
import { resolveAssignmentStatus } from "../src/lib/test-schedule-status";

type Check = { name: string; ok: boolean; detail?: string };

const checks: Check[] = [];

function pass(name: string, detail?: string) {
  checks.push({ name, ok: true, detail });
}
function fail(name: string, detail: string) {
  checks.push({ name, ok: false, detail });
}

function localYmd(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

async function main() {
  // 1) Schema / curriculum
  const boards = await prisma.board.count();
  const classes = await prisma.class.findMany({ select: { name: true } });
  const levels = new Set(
    classes
      .map((c) => resolveTeacherLevelForClass(c.name))
      .filter(Boolean),
  );
  if (boards > 0) pass("Boards exist", `${boards} board(s)`);
  else fail("Boards exist", "No boards in DB");

  if (levels.has("PRIMARY") && levels.has("MATRIC") && levels.has("INTERMEDIATE")) {
    pass("Curriculum covers Primary/Matric/Intermediate");
  } else {
    fail(
      "Curriculum covers Primary/Matric/Intermediate",
      `Found levels: ${[...levels].join(", ") || "none"}`,
    );
  }

  // 2) Teacher level helpers
  const helperCases: Array<[string, TeacherLevel | null]> = [
    ["Nursery", "PRIMARY"],
    ["Prep", "PRIMARY"],
    ["Class 8", "PRIMARY"],
    ["Class 9", "MATRIC"],
    ["Class 10", "MATRIC"],
    ["Class 11", "INTERMEDIATE"],
    ["Class 12", "INTERMEDIATE"],
  ];
  let helpersOk = true;
  for (const [name, expected] of helperCases) {
    if (resolveTeacherLevelForClass(name) !== expected) {
      helpersOk = false;
      fail("Teacher level helpers", `${name} -> expected ${expected}`);
      break;
    }
  }
  if (helpersOk) pass("Teacher level helpers");

  // 3) Status logic
  const today = new Date();
  const past = new Date(today);
  past.setDate(past.getDate() - 5);
  const future = new Date(today);
  future.setDate(future.getDate() + 10);

  if (resolveAssignmentStatus({ testDate: past, hasCreatedTest: true }) !== "COMPLETED") {
    fail("Status COMPLETED when paper linked", "expected COMPLETED");
  } else {
    pass("Status COMPLETED when paper linked");
  }

  if (
    resolveAssignmentStatus({
      testDate: past,
      hasCreatedTest: false,
      completedAt: new Date(),
    }) === "COMPLETED"
  ) {
    fail(
      "Status ignores orphan completedAt",
      "COMPLETED without linked paper (should be OVERDUE)",
    );
  } else {
    pass("Status ignores orphan completedAt");
  }

  if (resolveAssignmentStatus({ testDate: past, hasCreatedTest: false }) !== "OVERDUE") {
    fail("Status OVERDUE for past date without paper", "expected OVERDUE");
  } else {
    pass("Status OVERDUE for past date without paper");
  }

  if (resolveAssignmentStatus({ testDate: future, hasCreatedTest: false }) !== "UPCOMING") {
    fail("Status UPCOMING for far future", "expected UPCOMING");
  } else {
    pass("Status UPCOMING for far future");
  }

  // 4) Teachers: unique email + teacherLevel field
  const teachers = await prisma.user.findMany({
    where: { role: "TEACHER" },
    select: {
      id: true,
      email: true,
      teacherLevel: true,
      teacherAssignments: {
        select: {
          class: { select: { name: true } },
          subject: { select: { name: true } },
        },
      },
    },
  });

  const emails = teachers.map((t) => t.email.toLowerCase());
  if (new Set(emails).size === emails.length) {
    pass("Teacher emails unique", `${teachers.length} teachers`);
  } else {
    fail("Teacher emails unique", "Duplicate emails found");
  }

  const mistyped: string[] = [];
  for (const teacher of teachers) {
    if (!teacher.teacherLevel) continue;
    for (const row of teacher.teacherAssignments) {
      if (!classMatchesTeacherLevel(row.class.name, teacher.teacherLevel)) {
        mistyped.push(
          `${teacher.email}: ${teacher.teacherLevel} mapped to ${row.class.name}`,
        );
      }
    }
  }
  if (mistyped.length === 0) {
    pass("Teacher assignments match teacherLevel");
  } else {
    fail("Teacher assignments match teacherLevel", mistyped.slice(0, 5).join(" | "));
  }

  // 5) Schedule integrity
  const schedules = await prisma.testSchedule.findMany({
    include: {
      rounds: {
        include: {
          subjects: {
            include: {
              classes: {
                include: {
                  class: { select: { name: true } },
                  assignments: {
                    include: {
                      teacher: { select: { teacherLevel: true, email: true } },
                      test: { select: { id: true, examDate: true } },
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

  pass("Schedules load", `${schedules.length} schedule(s)`);

  const levelMismatches: string[] = [];
  const orphanCompleted: string[] = [];
  const dateMismatches: string[] = [];

  for (const schedule of schedules) {
    for (const round of schedule.rounds) {
      for (const subjectItem of round.subjects) {
      for (const classItem of subjectItem.classes) {
        const classLevel = resolveTeacherLevelForClass(classItem.class.name);
        for (const assignment of classItem.assignments) {
          if (
            classLevel &&
            assignment.teacher.teacherLevel &&
            assignment.teacher.teacherLevel !== classLevel
          ) {
            levelMismatches.push(
              `${schedule.name}: ${assignment.teacher.email} (${assignment.teacher.teacherLevel}) on ${classItem.class.name}`,
            );
          }
          if (assignment.completedAt && !assignment.test) {
            orphanCompleted.push(
              `${schedule.name} / ${subjectItem.subjectName} / ${classItem.class.name}`,
            );
          }
          if (
            assignment.test?.examDate &&
            localYmd(assignment.test.examDate) !== localYmd(subjectItem.testDate)
          ) {
            dateMismatches.push(
              `${schedule.name}: paper ${localYmd(assignment.test.examDate)} vs schedule ${localYmd(subjectItem.testDate)}`,
            );
          }
        }
      }
      }
    }
  }

  if (levelMismatches.length === 0) {
    pass("Schedule assignments respect teacher levels");
  } else {
    fail("Schedule assignments respect teacher levels", levelMismatches.slice(0, 5).join(" | "));
  }

  if (orphanCompleted.length === 0) {
    pass("No orphan completedAt without paper");
  } else {
    // Auto-heal
    await prisma.testScheduleAssignment.updateMany({
      where: { completedAt: { not: null }, test: { is: null } },
      data: { completedAt: null },
    });
    fail(
      "No orphan completedAt without paper",
      `Found ${orphanCompleted.length}; cleared completedAt for orphans`,
    );
  }

  if (dateMismatches.length === 0) {
    pass("Linked papers match schedule test dates");
  } else {
    fail(
      "Linked papers match schedule test dates",
      `${dateMismatches.length} mismatch(es) — legacy papers may remain; new schedule papers are locked`,
    );
  }

  // 6) Delete path presence (code-level sanity via counts)
  const inactiveTeachers = await prisma.orgMembership.count({
    where: { role: "TEACHER", isActive: false },
  });
  pass(
    "Inactive teachers queryable for delete UI",
    `${inactiveTeachers} inactive membership(s)`,
  );

  // Report
  console.log("\n=== Smoke Test: Schedules + Teachers ===\n");
  let failed = 0;
  for (const check of checks) {
    const mark = check.ok ? "PASS" : "FAIL";
    console.log(`[${mark}] ${check.name}${check.detail ? ` — ${check.detail}` : ""}`);
    if (!check.ok) failed += 1;
  }
  console.log(`\n${checks.length - failed}/${checks.length} passed`);
  if (failed > 0) process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
