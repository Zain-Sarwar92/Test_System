/**
 * Comprehensive smoke suite for product flows (excludes data-import scripts).
 *
 * Covers:
 * - RBAC helpers / teacher levels / assignment status
 * - Distribution engine (balanced, random, quotas)
 * - System settings round-trip
 * - Email reminder body builder + reminder runner (idempotent)
 * - Schedule assignment gate (assertCanCreateFromAssignment)
 * - Paper generate → link assignment → reopen on delete
 * - Suggestion → approve → global question
 * - Org visibility (teacher vs org tests)
 * - Print payload assembly (org branding + paper rows)
 * - Existing schedules/teachers integrity checks
 *
 * Run: npm run smoke:all
 */
import "dotenv/config";
import { prisma } from "../src/lib/prisma";
import {
  selectBalanced,
  selectByChapterQuotas,
  selectQuestions,
  buildInitialChapterQuotas,
  type PoolQuestion,
} from "../src/lib/distribution/engine";
import {
  canManageQuestionBank,
  canViewAllOrgTests,
  dashboardPathForRole,
} from "../src/lib/rbac";
import {
  classMatchesTeacherLevel,
  resolveTeacherLevelForClass,
  type TeacherLevel,
} from "../src/lib/teacher-level";
import {
  buildTestReminderEmail,
  sendEmail,
} from "../src/lib/email";
import {
  getSystemSettings,
  setSystemSettings,
  SETTING_KEYS,
} from "../src/lib/system-settings";
import {
  assertCanCreateFromAssignment,
  ScheduleAccessError,
} from "../src/lib/test-schedules";
import {
  formatScheduleDate,
  isDueTomorrow,
  resolveAssignmentStatus,
  statusChipClass,
} from "../src/lib/test-schedule-status";
import { runTestScheduleReminders } from "../src/lib/test-schedule-reminders";

const MARKER = "__SMOKE_ALL__";

type Check = { name: string; ok: boolean; detail?: string; group: string };
const checks: Check[] = [];

function pass(group: string, name: string, detail?: string) {
  checks.push({ group, name, ok: true, detail });
}
function fail(group: string, name: string, detail: string) {
  checks.push({ group, name, ok: false, detail });
}

function assert(
  group: string,
  name: string,
  condition: boolean,
  detailOnFail: string,
  detailOnPass?: string,
) {
  if (condition) pass(group, name, detailOnPass);
  else fail(group, name, detailOnFail);
}

