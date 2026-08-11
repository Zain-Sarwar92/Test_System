"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";

async function requireOrgAdmin() {
  const session = await requireRole(["ORG_ADMIN"]);
  const organizationId = session.user.organizationId;
  if (!organizationId) {
    throw new Error("Organization not linked to this admin");
  }
  return { session, organizationId, adminId: session.user.id };
}

const classAssignmentSchema = z.object({
  classId: z.string().min(1),
  subjectId: z.string().min(1),
  sectionAssignments: z
    .array(
      z.object({
        sectionId: z.string().min(1),
        teacherId: z.string().min(1),
      }),
    )
    .min(1, "Add at least one section assignment per class"),
});

const scheduleSubjectSchema = z.object({
  subjectName: z.string().trim().min(1).max(120),
  testDate: z.string().trim().min(1),
  classAssignments: z.array(classAssignmentSchema).min(1, "Select at least one class"),
});

const scheduleRoundSchema = z.object({
  name: z.string().trim().min(1).max(120),
  order: z.number().int().min(0),
  subjects: z.array(scheduleSubjectSchema).min(1, "Add at least one subject per round"),
});

const scheduleSchema = z.object({
  name: z.string().trim().min(2).max(200),
  rounds: z.array(scheduleRoundSchema).min(1, "Add at least one round"),
});

function parseTestDate(raw: string) {
  const date = new Date(`${raw}T00:00:00`);
  if (Number.isNaN(date.getTime())) {
    throw new Error("Invalid test date");
  }
  return date;
}

function assertNoDuplicateSubjectDatesInRounds(
  input: z.infer<typeof scheduleSchema>,
) {
  for (const round of input.rounds) {
    const seen = new Set<string>();
    for (const subjectItem of round.subjects) {
      const key = `${subjectItem.subjectName.trim().toLowerCase()}|${subjectItem.testDate}`;
      if (seen.has(key)) {
        throw new Error(
          `Duplicate date for ${subjectItem.subjectName} on ${subjectItem.testDate} in ${round.name}. Each subject date must be unique within a round.`,
        );
      }
      seen.add(key);
    }
  }
}

async function validateSchedulePayload(
  organizationId: string,
  input: z.infer<typeof scheduleSchema>,
) {
  const allSubjects = input.rounds.flatMap((round) => round.subjects);
  const allSubjectIds = [
    ...new Set(
      allSubjects.flatMap((s) => s.classAssignments.map((a) => a.subjectId)),
    ),
  ];
  const allTeacherIds = [
    ...new Set(
      allSubjects.flatMap((s) =>
        s.classAssignments.flatMap((a) =>
          a.sectionAssignments.map((sectionAssignment) => sectionAssignment.teacherId),
        ),
      ),
    ),
  ];
  const allSectionIds = [
    ...new Set(
      allSubjects.flatMap((s) =>
        s.classAssignments.flatMap((a) =>
          a.sectionAssignments.map((sectionAssignment) => sectionAssignment.sectionId),
        ),
      ),
    ),
  ];

  const [subjects, memberships, sections, mappings] = await Promise.all([
    prisma.subject.findMany({
      where: { id: { in: allSubjectIds } },
      select: {
        id: true,
        name: true,
        classId: true,
        class: { select: { name: true } },
      },
    }),
    prisma.orgMembership.findMany({
      where: {
        organizationId,
        role: "TEACHER",
        isActive: true,
        userId: { in: allTeacherIds },
        user: { isActive: true },
      },
      select: {
        userId: true,
        user: { select: { name: true } },
      },
    }),
    prisma.section.findMany({
      where: {
        id: { in: allSectionIds },
        organizationId,
      },
      select: { id: true, name: true, classId: true },
    }),
    prisma.teacherAssignment.findMany({
      where: {
        subjectId: { in: allSubjectIds },
        teacherId: { in: allTeacherIds },
        sectionId: { in: allSectionIds },
      },
      select: {
        teacherId: true,
        subjectId: true,
        classId: true,
        sectionId: true,
      },
    }),
  ]);

  const subjectById = new Map(subjects.map((s) => [s.id, s]));
  const membershipByUserId = new Map(memberships.map((m) => [m.userId, m]));
  const sectionById = new Map(sections.map((s) => [s.id, s]));
  const mappingKeys = new Set(
    mappings.map(
      (m) => `${m.teacherId}:${m.classId}:${m.sectionId}:${m.subjectId}`,
    ),
  );

  for (const round of input.rounds) {
    for (const subjectItem of round.subjects) {
      const classIds = new Set<string>();
      for (const assignment of subjectItem.classAssignments) {
        if (classIds.has(assignment.classId)) {
          throw new Error(
            `Duplicate class selected for ${subjectItem.subjectName} in ${round.name}`,
          );
        }
        classIds.add(assignment.classId);

        const subject = subjectById.get(assignment.subjectId);
        if (!subject) {
          throw new Error("Subject mapping not found");
        }
        if (subject.name !== subjectItem.subjectName) {
          throw new Error(
            `Selected class does not belong to ${subjectItem.subjectName}`,
          );
        }
        if (subject.classId !== assignment.classId) {
          throw new Error("Selected class-subject combination is invalid");
        }

        const uniqueSections = new Set<string>();

        for (const sectionAssignment of assignment.sectionAssignments) {
          const section = sectionById.get(sectionAssignment.sectionId);
          if (!section) {
            throw new Error("One or more selected sections were not found");
          }
          if (section.classId !== assignment.classId) {
            throw new Error(
              `Section ${section.name} does not belong to the selected class`,
            );
          }
          if (uniqueSections.has(section.id)) {
            throw new Error(
              `Duplicate section selected for ${subjectItem.subjectName} · ${subject.class.name} in ${round.name}`,
            );
          }
          uniqueSections.add(section.id);

          const teacherId = sectionAssignment.teacherId;
          const membership = membershipByUserId.get(teacherId);
          if (!membership) {
            throw new Error(
              "One or more selected teachers are inactive or outside your organization",
            );
          }
          const eligibilityKey = `${teacherId}:${assignment.classId}:${section.id}:${assignment.subjectId}`;
          if (!mappingKeys.has(eligibilityKey)) {
            throw new Error(
              `${membership.user.name} is not assigned to ${subject.class.name} · ${section.name} · ${subject.name}`,
            );
          }
        }
      }
    }
  }
}

