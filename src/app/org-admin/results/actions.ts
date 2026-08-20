"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";
import { assertOrgModule } from "@/lib/org-modules";
import { academicSession } from "@/lib/results";
import {
  extractMarksFromSheetImage,
  type ExtractedMarkRow,
} from "@/lib/marks-ocr";
import {
  deleteAssessmentSheetFile,
  readAssessmentSheetBytes,
  saveAssessmentSheetFile,
} from "@/lib/assessment-sheet-storage";

const IMAGE_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

function actionError(error: unknown, fallback: string) {
  if (error instanceof z.ZodError) {
    return error.issues[0]?.message ?? fallback;
  }
  return error instanceof Error ? error.message : fallback;
}

async function getOrganizationId() {
  const session = await requireRole(["ORG_ADMIN"]);
  const organizationId = session.user.organizationId;
  if (!organizationId) throw new Error("Organization not linked to this admin");
  await assertOrgModule(organizationId, "RESULTS");
  return organizationId;
}

function revalidateResults(sectionId?: string, examId?: string, seriesId?: string) {
  revalidatePath("/org-admin/results");
  if (sectionId) revalidatePath(`/org-admin/results/sections/${sectionId}`);
  if (sectionId && seriesId) {
    revalidatePath(`/org-admin/results/sections/${sectionId}/series/${seriesId}`);
    revalidatePath(`/org-admin/results/sections/${sectionId}/series/${seriesId}/combined`);
  }
  if (sectionId && examId) {
    revalidatePath(`/org-admin/results/sections/${sectionId}/exams/${examId}`);
    revalidatePath(`/org-admin/results/sections/${sectionId}/exams/${examId}/select-subjects`);
    revalidatePath(`/org-admin/results/sections/${sectionId}/exams/${examId}/gazette`);
    revalidatePath(`/org-admin/results/sections/${sectionId}/exams/${examId}/print-lists`);
  }
}

export async function createExamTerm(formData: FormData) {
  try {
    const organizationId = await getOrganizationId();
    const sectionId = z.string().min(1).parse(formData.get("sectionId"));
    const parsed = z
      .object({
        name: z.string().trim().min(2, "Exam name is required").max(80),
        session: z.string().trim().min(4).max(20).default(academicSession()),
        examDate: z.string().trim().optional(),
        passPercent: z.coerce.number().int().min(1).max(100).default(33),
      })
      .parse({
        name: formData.get("name"),
        session: formData.get("session") || academicSession(),
        examDate: String(formData.get("examDate") ?? ""),
        passPercent: formData.get("passPercent") || 33,
      });

    const section = await prisma.section.findFirst({
      where: { id: sectionId, organizationId },
      select: { id: true },
    });
    if (!section) throw new Error("Section not found");

    const exam = await prisma.examTerm.upsert({
      where: {
        organizationId_name_session: {
          organizationId,
          name: parsed.name,
          session: parsed.session,
        },
      },
      update: {
        passPercent: parsed.passPercent,
        examDate: parsed.examDate ? new Date(`${parsed.examDate}T00:00:00`) : null,
      },
      create: {
        organizationId,
        name: parsed.name,
        session: parsed.session,
        passPercent: parsed.passPercent,
        examDate: parsed.examDate ? new Date(`${parsed.examDate}T00:00:00`) : null,
      },
    });
    revalidateResults(sectionId, exam.id);
    return { ok: true as const, id: exam.id, sectionId };
  } catch (error) {
    return { ok: false as const, error: actionError(error, "Failed to save exam") };
  }
}

const DEFAULT_ASSESSMENT_TOTAL = 30;

