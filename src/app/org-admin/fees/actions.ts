"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { FEE_CATEGORIES, type FeeCategoryValue } from "@/lib/fee-categories";
import {
  ONE_TIME_PERIOD_KEY,
  feeHeadDueInPeriod,
  periodMonth,
} from "@/lib/fee-head-rules";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";
import { assertOrgModule } from "@/lib/org-modules";

const idSchema = z.string().trim().min(1);
const moneySchema = z
  .string()
  .trim()
  .regex(/^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/, "Enter a valid amount with up to 2 decimals")
  .refine((value) => new Prisma.Decimal(value).greaterThan(0), "Amount must be positive");
const optionalMoneySchema = z.preprocess(
  (value) => (typeof value === "string" && value.trim() ? value.trim() : undefined),
  z
    .string()
    .regex(/^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/, "Enter a valid amount with up to 2 decimals")
    .optional(),
);
const periodSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Period must be YYYY-MM");
const feeCategorySchema = z.enum(
  FEE_CATEGORIES as unknown as [FeeCategoryValue, ...FeeCategoryValue[]],
);
const feeFrequencySchema = z.enum(["MONTHLY", "QUARTERLY", "ANNUAL", "ONE_TIME"]);
const monthsSchema = z.preprocess((value) => {
  const raw = Array.isArray(value) ? value : value == null ? [] : [value];
  return raw
    .map((item) => Number(String(item)))
    .filter((n) => Number.isInteger(n) && n >= 1 && n <= 12);
}, z.array(z.number().int().min(1).max(12)));
const optionalText = z.preprocess(
  (value) => (typeof value === "string" && value.trim() ? value.trim() : undefined),
  z.string().max(500).optional(),
);

async function requireOrgAdmin() {
  const session = await requireRole(["ORG_ADMIN"]);
  const organizationId = session.user.organizationId;
  if (!organizationId) throw new Error("Organization not linked to this admin");
  await assertOrgModule(organizationId, "FEES");
  return organizationId;
}

function messageUrl(
  path: string,
  kind: "success" | "error",
  message: string,
  extra?: Record<string, string | undefined>,
) {
  const params = new URLSearchParams();
  params.set(kind, message);
  if (extra) {
    for (const [key, value] of Object.entries(extra)) {
      if (value) params.set(key, value);
    }
  }
  return `${path}?${params.toString()}`;
}

function errorMessage(error: unknown) {
  if (error instanceof z.ZodError) {
    return error.issues[0]?.message ?? "Please check the fee details and try again.";
  }
  if (
    typeof error === "object" &&
    error &&
    "code" in error &&
    (error as { code?: string }).code === "P2002"
  ) {
    return "A record with these details already exists";
  }
    return error instanceof Error ? error.message : "The operation could not be completed.";
}

function revalidateFees() {
  revalidatePath("/org-admin/fees");
  revalidatePath("/org-admin/fees/types");
  revalidatePath("/org-admin/fees/structures");
  revalidatePath("/org-admin/fees/generate");
  revalidatePath("/org-admin/fees/dues");
  revalidatePath("/org-admin/fees/collect");
  revalidatePath("/org-admin/fees/receipts");
}

export async function createFeeHead(formData: FormData) {
  let outcome: { kind: "success" | "error"; message: string };
  try {
    const organizationId = await requireOrgAdmin();
    const input = z
      .object({
        name: z.string().trim().min(1, "Fee type name is required").max(100),
        category: feeCategorySchema,
        frequency: feeFrequencySchema,
        defaultAmount: optionalMoneySchema,
        applicableMonths: monthsSchema,
        description: optionalText,
      })
      .parse({
        name: formData.get("name"),
        category: formData.get("category"),
        frequency: formData.get("frequency") || "MONTHLY",
        defaultAmount: formData.get("defaultAmount"),
        applicableMonths: formData.getAll("months"),
        description: formData.get("description"),
      });
    await prisma.feeHead.create({
      data: {
        organizationId,
        name: input.name,
        category: input.category,
        frequency: input.frequency,
        defaultAmount: input.defaultAmount ? new Prisma.Decimal(input.defaultAmount) : null,
        applicableMonths:
          input.frequency === "ONE_TIME" ? [] : [...new Set(input.applicableMonths)].sort((a, b) => a - b),
        description: input.description,
      },
    });
    revalidateFees();
    outcome = { kind: "success", message: "Fee type created." };
  } catch (error) {
    outcome = { kind: "error", message: errorMessage(error) };
  }
  redirect(messageUrl("/org-admin/fees/types", outcome.kind, outcome.message));
}

