import "dotenv/config";
import { randomUUID } from "node:crypto";
import { Prisma } from "../src/generated/prisma/client";
import { ONE_TIME_PERIOD_KEY } from "../src/lib/fee-head-rules";
import { ensureDefaultFeeHeads } from "../src/lib/ensure-fee-heads";
import { prisma } from "../src/lib/prisma";

const MONTHLY = "Monthly Fee";
const ADMISSION = "Admission Fee";
const ENROLL_AT = new Date("2026-03-05T10:00:00.000Z");
const ADMISSION_AMOUNT = new Prisma.Decimal(5000);

function periodKeysFromMarchToNow(now = new Date()) {
  const keys: string[] = [];
  let y = 2026;
  let m = 3;
  const endY = now.getUTCFullYear();
  const endM = now.getUTCMonth() + 1;
  while (y < endY || (y === endY && m <= endM)) {
    keys.push(`${y}-${String(m).padStart(2, "0")}`);
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }
  return keys;
}

function hashInt(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i += 1) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return h;
}

/** Leave ~1–2 months unpaid per student (deterministic). */
function pendingPeriodsForStudent(studentId: string, periods: string[]) {
  if (periods.length < 2) return new Set<string>();
  const h = hashInt(studentId);
  const pending = new Set<string>();
  // Skip first month (March) and current month — pending in the middle.
  const middle = periods.slice(1, -1);
  if (!middle.length) return pending;
  pending.add(middle[h % middle.length]!);
  if (middle.length > 2 && h % 3 === 0) {
    pending.add(middle[(h + 2) % middle.length]!);
  }
  return pending;
}

async function wipeFeeHeadCharges(
  organizationId: string,
  feeHeadId: string,
  studentIds: string[],
) {
  if (!studentIds.length) return;
  const charges = await prisma.feeCharge.findMany({
    where: { organizationId, feeHeadId, studentId: { in: studentIds } },
    select: { id: true },
  });
  const chargeIds = charges.map((c) => c.id);
  if (chargeIds.length) {
    await prisma.feePaymentAllocation.deleteMany({
      where: { chargeId: { in: chargeIds } },
    });
    await prisma.feeCharge.deleteMany({ where: { id: { in: chargeIds } } });
  }
  // Orphan payments that only covered these heads (allocations already gone)
  const emptyPayments = await prisma.feePayment.findMany({
    where: {
      organizationId,
      studentId: { in: studentIds },
      allocations: { none: {} },
    },
    select: { id: true },
  });
  if (emptyPayments.length) {
    await prisma.feePayment.deleteMany({
      where: { id: { in: emptyPayments.map((p) => p.id) } },
    });
  }
}

async function main() {
  const org = await prisma.organization.findFirst({
    where: {
      OR: [
        { slug: { contains: "zain", mode: "insensitive" } },
        { name: { contains: "zain", mode: "insensitive" } },
      ],
    },
    select: { id: true, name: true },
  });
  if (!org) throw new Error("AL Zain not found");

  await ensureDefaultFeeHeads(org.id);

  const monthlyHead = await prisma.feeHead.findUniqueOrThrow({
    where: { organizationId_name: { organizationId: org.id, name: MONTHLY } },
    select: { id: true },
  });
  const admissionHead = await prisma.feeHead.findUniqueOrThrow({
    where: { organizationId_name: { organizationId: org.id, name: ADMISSION } },
    select: { id: true },
  });
  await prisma.feeHead.update({
    where: { id: admissionHead.id },
    data: { defaultAmount: ADMISSION_AMOUNT, isActive: true },
  });

  const students = await prisma.student.findMany({
    where: { organizationId: org.id, isActive: true },
    select: {
      id: true,
      name: true,
      rollNumber: true,
      monthlyFee: true,
      section: { select: { name: true, class: { select: { name: true } } } },
    },
    orderBy: [{ section: { name: "asc" } }, { rollNumber: "asc" }],
  });
  if (!students.length) throw new Error("No active students");

  const ids = students.map((s) => s.id);
  await wipeFeeHeadCharges(org.id, monthlyHead.id, ids);
  await wipeFeeHeadCharges(org.id, admissionHead.id, ids);

  // Backdate enrollment to March
  await prisma.student.updateMany({
    where: { id: { in: ids } },
    data: { createdAt: ENROLL_AT },
  });

  const periods = periodKeysFromMarchToNow();
  let paidMonthly = 0;
  let pendingMonthly = 0;
  let admissions = 0;

  for (const student of students) {
    const amount =
      student.monthlyFee ??
      new Prisma.Decimal(student.section.class.name.toLowerCase().includes("9") ? 4000 : 3500);
    if (!student.monthlyFee) {
      await prisma.student.update({
        where: { id: student.id },
        data: { monthlyFee: amount },
      });
    }

    // Admission paid
    const admCharge = await prisma.feeCharge.create({
      data: {
        organizationId: org.id,
        studentId: student.id,
        feeHeadId: admissionHead.id,
        periodKey: ONE_TIME_PERIOD_KEY,
        description: ADMISSION,
        amount: ADMISSION_AMOUNT,
        status: "PAID",
      },
      select: { id: true },
    });
    await prisma.feePayment.create({
      data: {
        organizationId: org.id,
        studentId: student.id,
        receiptNumber: `ADM-${student.rollNumber}-${randomUUID().slice(0, 4).toUpperCase()}`,
        amount: ADMISSION_AMOUNT,
        method: "CASH",
        paidAt: ENROLL_AT,
        note: "Admission fee (March enrollment)",
        allocations: { create: { chargeId: admCharge.id, amount: ADMISSION_AMOUNT } },
      },
    });
    admissions += 1;

    const pendingSet = pendingPeriodsForStudent(student.id, periods);
    for (const periodKey of periods) {
      const leavePending = pendingSet.has(periodKey);
      const paidAt = new Date(`${periodKey}-08T12:00:00.000Z`);
      const charge = await prisma.feeCharge.create({
        data: {
          organizationId: org.id,
          studentId: student.id,
          feeHeadId: monthlyHead.id,
          periodKey,
          description: MONTHLY,
          amount,
          status: leavePending ? "UNPAID" : "PAID",
        },
        select: { id: true },
      });
      if (leavePending) {
        pendingMonthly += 1;
        continue;
      }
      await prisma.feePayment.create({
        data: {
          organizationId: org.id,
          studentId: student.id,
          receiptNumber: `RCP-${periodKey.replace("-", "")}-${student.rollNumber}-${randomUUID().slice(0, 3).toUpperCase()}`,
          amount,
          method: "CASH",
          paidAt,
          note: `Monthly Fee ${periodKey}`,
          allocations: { create: { chargeId: charge.id, amount } },
        },
      });
      paidMonthly += 1;
    }
  }

  console.log(`${org.name}: ${students.length} students backdated to March 2026`);
  console.log(`Periods: ${periods.join(", ")}`);
  console.log(`Admission paid: ${admissions}`);
  console.log(`Monthly paid charges: ${paidMonthly}`);
  console.log(`Monthly pending charges: ${pendingMonthly}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