export async function saveExamSectionSubjects(formData: FormData) {
  try {
    const organizationId = await getOrganizationId();
    const sectionId = z.string().min(1).parse(formData.get("sectionId"));
    const examTermId = z.string().min(1).parse(formData.get("examTermId"));
    const subjectIds = [
      ...new Set(
        formData
          .getAll("subjectIds")
          .map(String)
          .filter(Boolean),
      ),
    ];
    if (subjectIds.length === 0) {
      return { ok: false as const, error: "Select at least one subject." };
    }

    const [section, exam] = await Promise.all([
      prisma.section.findFirst({
        where: { id: sectionId, organizationId },
        select: {
          id: true,
          classId: true,
          class: {
            select: {
              subjects: { select: { id: true } },
            },
          },
        },
      }),
      prisma.examTerm.findFirst({
        where: { id: examTermId, organizationId },
        select: { id: true },
      }),
    ]);
    if (!section || !exam) throw new Error("Exam or section not found");

    const allowedSubjectIds = new Set(section.class.subjects.map((subject) => subject.id));
    const invalid = subjectIds.filter((id) => !allowedSubjectIds.has(id));
    if (invalid.length > 0) {
      return { ok: false as const, error: "One or more subjects are not valid for this class." };
    }

    const existing = await prisma.subjectAssessment.findMany({
      where: { organizationId, sectionId, examTermId },
      select: {
        id: true,
        subjectId: true,
        marks: {
          select: { obtainedMarks: true, isAbsent: true },
        },
      },
    });

    const selectedSet = new Set(subjectIds);
    const toRemove = existing.filter((row) => !selectedSet.has(row.subjectId));
    const blocked = toRemove.filter((row) =>
      row.marks.some((mark) => mark.isAbsent || mark.obtainedMarks != null),
    );
    if (blocked.length > 0) {
      return {
        ok: false as const,
        error:
          "Cannot remove subjects that already have marks. Clear those marks first, then edit subjects.",
      };
    }

    await prisma.$transaction(async (tx) => {
      if (toRemove.length > 0) {
        await tx.subjectAssessment.deleteMany({
          where: { id: { in: toRemove.map((row) => row.id) } },
        });
      }

      const existingIds = new Set(existing.map((row) => row.subjectId));
      const toCreate = subjectIds.filter((id) => !existingIds.has(id));
      if (toCreate.length > 0) {
        await tx.subjectAssessment.createMany({
          data: toCreate.map((subjectId) => ({
            organizationId,
            examTermId,
            sectionId,
            subjectId,
            totalMarks: new Prisma.Decimal(DEFAULT_ASSESSMENT_TOTAL),
          })),
        });
      }
    });

    revalidateResults(sectionId, examTermId);
    return { ok: true as const, sectionId, examTermId };
  } catch (error) {
    return {
      ok: false as const,
      error: actionError(error, "Failed to save subject selection"),
    };
  }
}

export async function getOrCreateSubjectAssessment(input: {
  examTermId: string;
  sectionId: string;
  subjectId: string;
  totalMarks?: number;
}) {
  const organizationId = await getOrganizationId();
  const examTermId = z.string().min(1).parse(input.examTermId);
  const sectionId = z.string().min(1).parse(input.sectionId);
  const subjectId = z.string().min(1).parse(input.subjectId);
  const totalMarks = z.coerce.number().positive().max(1000).parse(input.totalMarks || 30);

  const [exam, section, subject] = await Promise.all([
    prisma.examTerm.findFirst({ where: { id: examTermId, organizationId }, select: { id: true } }),
    prisma.section.findFirst({
      where: { id: sectionId, organizationId },
      select: { id: true, classId: true },
    }),
    prisma.subject.findFirst({ where: { id: subjectId }, select: { id: true, classId: true } }),
  ]);
  if (!exam || !section || !subject || subject.classId !== section.classId) {
    throw new Error("Exam, section, or subject was not found");
  }

  const assessment = await prisma.subjectAssessment.upsert({
    where: {
      examTermId_sectionId_subjectId: { examTermId, sectionId, subjectId },
    },
    update: {},
    create: {
      organizationId,
      examTermId,
      sectionId,
      subjectId,
      totalMarks: new Prisma.Decimal(totalMarks),
    },
  });
  // Called from Server Components during render — do not revalidatePath here.
  return assessment.id;
}

export async function updateAssessmentTotal(formData: FormData) {
  try {
    const organizationId = await getOrganizationId();
    const assessmentId = z.string().min(1).parse(formData.get("assessmentId"));
    const totalMarks = z.coerce.number().positive().max(1000).parse(formData.get("totalMarks"));
    const assessment = await prisma.subjectAssessment.findFirst({
      where: { id: assessmentId, organizationId },
      select: { id: true, sectionId: true, examTermId: true },
    });
    if (!assessment) throw new Error("Assessment not found");
    await prisma.subjectAssessment.update({
      where: { id: assessment.id },
      data: { totalMarks: new Prisma.Decimal(totalMarks) },
    });
    revalidateResults(assessment.sectionId, assessment.examTermId);
    return { ok: true as const };
  } catch (error) {
    return { ok: false as const, error: actionError(error, "Failed to update total marks") };
  }
}