export async function updateFeeHead(formData: FormData) {
  let outcome: { kind: "success" | "error"; message: string };
  try {
    const organizationId = await requireOrgAdmin();
    const input = z
      .object({
        id: idSchema,
        name: z.string().trim().min(1, "Fee type name is required").max(100),
        category: feeCategorySchema,
        frequency: feeFrequencySchema,
        defaultAmount: optionalMoneySchema,
        applicableMonths: monthsSchema,
        description: optionalText,
      })
      .parse({
        id: formData.get("id"),
        name: formData.get("name"),
        category: formData.get("category"),
        frequency: formData.get("frequency") || "MONTHLY",
        defaultAmount: formData.get("defaultAmount"),
        applicableMonths: formData.getAll("months"),
        description: formData.get("description"),
      });
    const updated = await prisma.feeHead.updateMany({
      where: { id: input.id, organizationId },
      data: {
        name: input.name,
        category: input.category,
        frequency: input.frequency,
        defaultAmount: input.defaultAmount ? new Prisma.Decimal(input.defaultAmount) : null,
        applicableMonths:
          input.frequency === "ONE_TIME" ? [] : [...new Set(input.applicableMonths)].sort((a, b) => a - b),
        description: input.description ?? null,
      },
    });
    if (!updated.count) throw new Error("Fee type not found");
    revalidateFees();
    outcome = { kind: "success", message: "Fee type updated." };
  } catch (error) {
    outcome = { kind: "error", message: errorMessage(error) };
  }
  redirect(messageUrl("/org-admin/fees/types", outcome.kind, outcome.message));
}

type FeeFrequencyValue = "MONTHLY" | "QUARTERLY" | "ANNUAL" | "ONE_TIME";

function frequencyAppliesToPeriod(frequency: FeeFrequencyValue, periodKey: string) {
  const month = periodMonth(periodKey);
  switch (frequency) {
    case "MONTHLY":
      return true;
    case "QUARTERLY":
      return [1, 4, 7, 10].includes(month);
    case "ANNUAL":
      return month === 1;
    case "ONE_TIME":
      return true;
  }
}

export async function createFeePlan(formData: FormData) {
  let outcome: { kind: "success" | "error"; message: string };
  try {
    const organizationId = await requireOrgAdmin();
    const input = z
      .object({
        name: z.string().trim().min(1, "Plan name is required").max(100),
        classId: idSchema,
        sectionId: z.preprocess(
          (value) => (value ? value : undefined),
          z.string().optional(),
        ),
        feeHeadId: idSchema,
        amount: moneySchema,
        frequency: z.enum(["MONTHLY", "QUARTERLY", "ANNUAL", "ONE_TIME"]),
      })
      .parse({
        name: formData.get("name"),
        classId: formData.get("classId"),
        sectionId: formData.get("sectionId"),
        feeHeadId: formData.get("feeHeadId"),
        amount: formData.get("amount"),
        frequency: formData.get("frequency"),
      });

    await prisma.$transaction(async (tx) => {
      const [klass, section, feeHead, orgClassCount] = await Promise.all([
        tx.class.findUnique({ where: { id: input.classId }, select: { id: true } }),
        input.sectionId
          ? tx.section.findFirst({
              where: {
                id: input.sectionId,
                organizationId,
                classId: input.classId,
              },
              select: { id: true },
            })
          : Promise.resolve(null),
        tx.feeHead.findFirst({
          where: { id: input.feeHeadId, organizationId, isActive: true },
          select: { id: true },
        }),
        tx.section.count({
          where: { organizationId, classId: input.classId },
        }),
      ]);
      if (!klass) throw new Error("Class not found");
      if (!orgClassCount) {
        throw new Error("This class has no sections in your organization");
      }
      if (input.sectionId && !section) {
        throw new Error("Section does not belong to this organization and class");
      }
      if (!feeHead) throw new Error("Active fee head not found");

      await tx.feePlan.create({
        data: {
          organizationId,
          name: input.name,
          classId: input.classId,
          sectionId: input.sectionId,
          items: {
            create: {
              feeHeadId: input.feeHeadId,
              amount: new Prisma.Decimal(input.amount),
              frequency: input.frequency,
            },
          },
        },
      });
    });
    revalidateFees();
    outcome = { kind: "success", message: "Fee plan created successfully." };
  } catch (error) {
    outcome = { kind: "error", message: errorMessage(error) };
  }
  redirect(messageUrl("/org-admin/fees/structures", outcome.kind, outcome.message));
}

