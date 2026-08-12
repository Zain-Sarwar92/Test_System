import { prisma } from "@/lib/prisma";
import {
  teacherAssignmentScopeKey,
  type AssignmentInput,
} from "@/lib/teacher-assignments";

export async function loadTeacherAssignmentScope(
  teacherId: string,
  organizationId: string,
): Promise<{ allowedKeys: Set<string>; assignments: AssignmentInput[] }> {
  const rows = await prisma.teacherAssignment.findMany({
    where: {
      teacherId,
      section: { organizationId },
    },
    select: { classId: true, sectionId: true, subjectId: true },
  });

  const allowedKeys = new Set<string>();
  for (const row of rows) {
    allowedKeys.add(teacherAssignmentScopeKey(row.classId, row.subjectId));
  }

  return { allowedKeys, assignments: rows };
}

export async function assertTeacherAssignedToSubject(input: {
  teacherId: string;
  organizationId: string;
  subjectId: string;
  classId?: string;
}) {
  const subject = await prisma.subject.findUnique({
    where: { id: input.subjectId },
    select: { id: true, classId: true, name: true },
  });
  if (!subject) {
    throw new Error("Subject not found");
  }

  const classId = input.classId ?? subject.classId;
  const assignment = await prisma.teacherAssignment.findFirst({
    where: {
      teacherId: input.teacherId,
      classId,
      subjectId: input.subjectId,
      section: { organizationId: input.organizationId },
    },
    select: { id: true },
  });

  if (!assignment) {
    throw new Error(
      `You are not assigned to teach ${subject.name} for this class. Contact your Org Admin.`,
    );
  }
}
