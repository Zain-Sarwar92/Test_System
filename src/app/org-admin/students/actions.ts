"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";
import { assertOrgModule } from "@/lib/org-modules";
import { suggestNextRollNumber } from "@/lib/roll-number";
import {
  ARTS_ELECTIVE_GROUP,
  SCIENCE_ELECTIVE_GROUP,
  isHigherSecondaryClass,
  resolveSubjectMeta,
  streamFromStudyGroup,
  type StudentStream,
  type StudyGroup,
} from "@/lib/subject-stream";

const studentSchema = z.object({
  id: z.string().min(1).optional(),
  rollNumber: z.string().trim().max(50, "Roll number must be 50 characters or fewer."),
  name: z.string().trim().min(2, "Enter the student's full name.").max(120),
  fatherName: z.string().trim().min(2, "Enter the father's name.").max(120),
  phone: z
    .string()
    .trim()
    .min(1, "Enter a valid phone number with at least 10 digits.")
    .max(40, "Phone number must be 40 characters or fewer.")
    .refine(
      (value) => (value.match(/\d/g)?.length ?? 0) >= 10,
      "Enter a valid phone number with at least 10 digits.",
    ),
  sectionId: z.string().min(1, "Select a section."),
  stream: z.enum(["SCIENCE", "ARTS"]),
  studyGroup: z.enum(["PRE_MEDICAL", "PRE_ENGINEERING", "ICS", "ARTS"]).optional(),
  electiveSubjectId: z.string().optional(),
  electiveSubjectIds: z.array(z.string().min(1)).optional(),
});

const fieldTypeSchema = z.enum(["TEXT", "NUMBER", "DATE", "BOOLEAN", "SELECT"]);

const fieldSchema = z.object({
  id: z.string().min(1).optional(),
  label: z.string().trim().min(1, "Label is required").max(100),
  type: fieldTypeSchema,
  options: z.string().optional(),
  isRequired: z.boolean(),
});

async function getOrganizationId() {
  const session = await requireRole(["ORG_ADMIN"]);
  const organizationId = session.user.organizationId;
  if (!organizationId) throw new Error("Organization not linked to this admin");
  await assertOrgModule(organizationId, "STUDENTS");
  return organizationId;
}

function actionError(error: unknown, fallback: string) {
  if (error instanceof z.ZodError) {
    return error.issues[0]?.message ?? fallback;
  }
  if (
    error instanceof Error &&
    (error.message.includes("Unique constraint") || error.message.includes("P2002"))
  ) {
    return "That roll number is already used in this section";
  }
  return error instanceof Error ? error.message : fallback;
}

function parseOptions(raw: string | undefined) {
  return [
    ...new Set(
      (raw ?? "")
        .split(",")
        .map((option) => option.trim())
        .filter(Boolean),
    ),
  ];
}

async function validateCustomValues(
  organizationId: string,
  formData: FormData,
) {
  const fields = await prisma.studentFieldDefinition.findMany({
    where: { organizationId, isActive: true },
    orderBy: [{ order: "asc" }, { createdAt: "asc" }],
  });

  return fields.flatMap((field) => {
    const raw = String(formData.get(`custom_${field.id}`) ?? "").trim();
    if (field.isRequired && !raw) {
      throw new Error(`${field.label} is required`);
    }
    if (!raw) return [];

    if (field.type === "NUMBER" && !Number.isFinite(Number(raw))) {
      throw new Error(`${field.label} must be a valid number`);
    }
    if (field.type === "DATE") {
      const date = z.iso.date().safeParse(raw);
      if (!date.success) throw new Error(`${field.label} must be a valid date`);
    }
    if (field.type === "BOOLEAN" && raw !== "true" && raw !== "false") {
      throw new Error(`${field.label} must be Yes or No`);
    }
    if (field.type === "SELECT") {
      const options = Array.isArray(field.options)
        ? field.options.filter((option): option is string => typeof option === "string")
        : [];
      if (!options.includes(raw)) {
        throw new Error(`${field.label} has an invalid selection`);
      }
    }

    return [{ fieldId: field.id, value: raw }];
  });
}