export async function addFeePlanItem(formData: FormData) {
  let outcome: { kind: "success" | "error"; message: string };
  try {
    const organizationId = await requireOrgAdmin();
    const input = z
      .object({
        planId: idSchema,
        feeHeadId: idSchema,
        amount: moneySchema,
        frequency: z.enum(["MONTHLY", "QUARTERLY", "ANNUAL", "ONE_TIME"]),
      })
      .parse({
        planId: formData.get("planId"),
        feeHeadId: formData.get("feeHeadId"),
        amount: formData.get("amount"),
        frequency: formData.get("frequency"),
      });
    const [plan, head] = await Promise.all([
      prisma.feePlan.findFirst({
        where: { id: input.planId, organizationId },
        select: { id: true },
      }),
      prisma.feeHead.findFirst({
        where: { id: input.feeHeadId, organizationId, isActive: true },
        select: { id: true },
      }),
    ]);
    if (!plan) throw new Error("Fee plan not found");
    if (!head) throw new Error("Active fee head not found");
    await prisma.feePlanItem.create({
      data: {
        planId: plan.id,
        feeHeadId: head.id,
        amount: new Prisma.Decimal(input.amount),
        frequency: input.frequency,
      },
    });
    revalidateFees();
    outcome = { kind: "success", message: "Plan item added successfully." };
  } catch (error) {
    outcome = { kind: "error", message: errorMessage(error) };
  }
  redirect(messageUrl("/org-admin/fees/structures", outcome.kind, outcome.message));
}

export async function updateFeePlanItem(formData: FormData) {
  let outcome: { kind: "success" | "error"; message: string };
  try {
    const organizationId = await requireOrgAdmin();
    const input = z
      .object({
        itemId: idSchema,
        amount: moneySchema,
        frequency: z.enum(["MONTHLY", "QUARTERLY", "ANNUAL", "ONE_TIME"]),
      })
      .parse({
        itemId: formData.get("itemId"),
        amount: formData.get("amount"),
        frequency: formData.get("frequency"),
      });
    const item = await prisma.feePlanItem.findFirst({
      where: { id: input.itemId, plan: { organizationId } },
      select: { id: true },
    });
    if (!item) throw new Error("Plan item not found");
    await prisma.feePlanItem.update({
      where: { id: item.id },
      data: {
        amount: new Prisma.Decimal(input.amount),
        frequency: input.frequency,
      },
    });
    revalidateFees();
    outcome = { kind: "success", message: "Plan item updated successfully." };
  } catch (error) {
    outcome = { kind: "error", message: errorMessage(error) };
  }
  redirect(messageUrl("/org-admin/fees/structures", outcome.kind, outcome.message));
}

export async function deleteFeePlanItem(formData: FormData) {
  let outcome: { kind: "success" | "error"; message: string };
  try {
    const organizationId = await requireOrgAdmin();
    const itemId = idSchema.parse(formData.get("itemId"));
    const item = await prisma.feePlanItem.findFirst({
      where: { id: itemId, plan: { organizationId } },
      select: {
        id: true,
        planId: true,
        _count: { select: { charges: true } },
        plan: { select: { _count: { select: { items: true } } } },
      },
    });
    if (!item) throw new Error("Plan item not found");
    if (item._count.charges > 0) {
      throw new Error("This item already has generated charges and cannot be deleted");
    }
    if (item.plan._count.items <= 1) {
      throw new Error("A plan must keep at least one fee item");
    }
    await prisma.feePlanItem.delete({ where: { id: item.id } });
    revalidateFees();
    outcome = { kind: "success", message: "Plan item deleted successfully." };
  } catch (error) {
    outcome = { kind: "error", message: errorMessage(error) };
  }
  redirect(messageUrl("/org-admin/fees/structures", outcome.kind, outcome.message));
}