async function revalidateScheduleViews(scheduleId?: string) {
  revalidatePath("/org-admin");
  revalidatePath("/org-admin/schedules");
  if (scheduleId) {
    revalidatePath(`/org-admin/schedules/${scheduleId}`);
  }
  revalidatePath("/teacher");
  revalidatePath("/teacher/schedules");
}

export async function createTestSchedule(input: z.infer<typeof scheduleSchema>) {
  try {
    const { organizationId, adminId } = await requireOrgAdmin();
    const parsed = scheduleSchema.parse(input);
    assertNoDuplicateSubjectDatesInRounds(parsed);
    await validateSchedulePayload(organizationId, parsed);

    const allSectionIds = [
      ...new Set(
        parsed.rounds.flatMap((round) =>
          round.subjects.flatMap((s) =>
            s.classAssignments.flatMap((a) =>
              a.sectionAssignments.map((row) => row.sectionId),
            ),
          ),
        ),
      ),
    ];
    const sections = await prisma.section.findMany({
      where: { id: { in: allSectionIds }, organizationId },
      select: { id: true, name: true },
    });
    const sectionNameById = new Map(sections.map((s) => [s.id, s.name]));

    const schedule = await prisma.testSchedule.create({
      data: {
        name: parsed.name,
        organizationId,
        createdById: adminId,
        status: "ACTIVE",
        rounds: {
          create: parsed.rounds.map((round) => ({
            name: round.name.trim(),
            order: round.order,
            subjects: {
              create: round.subjects.map((subjectItem) => ({
                subjectName: subjectItem.subjectName,
                testDate: parseTestDate(subjectItem.testDate),
                classes: {
                  create: subjectItem.classAssignments.map((assignment) => ({
                    classId: assignment.classId,
                    subjectId: assignment.subjectId,
                    assignments: {
                      create: assignment.sectionAssignments.map(
                        (sectionAssignment) => ({
                          teacherId: sectionAssignment.teacherId,
                          sectionId: sectionAssignment.sectionId,
                          sectionName:
                            sectionNameById.get(sectionAssignment.sectionId) ??
                            null,
                        }),
                      ),
                    },
                  })),
                },
              })),
            },
          })),
        },
      },
      select: { id: true },
    });

    await revalidateScheduleViews(schedule.id);
    return { ok: true as const, scheduleId: schedule.id };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        ok: false as const,
        error: error.issues[0]?.message ?? "Invalid schedule data",
      };
    }
    return {
      ok: false as const,
      error: error instanceof Error ? error.message : "Failed to create schedule",
    };
  }
}

export async function cancelTestSchedule(formData: FormData) {
  const { organizationId } = await requireOrgAdmin();
  const id = z.string().min(1).parse(formData.get("id"));
  const existing = await prisma.testSchedule.findFirst({
    where: { id, organizationId },
    select: { id: true },
  });
  if (!existing) {
    throw new Error("Schedule not found");
  }

  await prisma.testSchedule.update({
    where: { id },
    data: { status: "CANCELLED" },
  });

  await revalidateScheduleViews(id);
}

export async function deleteTestSchedule(formData: FormData) {
  const { organizationId } = await requireOrgAdmin();
  const id = z.string().min(1).parse(formData.get("id"));

  const existing = await prisma.testSchedule.findFirst({
    where: { id, organizationId },
    select: {
      id: true,
      rounds: {
        select: {
          subjects: {
            select: {
              classes: {
                select: {
                  assignments: {
                    select: { id: true, test: { select: { id: true } } },
                  },
                },
              },
            },
          },
        },
      },
    },
  });
  if (!existing) {
    throw new Error("Schedule not found");
  }

  const assignmentIds = existing.rounds.flatMap((round) =>
    round.subjects.flatMap((subjectItem) =>
      subjectItem.classes.flatMap((classItem) =>
        classItem.assignments.map((assignment) => assignment.id),
      ),
    ),
  );

  await prisma.$transaction(async (tx) => {
    if (assignmentIds.length > 0) {
      await tx.test.updateMany({
        where: { scheduleAssignmentId: { in: assignmentIds } },
        data: { scheduleAssignmentId: null },
      });
    }
    await tx.testSchedule.delete({ where: { id } });
  });

  await revalidateScheduleViews();
  redirect("/org-admin/schedules");
}