async function validateSection(organizationId: string, sectionId: string) {
  const section = await prisma.section.findFirst({
    where: { id: sectionId, organizationId },
    select: {
      id: true,
      classId: true,
      class: {
        select: {
          name: true,
          subjects: {
            select: {
              id: true,
              name: true,
              track: true,
              electiveGroup: true,
            },
          },
        },
      },
    },
  });
  if (!section) throw new Error("Selected section was not found in your organization");
  return section;
}

async function resolveStreamAndElective(
  section: Awaited<ReturnType<typeof validateSection>>,
  stream: StudentStream,
  electiveSubjectId: string | undefined,
  electiveSubjectIds: string[] | undefined,
  studyGroup?: StudyGroup,
) {
  const metas = section.class.subjects.map(resolveSubjectMeta);
  const selected = [
    ...new Set(
      [
        ...(electiveSubjectIds ?? []),
        ...(electiveSubjectId ? [electiveSubjectId] : []),
      ].filter(Boolean),
    ),
  ];
  const senior = isHigherSecondaryClass(section.class.name);

  if (senior) {
    if (!studyGroup) {
      throw new Error("Select a group (Pre-medical, Pre-engineering, ICS, or Arts).");
    }
    const nextStream = streamFromStudyGroup(studyGroup);
    const electives = metas.filter((subject) => subject.electiveGroup);
    const chosen = selected.filter((id) =>
      electives.some((subject) => subject.id === id),
    );
    const invalid = selected.filter((id) => !chosen.includes(id));
    if (invalid.length > 0) {
      throw new Error("Choose electives from this class only.");
    }
    const sciencePick =
      chosen.find(
        (id) =>
          metas.find((subject) => subject.id === id)?.electiveGroup ===
          SCIENCE_ELECTIVE_GROUP,
      ) ?? null;
    return {
      stream: nextStream,
      studyGroup,
      electiveSubjectId: nextStream === "SCIENCE" ? sciencePick : null,
      electiveChoiceIds: chosen,
    };
  }

  if (stream === "SCIENCE") {
    const scienceElectives = metas.filter(
      (subject) => subject.electiveGroup === SCIENCE_ELECTIVE_GROUP,
    );
    const chosenScience = selected.filter((id) =>
      scienceElectives.some((subject) => subject.id === id),
    );
    if (scienceElectives.length > 0) {
      if (chosenScience.length !== 1) {
        throw new Error("Science students must choose Biology or Computer");
      }
      return {
        stream,
        studyGroup: null as string | null,
        electiveSubjectId: chosenScience[0],
        electiveChoiceIds: chosenScience,
      };
    }
    return {
      stream,
      studyGroup: null as string | null,
      electiveSubjectId: null as string | null,
      electiveChoiceIds: [] as string[],
    };
  }

  const artsElectives = metas.filter(
    (subject) => subject.electiveGroup === ARTS_ELECTIVE_GROUP,
  );
  const chosenArts = selected.filter((id) =>
    artsElectives.some((subject) => subject.id === id),
  );
  const invalid = selected.filter((id) => !chosenArts.includes(id));
  if (invalid.length > 0) {
    throw new Error("Arts students can only choose Arts elective subjects");
  }
  return {
    stream,
    studyGroup: null as string | null,
    electiveSubjectId: null as string | null,
    electiveChoiceIds: chosenArts,
  };
}

async function syncElectiveChoices(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tx: any,
  studentId: string,
  subjectIds: string[],
) {
  await tx.studentElectiveChoice.deleteMany({ where: { studentId } });
  if (subjectIds.length === 0) return;
  await tx.studentElectiveChoice.createMany({
    data: subjectIds.map((subjectId) => ({ studentId, subjectId })),
  });
}

async function nextRollForSection(organizationId: string, sectionId: string) {
  const students = await prisma.student.findMany({
    where: { organizationId, sectionId },
    select: { rollNumber: true },
  });
  return {
    hasStudents: students.length > 0,
    nextRollNumber: suggestNextRollNumber(students.map((student) => student.rollNumber)),
  };
}