export async function toggleFeeHead(formData: FormData) {
  let outcome: { kind: "success" | "error"; message: string };
  try {
    const organizationId = await requireOrgAdmin();
    const input = z
      .object({ id: idSchema, active: z.enum(["true", "false"]) })
      .parse({ id: formData.get("id"), active: formData.get("active") });
    await prisma.feeHead.updateMany({
      where: { id: input.id, organizationId },
      data: { isActive: input.active === "true" },
    });
    revalidateFees();
    outcome = {
      kind: "success",
      message: input.active === "true" ? "Fee type activated." : "Fee type deactivated.",
    };
  } catch (error) {
    outcome = { kind: "error", message: errorMessage(error) };
  }
  redirect(messageUrl("/org-admin/fees/types", outcome.kind, outcome.message));
}

export async function toggleFeePlan(formData: FormData) {
  const organizationId = await requireOrgAdmin();
  const input = z
    .object({ id: idSchema, active: z.enum(["true", "false"]) })
    .parse({ id: formData.get("id"), active: formData.get("active") });
  await prisma.feePlan.updateMany({
    where: { id: input.id, organizationId },
    data: { isActive: input.active === "true" },
  });
  revalidateFees();
}

export async function deleteFeeHead(formData: FormData) {
  let outcome: { kind: "success" | "error"; message: string };
  try {
    const organizationId = await requireOrgAdmin();
    const id = idSchema.parse(formData.get("id"));
    const head = await prisma.feeHead.findFirst({
      where: { id, organizationId },
      select: { id: true, _count: { select: { planItems: true, charges: true } } },
    });
    if (!head) throw new Error("Fee head not found");
    if (head._count.planItems || head._count.charges) {
      throw new Error("This fee head is in use; deactivate it instead");
    }
    await prisma.feeHead.deleteMany({ where: { id, organizationId } });
    revalidateFees();
    outcome = { kind: "success", message: "Fee head deleted successfully." };
  } catch (error) {
    outcome = { kind: "error", message: errorMessage(error) };
  }
  redirect(messageUrl("/org-admin/fees/types", outcome.kind, outcome.message));
}

export async function deleteFeePlan(formData: FormData) {
  let outcome: { kind: "success" | "error"; message: string };
  try {
    const organizationId = await requireOrgAdmin();
    const id = idSchema.parse(formData.get("id"));
    const plan = await prisma.feePlan.findFirst({
      where: { id, organizationId },
      select: { id: true },
    });
    if (!plan) throw new Error("Fee plan not found");
    const chargeCount = await prisma.feeCharge.count({
      where: { organizationId, planItem: { planId: id } },
    });
    if (chargeCount) {
      await prisma.feePlan.updateMany({
        where: { id, organizationId },
        data: { isActive: false },
      });
      outcome = {
        kind: "success",
        message: "This plan already has generated charges, so it was deactivated instead of deleted.",
      };
    } else {
      await prisma.feePlan.deleteMany({ where: { id, organizationId } });
      outcome = { kind: "success", message: "Fee plan deleted successfully." };
    }
    revalidateFees();
  } catch (error) {
    outcome = { kind: "error", message: errorMessage(error) };
  }
  redirect(messageUrl("/org-admin/fees/structures", outcome.kind, outcome.message));
}