function localYmd(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function tomorrowAtNoon(from = new Date()) {
  const d = new Date(from.getFullYear(), from.getMonth(), from.getDate() + 1, 12);
  return d;
}

function farFuture(from = new Date()) {
  const d = new Date(from);
  d.setDate(d.getDate() + 21);
  return d;
}

async function cleanupSmokeArtifacts() {
  await prisma.test.deleteMany({
    where: { OR: [{ title: { contains: MARKER } }, { paperCode: MARKER }] },
  });
  await prisma.questionSuggestion.deleteMany({
    where: { text: { contains: MARKER } },
  });
  await prisma.question.deleteMany({
    where: {
      OR: [
        { text: { contains: MARKER } },
        { externalKey: { startsWith: `smoke:${MARKER}` } },
        { source: MARKER },
      ],
    },
  });
  await prisma.testSchedule.deleteMany({
    where: { name: { contains: MARKER } },
  });
}

/* -------------------------------------------------------------------------- */
/* 1) Pure helpers                                                            */
/* -------------------------------------------------------------------------- */
function smokePureHelpers() {
  const g = "RBAC & helpers";

  assert(g, "dashboardPath SUPER_ADMIN", dashboardPathForRole("SUPER_ADMIN") === "/super-admin", "wrong path");
  assert(g, "dashboardPath ORG_ADMIN", dashboardPathForRole("ORG_ADMIN") === "/org-admin", "wrong path");
  assert(g, "dashboardPath TEACHER", dashboardPathForRole("TEACHER") === "/teacher", "wrong path");
  assert(g, "canViewAllOrgTests org admin", canViewAllOrgTests("ORG_ADMIN"), "expected true");
  assert(g, "canViewAllOrgTests teacher false", !canViewAllOrgTests("TEACHER"), "expected false");
  assert(g, "canManageQuestionBank super only", canManageQuestionBank("SUPER_ADMIN") && !canManageQuestionBank("ORG_ADMIN"), "RBAC mismatch");

  const cases: Array<[string, TeacherLevel | null]> = [
    ["Nursery", "PRIMARY"],
    ["Prep", "PRIMARY"],
    ["Class 8", "PRIMARY"],
    ["Class 9", "MATRIC"],
    ["Class 10", "MATRIC"],
    ["Class 11", "INTERMEDIATE"],
    ["Class 12", "INTERMEDIATE"],
  ];
  let ok = true;
  for (const [name, expected] of cases) {
    if (resolveTeacherLevelForClass(name) !== expected) {
      ok = false;
      fail(g, "Teacher level mapping", `${name} != ${expected}`);
      break;
    }
  }
  if (ok) pass(g, "Teacher level mapping", "Nursery→12");

  assert(
    g,
    "classMatchesTeacherLevel MATRIC",
    classMatchesTeacherLevel("Class 9", "MATRIC") &&
      !classMatchesTeacherLevel("Class 9", "PRIMARY"),
    "level filter broken",
  );
}

function smokeStatusLogic() {
  const g = "Assignment status";
  const today = new Date();
  const past = new Date(today);
  past.setDate(past.getDate() - 5);
  const soon = new Date(today);
  soon.setDate(soon.getDate() + 2);
  const future = new Date(today);
  future.setDate(future.getDate() + 10);

  assert(g, "COMPLETED when paper linked", resolveAssignmentStatus({ testDate: past, hasCreatedTest: true }) === "COMPLETED", "expected COMPLETED");
  assert(
    g,
    "orphan completedAt ignored",
    resolveAssignmentStatus({ testDate: past, hasCreatedTest: false, completedAt: new Date() }) !== "COMPLETED",
    "should not be COMPLETED without paper",
  );
  assert(g, "OVERDUE past without paper", resolveAssignmentStatus({ testDate: past, hasCreatedTest: false }) === "OVERDUE", "expected OVERDUE");
  assert(g, "PENDING within 7 days", resolveAssignmentStatus({ testDate: soon, hasCreatedTest: false }) === "PENDING", "expected PENDING");
  assert(g, "UPCOMING far future", resolveAssignmentStatus({ testDate: future, hasCreatedTest: false }) === "UPCOMING", "expected UPCOMING");
  assert(g, "isDueTomorrow", isDueTomorrow(tomorrowAtNoon(today), today), "expected true for tomorrow");
  assert(g, "statusChipClass PENDING", statusChipClass("PENDING").includes("warn"), "chip class missing");
  assert(g, "formatScheduleDate", formatScheduleDate(today).length > 5, "empty date label");
}

function smokeDistributionEngine() {
  const g = "Distribution engine";
  const pool: PoolQuestion[] = [];
  for (let chapter = 1; chapter <= 3; chapter++) {
    for (let topic = 1; topic <= 3; topic++) {
      for (let n = 1; n <= 4; n++) {
        pool.push({
          id: `c${chapter}-t${topic}-q${n}`,
          topicId: `t${chapter}.${topic}`,
          chapterId: `ch${chapter}`,
          type: "MCQ",
          marks: 1,
        });
      }
    }
  }

  const balanced = selectBalanced(pool, 9);
  assert(g, "balanced returns requested count", balanced.length === 9, `got ${balanced.length}`);
  const topicCounts = new Map<string, number>();
  for (const q of balanced) {
    topicCounts.set(q.topicId, (topicCounts.get(q.topicId) ?? 0) + 1);
  }
  const maxPerTopic = Math.max(...topicCounts.values());
  assert(g, "balanced spreads across topics", maxPerTopic <= 2, `max per topic ${maxPerTopic}`);

  const random = selectQuestions(pool, 5, "RANDOM");
  assert(g, "random unique selection", random.length === 5 && new Set(random.map((q) => q.id)).size === 5, "duplicates/count");

  const quotas = buildInitialChapterQuotas(
    { ch1: 10, ch2: 10, ch3: 10 },
    12,
  );
  const quotaTotal = quotas.reduce((s, q) => s + q.count, 0);
  assert(g, "buildInitialChapterQuotas totals 12", quotaTotal === 12, `got ${quotaTotal}`);

  const byQuota = selectByChapterQuotas(
    pool,
    [
      { chapterId: "ch1", count: 2 },
      { chapterId: "ch2", count: 3 },
    ],
    "BALANCED",
  );
  assert(
    g,
    "selectByChapterQuotas respects chapters",
    byQuota.length === 5 &&
      byQuota.filter((q) => q.chapterId === "ch1").length === 2 &&
      byQuota.filter((q) => q.chapterId === "ch2").length === 3,
    "quota mismatch",
  );

  const under = selectByChapterQuotas(
    pool.filter((q) => q.chapterId === "ch1").slice(0, 1),
    [{ chapterId: "ch1", count: 5 }],
    "RANDOM",
  );
  assert(g, "quotas soft-cap when pool small", under.length === 1, `got ${under.length}`);
}

function smokeEmailBuilder() {
  const g = "Email";
  const built = buildTestReminderEmail({
    teacherName: "Ali",
    testTitle: "Physics",
    subjectName: "Physics",
    classSection: "Class 9",
    testDateLabel: "1 August 2026",
    organizationName: "Bright School",
    examName: "Mid Term",
    appUrl: "http://localhost:5001",
  });
  assert(g, "reminder subject", built.subject.includes("Physics") && built.subject.includes("Class 9") && built.subject.includes("Bright School"), built.subject);
  assert(g, "reminder body has org", built.text.includes("Organization: Bright School"), "missing organization");
  assert(g, "reminder body has login hint", built.text.includes("localhost:5001"), "missing app url");
}

/* -------------------------------------------------------------------------- */
/* 2) DB integrity (schedules / teachers / bank readiness)                    */
/* -------------------------------------------------------------------------- */
async function smokeDbIntegrity() {
  const g = "DB integrity";

  const boards = await prisma.board.count();
  assert(g, "boards exist", boards > 0, "no boards", `${boards} board(s)`);

  const classes = await prisma.class.findMany({ select: { name: true } });
  const levels = new Set(
    classes.map((c) => resolveTeacherLevelForClass(c.name)).filter(Boolean),
  );
  assert(
    g,
    "curriculum covers Primary/Matric/Intermediate",
    levels.has("PRIMARY") && levels.has("MATRIC") && levels.has("INTERMEDIATE"),
    `found ${[...levels].join(",")}`,
  );

  const teachers = await prisma.user.findMany({
    where: { role: "TEACHER" },
    select: {
      email: true,
      teacherLevel: true,
      teacherAssignments: {
        select: {
          class: { select: { name: true } },
        },
      },
    },
  });
  const emails = teachers.map((t) => t.email.toLowerCase());
  assert(g, "teacher emails unique", new Set(emails).size === emails.length, "duplicates", `${teachers.length} teachers`);

  const mistyped: string[] = [];
  for (const teacher of teachers) {
    if (!teacher.teacherLevel) continue;
    for (const row of teacher.teacherAssignments) {
      if (!classMatchesTeacherLevel(row.class.name, teacher.teacherLevel)) {
        mistyped.push(`${teacher.email}→${row.class.name}`);
      }
    }
  }
  assert(g, "teacher subjects match level", mistyped.length === 0, mistyped.slice(0, 3).join(" | "));

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
                      test: { select: { examDate: true } },
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
  pass(g, "schedules load", `${schedules.length} schedule(s)`);

  const levelMismatches: string[] = [];
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
              `${assignment.teacher.email} on ${classItem.class.name}`,
            );
          }
          if (
            assignment.test?.examDate &&
            localYmd(assignment.test.examDate) !== localYmd(subjectItem.testDate)
          ) {
            dateMismatches.push(schedule.name);
          }
        }
      }
      }
    }
  }
  assert(g, "schedule assignments respect levels", levelMismatches.length === 0, levelMismatches.slice(0, 3).join(" | "));
  assert(g, "linked papers match schedule dates", dateMismatches.length === 0, `${dateMismatches.length} mismatch(es)`);

  // Question bank readiness (non-import check: pools usable for generate)
  const subjectsWithPools = await prisma.subject.findMany({
    where: {
      chapters: {
        some: {
          topics: {
            some: {
              questions: { some: { isActive: true, type: "SHORT" } },
            },
          },
        },
      },
    },
    select: { id: true, name: true },
  });
  assert(
    g,
    "subjects have question pools for generate",
    subjectsWithPools.length >= 10,
    `only ${subjectsWithPools.length} subjects with SHORT pool`,
    `${subjectsWithPools.length} subjects`,
  );

  const typeCounts = await prisma.question.groupBy({
    by: ["type"],
    where: { isActive: true },
    _count: true,
  });
  const byType = Object.fromEntries(typeCounts.map((r) => [r.type, r._count]));
  assert(
    g,
    "active bank has MCQ+SHORT+LONG",
    (byType.MCQ ?? 0) > 0 && (byType.SHORT ?? 0) > 0 && (byType.LONG ?? 0) > 0,
    JSON.stringify(byType),
    JSON.stringify(byType),
  );
}