export async function getNextRollNumber(sectionId: string) {
  const organizationId = await getOrganizationId();
  const parsedSectionId = z.string().min(1).parse(sectionId);
  await validateSection(organizationId, parsedSectionId);
  return nextRollForSection(organizationId, parsedSectionId);
}

function revalidateStudents(id?: string) {
  revalidatePath("/org-admin/students");
  revalidatePath("/org-admin/students/new");
  revalidatePath("/org-admin/students/fields");
  if (id) {
    revalidatePath(`/org-admin/students/${id}`);
    revalidatePath(`/org-admin/students/${id}/edit`);
  }
}

export async function createStudent(formData: FormData) {
  try {
    const organizationId = await getOrganizationId();
    const electiveSubjectIds = formData
      .getAll("electiveSubjectIds")
      .map(String)
      .filter(Boolean);
    const parsed = studentSchema.parse({
      rollNumber: formData.get("rollNumber"),
      name: formData.get("name"),
      fatherName: formData.get("fatherName"),
      phone: formData.get("phone"),
      sectionId: formData.get("sectionId"),
      stream: formData.get("stream") || "SCIENCE",
      studyGroup:
        String(formData.get("studyGroup") ?? "").trim() || undefined,
      electiveSubjectId: String(formData.get("electiveSubjectId") ?? "") || undefined,
      electiveSubjectIds,
    });
    const section = await validateSection(organizationId, parsed.sectionId);
    const placement = await resolveStreamAndElective(
      section,
      parsed.stream,
      parsed.electiveSubjectId,
      parsed.electiveSubjectIds,
      parsed.studyGroup,
    );
    const rollSuggestion = await nextRollForSection(organizationId, parsed.sectionId);
    const rollNumber = parsed.rollNumber || rollSuggestion.nextRollNumber;
    if (!rollNumber) {
      return {
        ok: false as const,
        error: rollSuggestion.hasStudents
          ? "Could not auto-increment the roll number for this section"
          : "Roll number is required for the first student in this section",
      };
    }
    const customValues = await validateCustomValues(organizationId, formData);

    const duplicate = await prisma.student.findFirst({
      where: {
        organizationId,
        sectionId: parsed.sectionId,
        rollNumber,
      },
      select: { id: true },
    });
    if (duplicate) {
      return { ok: false as const, error: "That roll number is already used in this section" };
    }

    const student = await prisma.$transaction(async (tx) => {
      const created = await tx.student.create({
        data: {
          rollNumber,
          name: parsed.name,
          fatherName: parsed.fatherName,
          phone: parsed.phone,
          sectionId: parsed.sectionId,
          stream: placement.stream,
          studyGroup: placement.studyGroup,
          electiveSubjectId: placement.electiveSubjectId,
          organizationId,
        },
      });
      await syncElectiveChoices(tx, created.id, placement.electiveChoiceIds);
      if (customValues.length) {
        await tx.studentFieldValue.createMany({
          data: customValues.map((value) => ({ ...value, studentId: created.id })),
        });
      }
      return created;
    });
    revalidateStudents(student.id);
    return { ok: true as const, id: student.id };
  } catch (error) {
    return { ok: false as const, error: actionError(error, "Failed to create student") };
  }
}