export async function generateFeeCharges(formData: FormData) {
  let outcome: { kind: "success" | "error"; message: string };
  const returnClassId =
    typeof formData.get("returnClassId") === "string"
      ? String(formData.get("returnClassId")).trim() || undefined
      : undefined;
  const returnSectionId =
    typeof formData.get("returnSectionId") === "string"
      ? String(formData.get("returnSectionId")).trim() || undefined
      : undefined;
  try {
    const organizationId = await requireOrgAdmin();
    const input = z
      .object({
        planId: idSchema,
        periodKey: periodSchema,
        scopeSectionId: z.preprocess(
          (value) => (value ? value : undefined),
          z.string().optional(),
        ),
        dueDate: z.preprocess(
          (value) => (value ? value : undefined),
          z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
        ),
      })
      .parse({
        planId: formData.get("planId"),
        periodKey: formData.get("periodKey"),
        scopeSectionId: formData.get("scopeSectionId"),
        dueDate: formData.get("dueDate"),
      });
    const plan = await prisma.feePlan.findFirst({
      where: { id: input.planId, organizationId, isActive: true },
      select: {
        id: true,
        name: true,
        classId: true,
        sectionId: true,
        items: {
          where: { feeHead: { organizationId, isActive: true } },
          select: { id: true, feeHeadId: true, amount: true, frequency: true },
        },
      },
    });
    if (!plan) throw new Error("Active fee plan not found");
    if (!plan.items.length) throw new Error("This plan has no active fee items");

    const targetSectionId = input.scopeSectionId ?? plan.sectionId ?? undefined;
    if (input.scopeSectionId) {
      const section = await prisma.section.findFirst({
        where: {
          id: input.scopeSectionId,
          organizationId,
          classId: plan.classId,
        },
        select: { id: true },
      });
      if (!section) throw new Error("Section does not match this fee plan class");
      if (plan.sectionId && plan.sectionId !== input.scopeSectionId) {
        throw new Error("This plan is locked to a different section");
      }
    }

    const periodItems = plan.items.filter((item) =>
      frequencyAppliesToPeriod(item.frequency, input.periodKey),
    );
    if (!periodItems.length) {
      throw new Error(
        "No plan items apply to this period (quarterly = Jan/Apr/Jul/Oct, annual = January).",
      );
    }

    const students = await prisma.student.findMany({
      where: {
        organizationId,
        isActive: true,
        sectionId: targetSectionId,
        section: { organizationId, classId: plan.classId },
      },
      select: { id: true },
    });
    if (!students.length) throw new Error("No active students match this fee plan");

    const studentIds = students.map((student) => student.id);
    const feeHeadIds = periodItems.map((item) => item.feeHeadId);
    const yearPrefix = input.periodKey.slice(0, 4);
    const existing = await prisma.feeCharge.findMany({
      where: {
        organizationId,
        studentId: { in: studentIds },
        feeHeadId: { in: feeHeadIds },
      },
      select: { studentId: true, feeHeadId: true, periodKey: true },
    });
    const existingExact = new Set(
      existing.map((row) => `${row.studentId}:${row.feeHeadId}:${row.periodKey}`),
    );
    const existingAny = new Set(existing.map((row) => `${row.studentId}:${row.feeHeadId}`));
    const existingYear = new Set(
      existing
        .filter((row) => row.periodKey.startsWith(yearPrefix))
        .map((row) => `${row.studentId}:${row.feeHeadId}`),
    );

    let frequencySkipped = 0;
    const data = students.flatMap((student) =>
      periodItems.flatMap((item) => {
        const key = `${student.id}:${item.feeHeadId}`;
        if (item.frequency === "ONE_TIME" && existingAny.has(key)) {
          frequencySkipped += 1;
          return [];
        }
        if (item.frequency === "ANNUAL" && existingYear.has(key)) {
          frequencySkipped += 1;
          return [];
        }
        if (existingExact.has(`${key}:${input.periodKey}`)) {
          return [];
        }
        return [
          {
            organizationId,
            studentId: student.id,
            feeHeadId: item.feeHeadId,
            planItemId: item.id,
            periodKey: input.periodKey,
            description: plan.name,
            amount: item.amount,
            dueDate: input.dueDate
              ? new Date(`${input.dueDate}T00:00:00.000Z`)
              : null,
          },
        ];
      }),
    );
    const result = data.length
      ? await prisma.feeCharge.createMany({ data, skipDuplicates: true })
      : { count: 0 };
    const duplicateSkipped = data.length - result.count;
    const periodSkipped = plan.items.length - periodItems.length;
    revalidateFees();
    outcome = {
      kind: "success",
      message: `Created ${result.count} dues for ${students.length} student(s). Skipped ${duplicateSkipped} duplicates, ${frequencySkipped} one-time/annual already billed, and ${periodSkipped} item(s) not due this month.`,
    };
  } catch (error) {
    outcome = { kind: "error", message: errorMessage(error) };
  }
  redirect(
    messageUrl("/org-admin/fees", outcome.kind, outcome.message, {
      classId: returnClassId,
      sectionId: returnSectionId,
    }),
  );
}

