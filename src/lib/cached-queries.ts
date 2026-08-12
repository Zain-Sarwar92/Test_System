import { cache } from "react";
import { prisma } from "@/lib/prisma";

/** Per-request cache — avoids duplicate layout queries on the same navigation. */
export const getTeacherSubjectNames = cache(async (teacherId: string) => {
  const rows = await prisma.teacherAssignment.findMany({
    where: { teacherId },
    select: { subject: { select: { name: true } } },
    orderBy: { subject: { name: "asc" } },
  });

  return [
    ...new Set(rows.map((row) => row.subject.name.trim()).filter(Boolean)),
  ];
});

export const getOrganizationName = cache(async (organizationId: string) => {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { name: true },
  });
  return org?.name ?? null;
});