export async function updateStudent(formData: FormData) {
  try {
    const organizationId = await getOrganizationId();
    const electiveSubjectIds = formData
      .getAll("electiveSubjectIds")
      .map(String)
      .filter(Boolean);
    const parsed = studentSchema.extend({ id: z.string().min(1) }).parse({
      id: formData.get("id"),
      rollNumber: formData.get("rollNumber"),
      name: formData.get("name"),
      fatherName: formData.get("fatherName"),
      phone: formData.get("phone"),
      sectionId: formData.get("sectionId"),
      stream: formData.get("stream") || "SCIENCE",
      studyGroup:
        String(formData.get("studyGroup") ?? "").trim() || undefined,
      electiveSubjectId: String(formData.get("electiveSubjectId") ?? "") || undefined,
      electiveSubjectIds,
    });
    if (!parsed.rollNumber) {
      return { ok: false as const, error: "Roll number is required" };
    }
    const student = await prisma.student.findFirst({
      where: { id: parsed.id, organizationId },
      select: { id: true },
    });
    if (!student) throw new Error("Student not found in your organization");
    const section = await validateSection(organizationId, parsed.sectionId);
    const placement = await resolveStreamAndElective(
      section,
      parsed.stream,
      parsed.electiveSubjectId,
      parsed.electiveSubjectIds,
      parsed.studyGroup,
    );
    const customValues = await validateCustomValues(organizationId, formData);

    const duplicate = await prisma.student.findFirst({
      where: {
        organizationId,
        sectionId: parsed.sectionId,
        rollNumber: parsed.rollNumber,
        id: { not: parsed.id },
      },
      select: { id: true },
    });
    if (duplicate) {
      return { ok: false as const, error: "That roll number is already used in this section" };
    }

    await prisma.$transaction(async (tx) => {
      await tx.student.update({
        where: { id: parsed.id },
        data: {
          rollNumber: parsed.rollNumber,
          name: parsed.name,
          fatherName: parsed.fatherName,
          phone: parsed.phone,
          sectionId: parsed.sectionId,
          stream: placement.stream,
          studyGroup: placement.studyGroup,
          electiveSubjectId: placement.electiveSubjectId,
        },
      });
      await syncElectiveChoices(tx, parsed.id, placement.electiveChoiceIds);
      await tx.studentFieldValue.deleteMany({
        where: {
          studentId: parsed.id,
          field: { organizationId, isActive: true },
        },
      });
      if (customValues.length) {
        await tx.studentFieldValue.createMany({
          data: customValues.map((value) => ({ ...value, studentId: parsed.id })),
        });
      }
    });
    revalidateStudents(parsed.id);
    return { ok: true as const, id: parsed.id };
  } catch (error) {
    return { ok: false as const, error: actionError(error, "Failed to update student") };
  }
}

export async function toggleStudentActive(formData: FormData) {
  try {
    const organizationId = await getOrganizationId();
    const id = z.string().min(1).parse(formData.get("id"));
    const student = await prisma.student.findFirst({
      where: { id, organizationId },
      select: { id: true, isActive: true, name: true },
    });
    if (!student) {
      return { ok: false as const, error: "Student not found in your organization." };
    }
    const nextActive = !student.isActive;
    await prisma.student.updateMany({
      where: { id, organizationId },
      data: { isActive: nextActive },
    });
    revalidateStudents(id);
    return { ok: true as const, active: nextActive, name: student.name };
  } catch (error) {
    return { ok: false as const, error: actionError(error, "Failed to update student status") };
  }
}

export async function deleteStudent(formData: FormData) {
  try {
    const organizationId = await getOrganizationId();
    const id = z.string().min(1).parse(formData.get("id"));
    const student = await prisma.student.findFirst({
      where: { id, organizationId },
      select: {
        id: true,
        name: true,
        isActive: true,
        _count: { select: { feeCharges: true, feePayments: true } },
      },
    });
    if (!student) {
      return { ok: false as const, error: "Student not found in your organization." };
    }
    if (student.isActive) {
      return { ok: false as const, error: "Deactivate the student before deleting." };
    }
    if (student._count.feeCharges || student._count.feePayments) {
      return {
        ok: false as const,
        error: "This student has fee history and cannot be deleted.",
      };
    }
    await prisma.$transaction(async (tx) => {
      await tx.studentMark.deleteMany({ where: { studentId: id } });
      await tx.student.deleteMany({ where: { id, organizationId } });
    });
    revalidateStudents(id);
    revalidatePath("/org-admin/results");
    return { ok: true as const, name: student.name };
  } catch (error) {
    return { ok: false as const, error: actionError(error, "Failed to delete student") };
  }
}

