"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";
import { assertOrgModule } from "@/lib/org-modules";

const idSchema = z.string().trim().min(1);
const moneySchema = z
  .string()
  .trim()
  .regex(/^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/, "Enter a valid amount with up to 2 decimals")
  .refine((value) => new Prisma.Decimal(value).greaterThan(0), "Amount must be positive");
const periodSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Period must be YYYY-MM");
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

function messageUrl(path: string, kind: "success" | "error", message: string) {
  return `${path}?${kind}=${encodeURIComponent(message)}`;
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
  revalidatePath("/org-admin/fees/structures");
  revalidatePath("/org-admin/fees/generate");
  revalidatePath("/org-admin/fees/dues");
  revalidatePath("/org-admin/fees/collect");
}

export async function createFeeHead(formData: FormData) {
  let outcome: { kind: "success" | "error"; message: string };
  try {
    const organizationId = await requireOrgAdmin();
    const input = z
      .object({
        name: z.string().trim().min(1, "Fee head name is required").max(100),
        description: optionalText,
      })
      .parse({
        name: formData.get("name"),
        description: formData.get("description"),
      });
    await prisma.feeHead.create({ data: { ...input, organizationId } });
    revalidateFees();
    outcome = { kind: "success", message: "Fee head created successfully." };
  } catch (error) {
    outcome = { kind: "error", message: errorMessage(error) };
  }
  redirect(messageUrl("/org-admin/fees/structures", outcome.kind, outcome.message));
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
      const [klass, section, feeHead] = await Promise.all([
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
      ]);
      if (!klass) throw new Error("Class not found");
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

export async function toggleFeeHead(formData: FormData) {
  const organizationId = await requireOrgAdmin();
  const input = z
    .object({ id: idSchema, active: z.enum(["true", "false"]) })
    .parse({ id: formData.get("id"), active: formData.get("active") });
  await prisma.feeHead.updateMany({
    where: { id: input.id, organizationId },
    data: { isActive: input.active === "true" },
  });
  revalidateFees();
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
  redirect(messageUrl("/org-admin/fees/structures", outcome.kind, outcome.message));
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
  try {
    const organizationId = await requireOrgAdmin();
    const input = z
      .object({
        planId: idSchema,
        periodKey: periodSchema,
        dueDate: z.preprocess(
          (value) => (value ? value : undefined),
          z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
        ),
      })
      .parse({
        planId: formData.get("planId"),
        periodKey: formData.get("periodKey"),
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
          select: { id: true, feeHeadId: true, amount: true },
        },
      },
    });
    if (!plan) throw new Error("Active fee plan not found");
    if (!plan.items.length) throw new Error("This plan has no active fee items");

    const students = await prisma.student.findMany({
      where: {
        organizationId,
        isActive: true,
        sectionId: plan.sectionId ?? undefined,
        section: { organizationId, classId: plan.classId },
      },
      select: { id: true },
    });
    const data = students.flatMap((student) =>
      plan.items.map((item) => ({
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
      })),
    );
    const result = data.length
      ? await prisma.$transaction(async (tx) =>
          tx.feeCharge.createMany({ data, skipDuplicates: true }),
        )
      : { count: 0 };
    const skipped = data.length - result.count;
    revalidateFees();
    outcome = {
      kind: "success",
      message: `Created ${result.count} dues. ${skipped} existing charges were skipped.`,
    };
  } catch (error) {
    outcome = { kind: "error", message: errorMessage(error) };
  }
  redirect(messageUrl("/org-admin/fees/generate", outcome.kind, outcome.message));
}

export async function waiveFeeCharge(formData: FormData) {
  let outcome: { kind: "success" | "error"; message: string };
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
  redirect(messageUrl("/org-admin/fees/dues", outcome.kind, outcome.message));
}

export async function collectFeePayment(formData: FormData) {
  let outcome: { kind: "success" | "error"; message: string };
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

    await prisma.$transaction(
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

        await tx.feePayment.create({
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
        });
        await tx.feeCharge.updateMany({
          where: { id: charge.id, organizationId, studentId: input.studentId },
          data: { status: amount.equals(outstanding) ? "PAID" : "PARTIAL" },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
    revalidateFees();
    outcome = { kind: "success", message: `Payment collected successfully. Receipt ${receiptNumber}.` };
  } catch (error) {
    outcome = { kind: "error", message: errorMessage(error) };
  }
  redirect(messageUrl("/org-admin/fees/collect", outcome.kind, outcome.message));
}