export async function saveStudentMarks(formData: FormData) {
  try {
    const organizationId = await getOrganizationId();
    const assessmentId = z.string().min(1).parse(formData.get("assessmentId"));
    const totalMarksRaw = String(formData.get("totalMarks") ?? "").trim();
    const totalMarksInput =
      totalMarksRaw.length > 0
        ? z.coerce.number().positive().max(1000).parse(totalMarksRaw)
        : null;
    const raw = z.string().parse(formData.get("marks"));
    const parsedPayload = JSON.parse(raw) as unknown;
    const marksPayload = z
      .object({
        studentMarks: z.array(
          z.object({
            studentId: z.string().min(1),
            obtained: z.string(),
            absent: z.boolean(),
          }),
        ),
        manualMarks: z.array(
          z.object({
            id: z.string().min(1).optional(),
            rollNumber: z.string().trim().min(1).max(50),
            name: z.string().trim().min(1).max(120),
            fatherName: z.string().trim().max(120).optional(),
            obtained: z.string(),
            absent: z.boolean(),
          }),
        ),
      })
      .parse(parsedPayload);
    const rows = marksPayload.studentMarks;
    const manualRows = marksPayload.manualMarks;

    const assessment = await prisma.subjectAssessment.findFirst({
      where: { id: assessmentId, organizationId },
      select: {
        id: true,
        sectionId: true,
        examTermId: true,
        totalMarks: true,
        section: { select: { id: true } },
      },
    });
    if (!assessment) throw new Error("Assessment not found");

    const students = await prisma.student.findMany({
      where: { organizationId, sectionId: assessment.sectionId, isActive: true },
      select: { id: true, rollNumber: true },
    });
    const allowed = new Set(students.map((student) => student.id));
    const enrolledRolls = new Set(
      students.map((student) => student.rollNumber.trim().toLowerCase()),
    );
    const max =
      totalMarksInput !== null ? totalMarksInput : Number(assessment.totalMarks);

    const manualRolls = new Set<string>();
    for (const row of manualRows) {
      const rollKey = row.rollNumber.trim().toLowerCase();
      if (manualRolls.has(rollKey)) {
        throw new Error(`Duplicate roll number ${row.rollNumber} in extra rows`);
      }
      manualRolls.add(rollKey);
      if (enrolledRolls.has(rollKey)) {
        throw new Error(
          `Roll ${row.rollNumber} is already on the section list — use that row instead of adding an extra one.`,
        );
      }
    }

    await prisma.$transaction(async (tx) => {
      if (totalMarksInput !== null && totalMarksInput !== Number(assessment.totalMarks)) {
        await tx.subjectAssessment.update({
          where: { id: assessment.id },
          data: { totalMarks: new Prisma.Decimal(totalMarksInput) },
        });
      }

      for (const row of rows) {
        if (!allowed.has(row.studentId)) continue;
        const obtained = row.absent ? null : row.obtained.trim();
        if (!row.absent && obtained) {
          const value = Number(obtained);
          if (!Number.isFinite(value) || value < 0 || value > max) {
            throw new Error(`Marks must be between 0 and ${max}`);
          }
        }
        const obtainedMarks =
          row.absent || !obtained ? null : new Prisma.Decimal(obtained);
        await tx.studentMark.upsert({
          where: {
            assessmentId_studentId: {
              assessmentId: assessment.id,
              studentId: row.studentId,
            },
          },
          update: { obtainedMarks, isAbsent: row.absent },
          create: {
            assessmentId: assessment.id,
            studentId: row.studentId,
            obtainedMarks,
            isAbsent: row.absent,
          },
        });
      }

      const keepManualIds = new Set<string>();
      for (const row of manualRows) {
        const obtained = row.absent ? null : row.obtained.trim();
        if (!row.absent && obtained) {
          const value = Number(obtained);
          if (!Number.isFinite(value) || value < 0 || value > max) {
            throw new Error(`Marks must be between 0 and ${max}`);
          }
        }
        const obtainedMarks =
          row.absent || !obtained ? null : new Prisma.Decimal(obtained);
        const data = {
          rollNumber: row.rollNumber.trim(),
          name: row.name.trim(),
          fatherName: (row.fatherName ?? "").trim(),
          obtainedMarks,
          isAbsent: row.absent,
        };
        if (row.id) {
          const existing = await tx.assessmentManualMark.findFirst({
            where: { id: row.id, assessmentId: assessment.id },
            select: { id: true },
          });
          if (!existing) {
            throw new Error(`Extra row not found for roll ${row.rollNumber}`);
          }
          await tx.assessmentManualMark.update({
            where: { id: row.id },
            data,
          });
          keepManualIds.add(row.id);
        } else {
          const created = await tx.assessmentManualMark.create({
            data: { assessmentId: assessment.id, ...data },
          });
          keepManualIds.add(created.id);
        }
      }

      await tx.assessmentManualMark.deleteMany({
        where:
          keepManualIds.size === 0
            ? { assessmentId: assessment.id }
            : {
                assessmentId: assessment.id,
                id: { notIn: [...keepManualIds] },
              },
      });
    });
    revalidateResults(assessment.sectionId, assessment.examTermId);
    return { ok: true as const };
  } catch (error) {
    return { ok: false as const, error: actionError(error, "Failed to save marks") };
  }
}

