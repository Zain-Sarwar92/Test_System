"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createCredentialUser } from "@/lib/create-credential-user";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";
import {  assertNoDuplicateAssignments,
  parseAssignmentsJson,
  type AssignmentInput,
} from "@/lib/teacher-assignments";

const teacherCreateSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().email(),
  password: z.string().min(8).max(72),
  assignments: z.string().optional(),
});

const teacherUpdateSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(2).max(120),
  assignments: z.string().optional(),
});

async function validateAssignmentsForOrg(
  organizationId: string,
  rows: AssignmentInput[],
  options?: { excludeTeacherId?: string },
) {
  assertNoDuplicateAssignments(rows);
  if (rows.length === 0) return;

  const classIds = [...new Set(rows.map((r) => r.classId))];
  const sectionIds = [...new Set(rows.map((r) => r.sectionId))];
  const subjectIds = [...new Set(rows.map((r) => r.subjectId))];

  const [classes, sections, subjects, conflicting] = await Promise.all([
    prisma.class.findMany({
      where: { id: { in: classIds } },
      select: { id: true, name: true },
    }),
    prisma.section.findMany({
      where: { id: { in: sectionIds }, organizationId },
      select: { id: true, classId: true, name: true },
    }),
    prisma.subject.findMany({
      where: { id: { in: subjectIds } },
      select: { id: true, classId: true, name: true },
    }),
    prisma.teacherAssignment.findMany({
      where: {
        section: { organizationId },
        OR: rows.map((row) => ({
          sectionId: row.sectionId,
          subjectId: row.subjectId,
        })),
        ...(options?.excludeTeacherId
          ? { teacherId: { not: options.excludeTeacherId } }
          : {}),
      },
      select: {
        section: { select: { name: true } },
        subject: { select: { name: true } },
        class: { select: { name: true } },
        teacher: { select: { name: true } },
      },
      take: 1,
    }),
  ]);

  const classById = new Map(classes.map((c) => [c.id, c]));
  const sectionById = new Map(sections.map((s) => [s.id, s]));
  const subjectById = new Map(subjects.map((s) => [s.id, s]));

  for (const row of rows) {
    const klass = classById.get(row.classId);
    const section = sectionById.get(row.sectionId);
    const subject = subjectById.get(row.subjectId);

    if (!klass) {
      throw new Error(
        "One or more selected classes no longer exist. Refresh the page and try again.",
      );
    }
    if (!section) {
      throw new Error(
        "One or more selected sections do not belong to your organization.",
      );
    }
    if (!subject) {
      throw new Error(
        "One or more selected subjects no longer exist. Refresh the page and try again.",
      );
    }
    if (section.classId !== row.classId) {
      throw new Error(
        `Section ${section.name} does not belong to the selected class.`,
      );
    }
    if (subject.classId !== row.classId) {
      throw new Error(
        `${subject.name} is not taught in the selected class.`,
      );
    }
  }

  const clash = conflicting[0];
  if (clash) {
    throw new Error(
      `${clash.subject.name} for ${clash.class.name} ${clash.section.name} is already assigned to ${clash.teacher.name}. Pick a different section or subject.`,
    );
  }
}

function revalidateTeachers(teacherId?: string) {
  revalidatePath("/org-admin/teachers");
  revalidatePath("/org-admin/teachers/new");
  revalidatePath("/org-admin");
  revalidatePath("/org-admin/schedules/new");
  revalidatePath("/teacher/generate");
  revalidatePath("/teacher");
  if (teacherId) {
    revalidatePath(`/org-admin/teachers/${teacherId}`);
    revalidatePath(`/org-admin/teachers/${teacherId}/edit`);
  }
}