export async function saveStudentField(formData: FormData) {
  try {
    const organizationId = await getOrganizationId();
    const parsed = fieldSchema.parse({
      id: String(formData.get("id") ?? "") || undefined,
      label: formData.get("label"),
      type: formData.get("type"),
      options: String(formData.get("options") ?? ""),
      isRequired: formData.get("isRequired") === "true",
    });
    const options = parseOptions(parsed.options);
    if (parsed.type === "SELECT" && options.length === 0) {
      throw new Error("Dropdown fields require at least one option");
    }

    if (parsed.id) {
      const existing = await prisma.studentFieldDefinition.findFirst({
        where: { id: parsed.id, organizationId },
        select: { id: true },
      });
      if (!existing) throw new Error("Custom field not found");
      await prisma.studentFieldDefinition.updateMany({
        where: { id: parsed.id, organizationId },
        data: {
          label: parsed.label,
          type: parsed.type,
          options: parsed.type === "SELECT" ? options : undefined,
          isRequired: parsed.isRequired,
        },
      });
    } else {
      const last = await prisma.studentFieldDefinition.aggregate({
        where: { organizationId },
        _max: { order: true },
      });
      await prisma.studentFieldDefinition.create({
        data: {
          organizationId,
          label: parsed.label,
          type: parsed.type,
          options: parsed.type === "SELECT" ? options : undefined,
          isRequired: parsed.isRequired,
          order: (last._max.order ?? -1) + 1,
        },
      });
    }
    revalidateStudents();
    return { ok: true as const };
  } catch (error) {
    return { ok: false as const, error: actionError(error, "Failed to save custom field") };
  }
}

export async function toggleStudentField(formData: FormData) {
  try {
    const organizationId = await getOrganizationId();
    const id = z.string().min(1).parse(formData.get("id"));
    const field = await prisma.studentFieldDefinition.findFirst({
      where: { id, organizationId },
      select: { id: true, isActive: true },
    });
    if (!field) {
      return { ok: false as const, error: "Custom field not found" };
    }
    await prisma.studentFieldDefinition.updateMany({
      where: { id, organizationId },
      data: { isActive: !field.isActive },
    });
    revalidateStudents();
    return { ok: true as const, active: !field.isActive };
  } catch (error) {
    return { ok: false as const, error: actionError(error, "Failed to update custom field") };
  }
}

export async function moveStudentField(formData: FormData) {
  try {
    const organizationId = await getOrganizationId();
    const id = z.string().min(1).parse(formData.get("id"));
    const direction = z.enum(["up", "down"]).parse(formData.get("direction"));
    const fields = await prisma.studentFieldDefinition.findMany({
      where: { organizationId },
      orderBy: [{ order: "asc" }, { createdAt: "asc" }],
      select: { id: true, order: true },
    });
    const index = fields.findIndex((field) => field.id === id);
    const swapIndex = direction === "up" ? index - 1 : index + 1;
    if (index < 0 || swapIndex < 0 || swapIndex >= fields.length) {
      return { ok: true as const };
    }
    await prisma.$transaction([
      prisma.studentFieldDefinition.updateMany({
        where: { id: fields[index].id, organizationId },
        data: { order: fields[swapIndex].order },
      }),
      prisma.studentFieldDefinition.updateMany({
        where: { id: fields[swapIndex].id, organizationId },
        data: { order: fields[index].order },
      }),
    ]);
    revalidateStudents();
    return { ok: true as const };
  } catch (error) {
    return { ok: false as const, error: actionError(error, "Failed to reorder custom field") };
  }
}

export async function deleteStudentField(formData: FormData) {
  try {
    const organizationId = await getOrganizationId();
    const id = z.string().min(1).parse(formData.get("id"));
    const confirmation = z.literal("DELETE").parse(formData.get("confirmation"));
    if (confirmation !== "DELETE") {
      return { ok: false as const, error: "Explicit confirmation is required" };
    }
    const field = await prisma.studentFieldDefinition.findFirst({
      where: { id, organizationId },
      select: { id: true, isActive: true },
    });
    if (!field) {
      return { ok: false as const, error: "Custom field not found" };
    }
    if (field.isActive) {
      return { ok: false as const, error: "Deactivate the custom field before deleting" };
    }
    await prisma.studentFieldDefinition.deleteMany({ where: { id, organizationId } });
    revalidateStudents();
    return { ok: true as const };
  } catch (error) {
    return { ok: false as const, error: actionError(error, "Failed to delete custom field") };
  }
}