export async function uploadAssessmentSheet(formData: FormData) {
  try {
    const organizationId = await getOrganizationId();
    const assessmentId = z.string().min(1).parse(formData.get("assessmentId"));
    const file = formData.get("sheet");
    if (!(file instanceof File) || file.size === 0) {
      return { ok: false as const, error: "Choose a photo of the filled marks sheet" };
    }
    if (file.size > 8 * 1024 * 1024) {
      return { ok: false as const, error: "Image must be 8 MB or smaller" };
    }
    if (process.env.VERCEL && file.size > 2 * 1024 * 1024) {
      return { ok: false as const, error: "On hosting, sheet photos must be 2 MB or smaller" };
    }
    const ext = IMAGE_TYPES[file.type];
    if (!ext) return { ok: false as const, error: "Upload a JPG, PNG, or WEBP image" };

    const assessment = await prisma.subjectAssessment.findFirst({
      where: { id: assessmentId, organizationId },
      select: {
        id: true,
        sectionId: true,
        examTermId: true,
        sheets: { select: { id: true, imagePath: true } },
      },
    });
    if (!assessment) throw new Error("Assessment not found");

    const imagePath = await saveAssessmentSheetFile({
      organizationId,
      assessmentId: assessment.id,
      ext,
      mimeType: file.type,
      bytes: Buffer.from(await file.arrayBuffer()),
    });

    // One active photo per assessment — replace any previous uploads.
    for (const old of assessment.sheets) {
      await deleteAssessmentSheetFile(old.imagePath).catch(() => undefined);
    }
    if (assessment.sheets.length > 0) {
      await prisma.assessmentSheet.deleteMany({
        where: { assessmentId: assessment.id },
      });
    }

    const sheet = await prisma.assessmentSheet.create({
      data: {
        assessmentId: assessment.id,
        imagePath,
        originalName: file.name.slice(0, 180),
      },
      select: { id: true },
    });
    revalidateResults(assessment.sectionId, assessment.examTermId);
    return { ok: true as const, sheetId: sheet.id };
  } catch (error) {
    return { ok: false as const, error: actionError(error, "Failed to upload sheet") };
  }
}

/**
 * Reads handwritten marks off an uploaded sheet photo. Nothing is saved here —
 * the values go back to the entry table so the admin can verify them first.
 */
function friendlySheetReadError(error: string) {
  const lower = error.toLowerCase();
  if (lower.includes("gemini_api_key")) {
    return "Photo reading is not configured. Enter marks manually for now.";
  }
  if (lower.includes("sheet not found") || lower.includes("missing on the server")) {
    return "Photo file missing. Upload the sheet again.";
  }
  if (lower.includes("no marks found") || lower.includes("could not read marks")) {
    return error;
  }
  if (lower.includes("gemini") || lower.includes("request failed")) {
    return "Could not read the photo. Try a clearer image or enter marks manually.";
  }
  if (error.length > 140) {
    return "Could not read marks from this photo. Try again or enter them manually.";
  }
  return error;
}

export async function readMarksFromSheet(input: {
  sheetId: string;
}): Promise<
  | {
      ok: true;
      rows: ExtractedMarkRow[];
      totalMarks: number;
      sheetTotalMarks: number | null;
    }
  | { ok: false; error: string }