export async function createTeacher(formData: FormData) {
  try {
    const session = await requireRole(["ORG_ADMIN"]);
    const organizationId = session.user.organizationId;
    if (!organizationId) {
      return { ok: false as const, error: "Organization not linked to this admin" };
    }

    const parsed = teacherCreateSchema.parse({
      name: formData.get("name"),
      email: formData.get("email"),
      password: formData.get("password"),
      assignments: String(formData.get("assignments") ?? "[]"),
    });

    const assignments = parseAssignmentsJson(parsed.assignments);
    await validateAssignmentsForOrg(organizationId, assignments);

    const existing = await prisma.user.findUnique({
      where: { email: parsed.email },
      include: {
        orgMemberships: {
          where: { organizationId },
        },
      },
    });

    if (existing) {
      if (existing.orgMemberships.length > 0) {
        return {
          ok: false as const,
          error: "This teacher is already a member of your organization",
        };
      }

      await prisma.$transaction(async (tx) => {
        await tx.user.update({
          where: { id: existing.id },
          data: {
            name: parsed.name,
            role: "TEACHER",
            teacherLevel: null,
            phone: null,
            qualification: null,
            experience: null,
            organizationId,
            isActive: true,
          },
        });
        await tx.orgMembership.create({
          data: {
            userId: existing.id,
            organizationId,
            role: "TEACHER",
            isActive: true,
          },
        });
        for (const row of assignments) {
          await tx.teacherAssignment.create({
            data: {
              teacherId: existing.id,
              classId: row.classId,
              sectionId: row.sectionId,
              subjectId: row.subjectId,
            },
          });
        }
      });
    } else {
      let createdUserId: string | null = null;
      try {
        const created = await createCredentialUser({
          email: parsed.email,
          password: parsed.password,
          name: parsed.name,
        });
        createdUserId = created.id;

        await prisma.$transaction(async (tx) => {
          await tx.user.update({
            where: { id: createdUserId! },
            data: {
              role: "TEACHER",
              teacherLevel: null,
              phone: null,
              qualification: null,
              experience: null,
              organizationId,
              isActive: true,
            },
          });
          await tx.orgMembership.create({
            data: {
              userId: createdUserId!,
              organizationId,
              role: "TEACHER",
              isActive: true,
            },
          });
          for (const row of assignments) {
            await tx.teacherAssignment.create({
              data: {
                teacherId: createdUserId!,
                classId: row.classId,
                sectionId: row.sectionId,
                subjectId: row.subjectId,
              },
            });
          }
        });
      } catch (error) {
        if (createdUserId) {
          await prisma.orgMembership
            .deleteMany({ where: { userId: createdUserId } })
            .catch(() => {});
          await prisma.teacherAssignment
            .deleteMany({ where: { teacherId: createdUserId } })
            .catch(() => {});
          await prisma.user.delete({ where: { id: createdUserId } }).catch(() => {});
        }
        throw error;
      }
    }

    revalidateTeachers();
    return { ok: true as const };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        ok: false as const,
        error: error.issues[0]?.message ?? "Invalid teacher data",
      };
    }

    return {
      ok: false as const,
      error: error instanceof Error ? error.message : "Failed to create teacher",
    };
  }
}

export async function updateTeacher(formData: FormData) {
  try {
    const session = await requireRole(["ORG_ADMIN"]);
    const organizationId = session.user.organizationId;
    if (!organizationId) {
      return { ok: false as const, error: "Organization not linked to this admin" };
    }

    const parsed = teacherUpdateSchema.parse({
      id: formData.get("id"),
      name: formData.get("name"),
      assignments: String(formData.get("assignments") ?? "[]"),
    });

    const membership = await prisma.orgMembership.findFirst({
      where: {
        userId: parsed.id,
        organizationId,
        role: "TEACHER",
      },
      select: { id: true },
    });
    if (!membership) {
      return { ok: false as const, error: "Teacher not found in this organization" };
    }

    const assignments = parseAssignmentsJson(parsed.assignments);
    await validateAssignmentsForOrg(organizationId, assignments, {
      excludeTeacherId: parsed.id,
    });

    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: parsed.id },
        data: {
          name: parsed.name,
          teacherLevel: null,
          phone: null,
          qualification: null,
          experience: null,
        },
      });
      await tx.teacherAssignment.deleteMany({ where: { teacherId: parsed.id } });
      for (const row of assignments) {
        await tx.teacherAssignment.create({
          data: {
            teacherId: parsed.id,
            classId: row.classId,
            sectionId: row.sectionId,
            subjectId: row.subjectId,
          },
        });
      }
    });

    revalidateTeachers(parsed.id);
    return { ok: true as const };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        ok: false as const,
        error: error.issues[0]?.message ?? "Invalid teacher data",
      };
    }
    return {
      ok: false as const,
      error: error instanceof Error ? error.message : "Failed to update teacher",
    };
  }
}