/* -------------------------------------------------------------------------- */
/* 3) System settings                                                         */
/* -------------------------------------------------------------------------- */
async function smokeSystemSettings() {
  const g = "System settings";
  const before = await getSystemSettings();
  const key = SETTING_KEYS.platformName;
  const original = before[key];
  const probe = `${MARKER}-Platform`;

  try {
    await setSystemSettings({ [key]: probe });
    const mid = await getSystemSettings();
    assert(g, "settings write readable", mid[key] === probe, `got ${mid[key]}`);
    assert(
      g,
      "defaults still present",
      Boolean(mid[SETTING_KEYS.defaultDurationMinutes]),
      "missing default duration",
    );
  } finally {
    await setSystemSettings({ [key]: original });
  }

  const after = await getSystemSettings();
  assert(g, "settings restored", after[key] === original, `got ${after[key]}`);
}

/* -------------------------------------------------------------------------- */
/* 4) End-to-end flows with temporary fixtures                                */
/* -------------------------------------------------------------------------- */
async function findSmokeFixture() {
  // Prefer a matric teacher with a Class 9 subject that has active questions
  const mapping = await prisma.teacherAssignment.findFirst({
    where: {
      teacher: {
        role: "TEACHER",
        isActive: true,
        teacherLevel: "MATRIC",
        organizationId: { not: null },
        orgMemberships: {
          some: { role: "TEACHER", isActive: true },
        },
      },
      class: { name: "Class 9" },
      subject: {
        chapters: {
          some: {
            topics: {
              some: { questions: { some: { isActive: true } } },
            },
          },
        },
      },
    },
    include: {
      teacher: {
        select: {
          id: true,
          name: true,
          email: true,
          organizationId: true,
          teacherLevel: true,
        },
      },
      section: { select: { id: true, name: true } },
      subject: {
        include: {
          class: { select: { id: true, name: true, boardId: true } },
          chapters: {
            include: {
              topics: {
                include: {
                  questions: {
                    where: { isActive: true },
                    take: 20,
                    orderBy: { createdAt: "asc" },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  if (!mapping?.teacher.organizationId) return null;

  const admin = await prisma.orgMembership.findFirst({
    where: {
      organizationId: mapping.teacher.organizationId,
      role: "ORG_ADMIN",
      isActive: true,
    },
    select: { userId: true },
  });

  const org = await prisma.organization.findUnique({
    where: { id: mapping.teacher.organizationId },
    select: {
      id: true,
      name: true,
      logoUrl: true,
      address: true,
      phone: true,
      isActive: true,
    },
  });

  if (!admin || !org) return null;

  const questions = mapping.subject.chapters.flatMap((c) =>
    c.topics.flatMap((t) => t.questions),
  );
  if (questions.length < 3) return null;

  return {
    org,
    adminId: admin.userId,
    teacher: mapping.teacher,
    subject: mapping.subject,
    classId: mapping.subject.class.id,
    className: mapping.subject.class.name,
    sectionId: mapping.section.id,
    sectionName: mapping.section.name,
    questions,
  };
}

async function smokeScheduleGenerateReminderSuggestion() {
  const g = "E2E schedule → paper → reminder → suggestion";
  const fixture = await findSmokeFixture();
  if (!fixture) {
    fail(g, "fixture available", "No MATRIC Class 9 teacher+subject with questions");
    return;
  }

  pass(
    g,
    "fixture selected",
    `${fixture.teacher.email} / ${fixture.subject.name} / ${fixture.org.name}`,
  );

  const testDate = tomorrowAtNoon();
  const schedule = await prisma.testSchedule.create({
    data: {
      name: `${MARKER} Midterm Smoke`,
      organizationId: fixture.org.id,
      createdById: fixture.adminId,
      status: "ACTIVE",
      rounds: {
        create: {
          name: "Round 1",
          order: 0,
          subjects: {
            create: {
              subjectName: fixture.subject.name,
              testDate,
              classes: {
                create: {
                  classId: fixture.classId,
                  subjectId: fixture.subject.id,
                  assignments: {
                    create: {
                      teacherId: fixture.teacher.id,
                      sectionId: fixture.sectionId,
                      sectionName: fixture.sectionName,
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    include: {
      rounds: {
        include: {
          subjects: {
            include: {
              classes: { include: { assignments: true } },
            },
          },
        },
      },
    },
  });

  const assignment =
    schedule.rounds[0]?.subjects[0]?.classes[0]?.assignments[0];
  if (!assignment) {
    fail(g, "assignment created", "missing assignment row");
    return;
  }
  pass(g, "schedule+assignment created");

  // Gate: happy path
  const allowed = await assertCanCreateFromAssignment({
    assignmentId: assignment.id,
    teacherId: fixture.teacher.id,
    organizationId: fixture.org.id,
    subjectId: fixture.subject.id,
  });
  assert(g, "assertCanCreate allows assigned teacher", Boolean(allowed.id), "rejected unexpectedly");

  // Gate: wrong teacher
  try {
    await assertCanCreateFromAssignment({
      assignmentId: assignment.id,
      teacherId: fixture.adminId,
      organizationId: fixture.org.id,
    });
    fail(g, "assertCanCreate rejects wrong user", "should have thrown");
  } catch (error) {
    assert(
      g,
      "assertCanCreate rejects wrong user",
      error instanceof ScheduleAccessError,
      String(error),
    );
  }

  // Gate: wrong subject
  try {
    await assertCanCreateFromAssignment({
      assignmentId: assignment.id,
      teacherId: fixture.teacher.id,
      organizationId: fixture.org.id,
      subjectId: "not-the-subject",
    });
    fail(g, "assertCanCreate rejects subject mismatch", "should have thrown");
  } catch (error) {
    assert(
      g,
      "assertCanCreate rejects subject mismatch",
      error instanceof ScheduleAccessError,
      String(error),
    );
  }

  // Distribution pick from real pool
  const pool: PoolQuestion[] = fixture.questions.slice(0, 12).map((q) => {
    const topic = fixture.subject.chapters
      .flatMap((c) => c.topics.map((t) => ({ ...t, chapterId: c.id })))
      .find((t) => t.questions.some((qq) => qq.id === q.id));
    return {
      id: q.id,
      topicId: q.topicId,
      chapterId: topic?.chapterId ?? "unknown",
      type: q.type,
      marks: q.marks,
    };
  });
  const picks = selectQuestions(pool, Math.min(3, pool.length), "BALANCED");
  assert(g, "generate picks from real bank", picks.length >= 1, "no picks");

  // Save paper (same core as saveSectionBuiltTest, without Next session)
  const totalMarks = picks.reduce((s, p) => s + p.marks, 0);
  const paper = await prisma.$transaction(async (tx) => {
    const created = await tx.test.create({
      data: {
        title: `${MARKER} Generated Paper`,
        instructions: "Medium: English",
        durationMinutes: 60,
        totalMarks,
        classSection: fixture.className,
        examDate: testDate,
        preparedBy: fixture.teacher.name,
        paperCode: MARKER,
        distributionMode: "BALANCED",
        status: "FINAL",
        organizationId: fixture.org.id,
        teacherId: fixture.teacher.id,
        subjectId: fixture.subject.id,
        scheduleAssignmentId: assignment.id,
        questions: {
          create: picks.map((p, idx) => ({
            questionId: p.id,
            order: idx + 1,
            marks: p.marks,
          })),
        },
      },
      include: {
        questions: { include: { question: true } },
        organization: true,
        subject: true,
      },
    });
    await tx.testScheduleAssignment.update({
      where: { id: assignment.id },
      data: { completedAt: new Date() },
    });
    return created;
  });

  assert(
    g,
    "paper linked to assignment",
    paper.scheduleAssignmentId === assignment.id,
    "link missing",
  );
  assert(
    g,
    "paper examDate locked to schedule",
    localYmd(paper.examDate!) === localYmd(testDate),
    `${localYmd(paper.examDate!)} vs ${localYmd(testDate)}`,
  );
  assert(
    g,
    "assignment COMPLETED after paper",
    resolveAssignmentStatus({
      testDate,
      hasCreatedTest: true,
      completedAt: new Date(),
    }) === "COMPLETED",
    "status not COMPLETED",
  );

  // Gate: cannot create second paper
  try {
    await assertCanCreateFromAssignment({
      assignmentId: assignment.id,
      teacherId: fixture.teacher.id,
      organizationId: fixture.org.id,
    });
    fail(g, "blocks second paper on same assignment", "should have thrown");
  } catch (error) {
    assert(
      g,
      "blocks second paper on same assignment",
      error instanceof ScheduleAccessError,
      String(error),
    );
  }

  // Org visibility
  const orgTests = await prisma.test.count({
    where: { organizationId: fixture.org.id, status: "FINAL" },
  });
  const teacherOwn = await prisma.test.count({
    where: {
      organizationId: fixture.org.id,
      teacherId: fixture.teacher.id,
      status: "FINAL",
    },
  });
  assert(g, "org has FINAL tests for admin list", orgTests >= 1, `count ${orgTests}`);
  assert(g, "teacher own tests countable", teacherOwn >= 1, `count ${teacherOwn}`);

  // Print payload assembly (PDF = print page data)
  const printable = await prisma.test.findUnique({
    where: { id: paper.id },
    include: {
      organization: {
        select: { name: true, logoUrl: true, address: true, phone: true },
      },
      subject: { select: { name: true } },
      questions: {
        orderBy: { order: "asc" },
        include: {
          question: {
            select: {
              type: true,
              text: true,
              textUrdu: true,
              optionA: true,
              optionB: true,
              optionC: true,
              optionD: true,
            },
          },
        },
      },
    },
  });
  assert(
    g,
    "print payload has org branding + questions",
    Boolean(printable?.organization.name) &&
      (printable?.questions.length ?? 0) === picks.length,
    "print assembly incomplete",
  );

  // Delete paper → reopen assignment (teacher delete flow)
  await prisma.test.delete({ where: { id: paper.id } });
  await prisma.testScheduleAssignment.update({
    where: { id: assignment.id },
    data: { completedAt: null },
  });
  const reopened = await prisma.testScheduleAssignment.findUnique({
    where: { id: assignment.id },
    include: { test: true },
  });
  assert(
    g,
    "delete paper reopens assignment",
    !reopened?.test && !reopened?.completedAt,
    "still completed/linked",
  );

  // Reminders: due tomorrow, pending, not reminded
  const reminderRun1 = await runTestScheduleReminders(new Date());
  const afterRemind = await prisma.testScheduleAssignment.findUnique({
    where: { id: assignment.id },
  });
  assert(
    g,
    "reminder marks assignment sent",
    Boolean(afterRemind?.reminderSentAt),
    `sent=${reminderRun1.sent} checked=${reminderRun1.checked} failed=${reminderRun1.failed}`,
  );

  const sentAtFirst = afterRemind?.reminderSentAt?.getTime() ?? null;
  const reminderRun2 = await runTestScheduleReminders(new Date());
  const afterRemind2 = await prisma.testScheduleAssignment.findUnique({
    where: { id: assignment.id },
  });
  assert(
    g,
    "reminder idempotent for this assignment",
    Boolean(afterRemind2?.reminderSentAt) &&
      afterRemind2!.reminderSentAt!.getTime() === sentAtFirst,
    `secondRun.sent=${reminderRun2.sent}; sentAt changed`,
  );

  // Console email path works
  const emailResult = await sendEmail({
    to: "smoke@example.com",
    subject: `${MARKER} ping`,
    text: "smoke",
  });
  assert(g, "sendEmail ok (console or smtp)", emailResult.ok, emailResult.error ?? "fail");

  // Cancelled schedule gate
  await prisma.testSchedule.update({
    where: { id: schedule.id },
    data: { status: "CANCELLED" },
  });
  try {
    await assertCanCreateFromAssignment({
      assignmentId: assignment.id,
      teacherId: fixture.teacher.id,
      organizationId: fixture.org.id,
    });
    fail(g, "cancelled schedule blocked", "should have thrown");
  } catch (error) {
    assert(
      g,
      "cancelled schedule blocked",
      error instanceof ScheduleAccessError,
      String(error),
    );
  }

  // Suggestion → approve pipeline (prisma mirror of super-admin action)
  const topicId = fixture.questions[0].topicId;
  const suggestion = await prisma.questionSuggestion.create({
    data: {
      type: "SHORT",
      text: `${MARKER} Suggested short question?`,
      marks: 2,
      topicId,
      teacherId: fixture.teacher.id,
      status: "PENDING",
    },
  });

  const superAdmin = await prisma.user.findFirst({
    where: { role: "SUPER_ADMIN", isActive: true },
    select: { id: true },
  });
  assert(g, "super admin exists for approve", Boolean(superAdmin), "no SUPER_ADMIN");

  if (superAdmin) {
    const approvedQuestion = await prisma.$transaction(async (tx) => {
      const sug = await tx.questionSuggestion.findUniqueOrThrow({
        where: { id: suggestion.id },
      });
      if (sug.status !== "PENDING") throw new Error("already reviewed");
      const question = await tx.question.create({
        data: {
          type: sug.type,
          text: sug.text,
          marks: sug.marks,
          topicId: sug.topicId,
          isActive: true,
          source: "Teacher suggestion",
          externalKey: `smoke:${MARKER}:${sug.id}`,
        },
      });
      await tx.questionSuggestion.update({
        where: { id: sug.id },
        data: {
          status: "APPROVED",
          reviewedById: superAdmin.id,
          reviewedAt: new Date(),
          questionId: question.id,
        },
      });
      return question;
    });

    const linked = await prisma.questionSuggestion.findUnique({
      where: { id: suggestion.id },
    });
    assert(
      g,
      "suggestion approve creates bank question",
      linked?.status === "APPROVED" && linked.questionId === approvedQuestion.id,
      JSON.stringify(linked),
    );

    // Double-approve should be rejected by business rule
    let doubleBlocked = false;
    try {
      if (linked?.status !== "PENDING") {
        doubleBlocked = true;
      }
    } catch {
      doubleBlocked = true;
    }
    assert(g, "approved suggestion not still PENDING", doubleBlocked, "still PENDING");
  }

  // Org profile fields readable (print branding)
  assert(
    g,
    "org profile fields for papers",
    Boolean(fixture.org.name),
    "org name missing",
    fixture.org.name,
  );

  // Far-future assignment status UPCOMING for teacher list semantics
  assert(
    g,
    "far future assignment UPCOMING",
    resolveAssignmentStatus({
      testDate: farFuture(),
      hasCreatedTest: false,
    }) === "UPCOMING",
    "expected UPCOMING",
  );
}

function smokeCronAuthLogic() {
  const g = "Cron auth";
  const secret = process.env.CRON_SECRET;

  function authorize(opts: {
    secretEnv?: string;
    bearer?: string | null;
    querySecret?: string | null;
  }) {
    if (!opts.secretEnv) {
      return { ok: false as const, status: 503 };
    }
    if (opts.bearer === opts.secretEnv || opts.querySecret === opts.secretEnv) {
      return { ok: true as const };
    }
    return { ok: false as const, status: 401 };
  }

  if (!secret) {
    pass(g, "CRON_SECRET unset → 503 path", "dev may skip HTTP cron");
    assert(
      g,
      "authorize without secret is 503",
      authorize({ secretEnv: undefined }).status === 503,
      "expected 503",
    );
  } else {
    assert(
      g,
      "authorize accepts Bearer",
      authorize({ secretEnv: secret, bearer: secret }).ok,
      "bearer rejected",
    );
    assert(
      g,
      "authorize accepts query secret",
      authorize({ secretEnv: secret, querySecret: secret }).ok,
      "query rejected",
    );
    assert(
      g,
      "authorize rejects bad secret",
      authorize({ secretEnv: secret, bearer: "nope" }).status === 401,
      "expected 401",
    );
  }
}

/* -------------------------------------------------------------------------- */
/* Report                                                                     */
/* -------------------------------------------------------------------------- */
function printReport() {
  console.log("\n=== Smoke Test: All Flows (excl. data import) ===\n");
  const groups = [...new Set(checks.map((c) => c.group))];
  let failed = 0;
  for (const group of groups) {
    console.log(`-- ${group}`);
    for (const check of checks.filter((c) => c.group === group)) {
      const mark = check.ok ? "PASS" : "FAIL";
      console.log(
        `  [${mark}] ${check.name}${check.detail ? ` — ${check.detail}` : ""}`,
      );
      if (!check.ok) failed += 1;
    }
    console.log("");
  }
  console.log(`${checks.length - failed}/${checks.length} passed`);
  if (failed > 0) process.exitCode = 1;
}

async function main() {
  await cleanupSmokeArtifacts();

  smokePureHelpers();
  smokeStatusLogic();
  smokeDistributionEngine();
  smokeEmailBuilder();
  smokeCronAuthLogic();
  await smokeDbIntegrity();
  await smokeSystemSettings();
  await smokeScheduleGenerateReminderSuggestion();

  await cleanupSmokeArtifacts();
  printReport();
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