> {
  try {
    const organizationId = await getOrganizationId();
    const parsed = z
      .object({
        sheetId: z.string().min(1),
      })
      .parse(input);

    const sheet = await prisma.assessmentSheet.findFirst({
      where: { id: parsed.sheetId, assessment: { organizationId } },
      select: {
        imagePath: true,
        assessment: { select: { totalMarks: true } },
      },
    });
    if (!sheet) throw new Error("Sheet not found");

    let file: Buffer;
    let mimeType: string;
    try {
      const stored = await readAssessmentSheetBytes(sheet.imagePath);
      file = stored.bytes;
      mimeType = stored.mimeType;
    } catch {
      throw new Error("Sheet image file is missing on the server. Upload it again.");
    }

    const totalMarks = Number(sheet.assessment.totalMarks);
    const extracted = await extractMarksFromSheetImage({
      base64Image: file.toString("base64"),
      mimeType,
      totalMarks,
    });
    return {
      ok: true as const,
      rows: extracted.rows,
      totalMarks,
      sheetTotalMarks: extracted.sheetTotalMarks,
    };
  } catch (error) {
    return {
      ok: false as const,
      error: friendlySheetReadError(actionError(error, "Failed to read marks from the sheet")),
    };
  }
}

export async function deleteAssessmentSheet(formData: FormData) {
  const organizationId = await getOrganizationId();
  const id = z.string().min(1).parse(formData.get("id"));
  const sheet = await prisma.assessmentSheet.findFirst({
    where: { id, assessment: { organizationId } },
    select: {
      id: true,
      imagePath: true,
      assessment: { select: { sectionId: true, examTermId: true } },
    },
  });
  if (!sheet) throw new Error("Sheet not found");
  await deleteAssessmentSheetFile(sheet.imagePath);
  await prisma.assessmentSheet.delete({ where: { id } });
  revalidateResults(sheet.assessment.sectionId, sheet.assessment.examTermId);
}

/** Clears all marks/sheets for one section + exam (does not delete the exam itself). */
export async function deleteSectionExamResult(formData: FormData) {
  try {
    const organizationId = await getOrganizationId();
    const sectionId = z.string().min(1).parse(formData.get("sectionId"));
    const examTermId = z.string().min(1).parse(formData.get("examTermId"));

    const [section, exam] = await Promise.all([
      prisma.section.findFirst({
        where: { id: sectionId, organizationId },
        select: { id: true },
      }),
      prisma.examTerm.findFirst({
        where: { id: examTermId, organizationId },
        select: { id: true, seriesId: true },
      }),
    ]);
    if (!section || !exam) {
      return { ok: false as const, error: "Exam or section not found" };
    }

    const existing = await prisma.subjectAssessment.findMany({
      where: { organizationId, sectionId, examTermId },
      select: { id: true, sheets: { select: { imagePath: true } } },
    });

    for (const assessment of existing) {
      for (const sheet of assessment.sheets) {
        await deleteAssessmentSheetFile(sheet.imagePath).catch(() => undefined);
      }
    }

    await prisma.subjectAssessment.deleteMany({
      where: { organizationId, sectionId, examTermId },
    });
    revalidateResults(sectionId, examTermId, exam.seriesId ?? undefined);
    const returnTo = String(formData.get("returnTo") ?? "").trim();
    if (returnTo.startsWith("/org-admin/results/")) {
      redirect(returnTo);
    }
    redirect(`/org-admin/results/sections/${sectionId}`);
  } catch (error) {
    // redirect() throws a special Next.js error — rethrow it
    if (
      error &&
      typeof error === "object" &&
      "digest" in error &&
      String((error as { digest?: string }).digest ?? "").startsWith("NEXT_REDIRECT")
    ) {
      throw error;
    }
    return {
      ok: false as const,
      error: actionError(error, "Failed to delete section result"),
    };
  }
}

/** Deletes one subject's marks for this section exam. */
export async function deleteSubjectAssessment(formData: FormData) {
  const organizationId = await getOrganizationId();
  const assessmentId = z.string().min(1).parse(formData.get("assessmentId"));
  const assessment = await prisma.subjectAssessment.findFirst({
    where: { id: assessmentId, organizationId },
    select: { id: true, sectionId: true, examTermId: true },
  });
  if (!assessment) throw new Error("Subject result not found");
  await prisma.subjectAssessment.delete({ where: { id: assessment.id } });
  revalidateResults(assessment.sectionId, assessment.examTermId);
}