export async function toggleTeacherActive(formData: FormData) {
  const session = await requireRole(["ORG_ADMIN"]);
  const organizationId = session.user.organizationId;
  if (!organizationId) {
    throw new Error("Organization not linked");
  }

  const id = z.string().min(1).parse(formData.get("id"));
  const membership = await prisma.orgMembership.findFirst({
    where: { userId: id, organizationId, role: "TEACHER" },
  });
  if (!membership) {
    throw new Error("Teacher not found in this organization");
  }

  await prisma.orgMembership.update({
    where: { id: membership.id },
    data: { isActive: !membership.isActive },
  });

  revalidateTeachers(id);
}

export async function deleteTeacher(formData: FormData) {
  const session = await requireRole(["ORG_ADMIN"]);
  const organizationId = session.user.organizationId;
  if (!organizationId) {
    throw new Error("Organization not linked");
  }

  const id = z.string().min(1).parse(formData.get("id"));

  const membership = await prisma.orgMembership.findFirst({
    where: { userId: id, organizationId, role: "TEACHER" },
    include: {
      user: {
        select: {
          id: true,
          role: true,
          orgMemberships: {
            select: { id: true, organizationId: true, role: true },
          },
        },
      },
    },
  });

  if (!membership) {
    throw new Error("Teacher not found in this organization");
  }
  if (membership.isActive) {
    throw new Error("Deactivate the teacher before deleting");
  }
  if (membership.user.role !== "TEACHER") {
    throw new Error("Only teacher accounts can be deleted here");
  }
  if (membership.user.id === session.user.id) {
    throw new Error("You cannot delete your own account");
  }

  const otherMemberships = membership.user.orgMemberships.filter(
    (item) => item.organizationId !== organizationId,
  );

  const assignmentIds = (
    await prisma.testScheduleAssignment.findMany({
      where: {
        teacherId: id,
        scheduleSubjectClass: {
          scheduleSubject: {
            round: { schedule: { organizationId } },
          },
        },
      },
      select: { id: true },
    })
  ).map((row) => row.id);

  await prisma.$transaction(async (tx) => {
    if (assignmentIds.length > 0) {
      await tx.test.updateMany({
        where: { scheduleAssignmentId: { in: assignmentIds } },
        data: { scheduleAssignmentId: null },
      });
      await tx.testScheduleAssignment.deleteMany({
        where: { id: { in: assignmentIds } },
      });
    }

    await tx.orgMembership.delete({ where: { id: membership.id } });

    if (otherMemberships.length > 0) {
      const next = otherMemberships[0];
      const user = await tx.user.findUnique({
        where: { id },
        select: { organizationId: true },
      });
      if (user?.organizationId === organizationId) {
        await tx.user.update({
          where: { id },
          data: {
            organizationId: next.organizationId,
            role: next.role,
          },
        });
      }
    } else {
      await tx.session.deleteMany({ where: { userId: id } });
      await tx.account.deleteMany({ where: { userId: id } });
      await tx.teacherAssignment.deleteMany({ where: { teacherId: id } });
      await tx.teacherSubject.deleteMany({ where: { teacherId: id } });
      await tx.user.update({
        where: { id },
        data: {
          isActive: false,
          organizationId: null,
        },
      });
    }
  });

  revalidateTeachers(id);
  revalidatePath("/org-admin/schedules");
  revalidatePath("/org-admin/tests");
  revalidatePath("/teacher/schedules");
}