export async function submitStudentFee(formData: FormData) {
  let paymentId: string | undefined;
  let outcome: { kind: "success" | "error"; message: string };
  const returnClassId =
    typeof formData.get("returnClassId") === "string"
      ? String(formData.get("returnClassId")).trim() || undefined
      : undefined;
  const returnSectionId =
    typeof formData.get("returnSectionId") === "string"
      ? String(formData.get("returnSectionId")).trim() || undefined
      : undefined;
  const returnStudentId =
    typeof formData.get("studentId") === "string"
      ? String(formData.get("studentId")).trim() || undefined
      : undefined;
  const returnFeeName =
    typeof formData.get("returnFeeName") === "string"
      ? String(formData.get("returnFeeName")).trim() || undefined
      : undefined;
  try {
    const organizationId = await requireOrgAdmin();
    const input = z
      .object({
        studentId: idSchema,
        feeLabel: z.preprocess(
          (value) =>
            typeof value === "string" && value.trim() ? value.trim() : "Monthly Fee",
          z.string().min(1).max(100),
        ),
        periodKey: periodSchema,
        amount: moneySchema,
        paidAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Payment date is required"),
        method: z.enum(["CASH", "BANK_TRANSFER", "CARD", "OTHER"]),
        note: optionalText,
      })
      .parse({
        studentId: formData.get("studentId"),
        feeLabel: formData.get("feeLabel"),
        periodKey: formData.get("periodKey"),
        amount: formData.get("amount"),
        paidAt: formData.get("paidAt"),
        method: formData.get("method"),
        note: formData.get("note"),
      });

    const receiptNumber = `RCP-${Date.now().toString(36).toUpperCase()}-${randomUUID().slice(0, 6).toUpperCase()}`;
    const payAmount = new Prisma.Decimal(input.amount);

    paymentId = await prisma.$transaction(
      async (tx) => {
        const student = await tx.student.findFirst({
          where: { id: input.studentId, organizationId, isActive: true },
          select: { id: true, name: true },
        });
        if (!student) throw new Error("Active student not found");

        // Resolve fee type rules from FeeHead (amount / frequency / months).
        const feeHead = await tx.feeHead.upsert({
          where: {
            organizationId_name: {
              organizationId,
              name: input.feeLabel,
            },
          },
          update: { isActive: true },
          create: {
            organizationId,
            name: input.feeLabel,
            category: "TUITION",
            description: "Auto-created from fee submission",
            frequency: "MONTHLY",
          },
          select: {
            id: true,
            name: true,
            frequency: true,
            applicableMonths: true,
          },
        });

        if (
          !feeHeadDueInPeriod(
            {
              frequency: feeHead.frequency,
              applicableMonths: feeHead.applicableMonths,
            },
            input.periodKey,
          )
        ) {
          throw new Error(`${feeHead.name} is not due in ${input.periodKey}`);
        }

        const chargePeriodKey =
          feeHead.frequency === "ONE_TIME" ? ONE_TIME_PERIOD_KEY : input.periodKey;

        if (feeHead.frequency === "ONE_TIME") {
          const alreadyOnce = await tx.feeCharge.findFirst({
            where: {
              organizationId,
              studentId: student.id,
              feeHeadId: feeHead.id,
              status: "PAID",
            },
            select: { id: true },
          });
          if (alreadyOnce) {
            throw new Error(`${feeHead.name} is one-time and already paid`);
          }
        }

        let charge = await tx.feeCharge.findFirst({
          where: {
            organizationId,
            studentId: student.id,
            feeHeadId: feeHead.id,
            periodKey: chargePeriodKey,
          },
          select: {
            id: true,
            amount: true,
            status: true,
            allocations: { select: { amount: true } },
          },
        });

        if (!charge) {
          charge = await tx.feeCharge.create({
            data: {
              organizationId,
              studentId: student.id,
              feeHeadId: feeHead.id,
              periodKey: chargePeriodKey,
              description: feeHead.name,
              amount: payAmount,
              status: "UNPAID",
            },
            select: {
              id: true,
              amount: true,
              status: true,
              allocations: { select: { amount: true } },
            },
          });
        }

        if (charge.status === "WAIVED") {
          throw new Error("This fee was waived");
        }
        if (charge.status === "PAID") {
          throw new Error(
            feeHead.frequency === "ONE_TIME"
              ? `${feeHead.name} is one-time and already paid`
              : "Already fully paid for this fee this month — pick next month",
          );
        }

        const alreadyPaid = charge.allocations.reduce(
          (sum, row) => sum.plus(row.amount),
          new Prisma.Decimal(0),
        );
        let outstanding = charge.amount.minus(alreadyPaid);

        if (payAmount.greaterThan(outstanding)) {
          const newTotal = alreadyPaid.plus(payAmount);
          await tx.feeCharge.update({
            where: { id: charge.id },
            data: { amount: newTotal },
          });
          outstanding = payAmount;
        }

        if (outstanding.lessThanOrEqualTo(0)) {
          throw new Error("Nothing left to collect for this fee this month");
        }
        if (payAmount.greaterThan(outstanding)) {
          throw new Error(`Payment exceeds outstanding PKR ${outstanding.toFixed(2)}`);
        }

        const payment = await tx.feePayment.create({
          data: {
            organizationId,
            studentId: student.id,
            receiptNumber,
            amount: payAmount,
            method: input.method,
            paidAt: new Date(`${input.paidAt}T12:00:00.000Z`),
            note: input.note,
            allocations: { create: { chargeId: charge.id, amount: payAmount } },
          },
          select: { id: true },
        });

        const fullyPaid = payAmount.equals(outstanding);
        await tx.feeCharge.update({
          where: { id: charge.id },
          data: { status: fullyPaid ? "PAID" : "PARTIAL" },
        });

        return payment.id;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    revalidateFees();
    outcome = {
      kind: "success",
      message: `Fee submitted. Receipt ${receiptNumber}.`,
    };
  } catch (error) {
    outcome = { kind: "error", message: errorMessage(error) };
  }

  if (outcome.kind === "success" && paymentId) {
    redirect(
      messageUrl(`/org-admin/fees/receipts/${paymentId}`, outcome.kind, outcome.message),
    );
  }

  const returnToRaw =
    typeof formData.get("returnTo") === "string"
      ? String(formData.get("returnTo")).trim()
      : "";
  const returnTo =
    returnToRaw.startsWith("/org-admin/fees") && !returnToRaw.startsWith("//")
      ? returnToRaw.split("?")[0]
      : "/org-admin/fees";

  redirect(
    messageUrl(returnTo, outcome.kind, outcome.message, {
      classId: returnClassId,
      sectionId: returnSectionId,
      studentId: returnStudentId,
      feeName: returnFeeName,
    }),
  );
}

export async function waiveFeeCharge(formData: FormData) {
  let outcome: { kind: "success" | "error"; message: string };
  const returnClassId =
    typeof formData.get("returnClassId") === "string"
      ? String(formData.get("returnClassId")).trim() || undefined
      : undefined;
  const returnSectionId =
    typeof formData.get("returnSectionId") === "string"
      ? String(formData.get("returnSectionId")).trim() || undefined
      : undefined;
  const returnStudentId =
    typeof formData.get("returnStudentId") === "string"
      ? String(formData.get("returnStudentId")).trim() || undefined
      : undefined;
  try {
    const organizationId = await requireOrgAdmin();
    const chargeId = idSchema.parse(formData.get("chargeId"));
    await prisma.$transaction(async (tx) => {
      const charge = await tx.feeCharge.findFirst({
        where: { id: chargeId, organizationId },
        select: { id: true, status: true, _count: { select: { allocations: true } } },
      });
      if (!charge) throw new Error("Charge not found");
      if (charge._count.allocations) {
        throw new Error("A charge with payment allocations cannot be waived");
      }
      if (charge.status === "PAID") throw new Error("A paid charge cannot be waived");
      await tx.feeCharge.updateMany({
        where: { id: chargeId, organizationId },
        data: { status: "WAIVED" },
      });
    });
    revalidateFees();
    outcome = { kind: "success", message: "Charge waived successfully." };
  } catch (error) {
    outcome = { kind: "error", message: errorMessage(error) };
  }
  redirect(
    messageUrl("/org-admin/fees", outcome.kind, outcome.message, {
      classId: returnClassId,
      sectionId: returnSectionId,
      studentId: returnStudentId,
    }),
  );
}

export async function collectFeePayment(formData: FormData) {
  let paymentId: string | undefined;
  let outcome: { kind: "success" | "error"; message: string };
  const returnStudentId =
    typeof formData.get("studentId") === "string"
      ? String(formData.get("studentId")).trim() || undefined
      : undefined;
  const returnClassId =
    typeof formData.get("returnClassId") === "string"
      ? String(formData.get("returnClassId")).trim() || undefined
      : undefined;
  const returnSectionId =
    typeof formData.get("returnSectionId") === "string"
      ? String(formData.get("returnSectionId")).trim() || undefined
      : undefined;
  const returnQ =
    typeof formData.get("q") === "string"
      ? String(formData.get("q")).trim() || undefined
      : undefined;
  try {
    const organizationId = await requireOrgAdmin();
    const input = z
      .object({
        chargeId: idSchema,
        studentId: idSchema,
        amount: moneySchema,
        paidAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Payment date is required"),
        method: z.enum(["CASH", "BANK_TRANSFER", "CARD", "OTHER"]),
        note: optionalText,
      })
      .parse({
        chargeId: formData.get("chargeId"),
        studentId: formData.get("studentId"),
        amount: formData.get("amount"),
        paidAt: formData.get("paidAt"),
        method: formData.get("method"),
        note: formData.get("note"),
      });
    const receiptNumber = `RCP-${Date.now().toString(36).toUpperCase()}-${randomUUID().slice(0, 6).toUpperCase()}`;

    paymentId = await prisma.$transaction(
      async (tx) => {
        const charge = await tx.feeCharge.findFirst({
          where: {
            id: input.chargeId,
            organizationId,
            studentId: input.studentId,
            status: { in: ["UNPAID", "PARTIAL"] },
            student: { organizationId, isActive: true },
          },
          select: {
            id: true,
            amount: true,
            allocations: { select: { amount: true } },
          },
        });
        if (!charge) throw new Error("Open charge not found for this student");
        const paid = charge.allocations.reduce(
          (sum, allocation) => sum.plus(allocation.amount),
          new Prisma.Decimal(0),
        );
        const outstanding = charge.amount.minus(paid);
        const amount = new Prisma.Decimal(input.amount);
        if (amount.greaterThan(outstanding)) {
          throw new Error(`Payment exceeds outstanding balance of PKR ${outstanding.toFixed(2)}`);
        }

        const payment = await tx.feePayment.create({
          data: {
            organizationId,
            studentId: input.studentId,
            receiptNumber,
            amount,
            method: input.method,
            paidAt: new Date(`${input.paidAt}T12:00:00.000Z`),
            note: input.note,
            allocations: { create: { chargeId: charge.id, amount } },
          },
          select: { id: true },
        });
        await tx.feeCharge.updateMany({
          where: { id: charge.id, organizationId, studentId: input.studentId },
          data: { status: amount.equals(outstanding) ? "PAID" : "PARTIAL" },
        });
        return payment.id;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
    revalidateFees();
    outcome = {
      kind: "success",
      message: `Payment collected successfully. Receipt ${receiptNumber}.`,
    };
  } catch (error) {
    outcome = { kind: "error", message: errorMessage(error) };
  }
  if (outcome.kind === "success" && paymentId) {
    redirect(
      messageUrl(`/org-admin/fees/receipts/${paymentId}`, outcome.kind, outcome.message),
    );
  }
  redirect(
    messageUrl("/org-admin/fees", outcome.kind, outcome.message, {
      classId: returnClassId,
      sectionId: returnSectionId,
      studentId: returnStudentId,
      q: returnQ,
    }),
  );
}