/** Deletes the exam for the whole organization (all sections). */
export async function deleteExamTerm(formData: FormData) {
  const organizationId = await getOrganizationId();
  const examTermId = z.string().min(1).parse(formData.get("examTermId"));
  const sectionId = String(formData.get("sectionId") ?? "").trim() || undefined;
  const exam = await prisma.examTerm.findFirst({
    where: { id: examTermId, organizationId },
    select: { id: true, seriesId: true },
  });
  if (!exam) throw new Error("Exam not found");
  await prisma.examTerm.delete({ where: { id: exam.id } });
  revalidateResults(sectionId, examTermId, exam.seriesId ?? undefined);
  revalidatePath("/org-admin/results");
  if (sectionId) {
    redirect(`/org-admin/results/sections/${sectionId}`);
  }
}

export async function createResultSeries(formData: FormData) {
  try {
    const organizationId = await getOrganizationId();
    const sectionId = z.string().min(1).parse(formData.get("sectionId"));
    const parsed = z
      .object({
        name: z.string().trim().min(2, "Series name is required").max(80),
        session: z.string().trim().min(4).max(20).default(academicSession()),
        passPercent: z.coerce.number().int().min(1).max(100).default(33),
      })
      .parse({
        name: formData.get("name"),
        session: formData.get("session") || academicSession(),
        passPercent: formData.get("passPercent") || 33,
      });

    const section = await prisma.section.findFirst({
      where: { id: sectionId, organizationId },
      select: { id: true },
    });
    if (!section) throw new Error("Section not found");

    const series = await prisma.resultSeries.upsert({
      where: {
        organizationId_name_session: {
          organizationId,
          name: parsed.name,
          session: parsed.session,
        },
      },
      update: { passPercent: parsed.passPercent },
      create: {
        organizationId,
        name: parsed.name,
        session: parsed.session,
        passPercent: parsed.passPercent,
      },
    });
    revalidateResults(sectionId, undefined, series.id);
    return { ok: true as const, id: series.id };
  } catch (error) {
    return { ok: false as const, error: actionError(error, "Failed to save series") };
  }
}

export async function addSeriesRound(formData: FormData) {
  try {
    const organizationId = await getOrganizationId();
    const sectionId = z.string().min(1).parse(formData.get("sectionId"));
    const seriesId = z.string().min(1).parse(formData.get("seriesId"));
    const examDateRaw = String(formData.get("examDate") ?? "").trim();

    const series = await prisma.resultSeries.findFirst({
      where: { id: seriesId, organizationId },
      select: {
        id: true,
        name: true,
        session: true,
        passPercent: true,
        rounds: { select: { roundOrder: true }, orderBy: { roundOrder: "desc" }, take: 1 },
      },
    });
    if (!series) throw new Error("Series not found");

    const section = await prisma.section.findFirst({
      where: { id: sectionId, organizationId },
      select: { id: true },
    });
    if (!section) throw new Error("Section not found");

    const nextOrder = (series.rounds[0]?.roundOrder ?? 0) + 1;
    const roundName = `${series.name} · Round ${nextOrder}`;

    const exam = await prisma.examTerm.create({
      data: {
        organizationId,
        seriesId: series.id,
        name: roundName,
        session: series.session,
        passPercent: series.passPercent,
        roundOrder: nextOrder,
        examDate: examDateRaw ? new Date(`${examDateRaw}T00:00:00`) : null,
      },
    });
    revalidateResults(sectionId, exam.id, series.id);
    return { ok: true as const, id: exam.id };
  } catch (error) {
    return { ok: false as const, error: actionError(error, "Failed to add round") };
  }
}

export async function deleteResultSeries(formData: FormData) {
  const organizationId = await getOrganizationId();
  const seriesId = z.string().min(1).parse(formData.get("seriesId"));
  const sectionId = String(formData.get("sectionId") ?? "").trim() || undefined;
  const series = await prisma.resultSeries.findFirst({
    where: { id: seriesId, organizationId },
    select: { id: true, name: true },
  });
  if (!series) throw new Error("Series not found");
  await prisma.resultSeries.delete({ where: { id: series.id } });
  revalidateResults(sectionId, undefined, seriesId);
  if (sectionId) {
    redirect(`/org-admin/results/sections/${sectionId}`);
  }
}
