import "dotenv/config";
import { randomUUID } from "node:crypto";
import { Prisma } from "../src/generated/prisma/client";
import { ensureDefaultFeeHeads } from "../src/lib/ensure-fee-heads";
import { prisma } from "../src/lib/prisma";

const TEST_DUES = "Test Dues";
const AMOUNT = new Prisma.Decimal(500);

/** Exam months Mar–Sep (same window as monthly backfill). */
function testPeriods(now = new Date()) {
  const keys: string[] = [];
  let y = 2026;
  let m = 3;
  const endY = now.getUTCFullYear();
  const endM = now.getUTCMonth() + 1;
  while (y < endY || (y === endY && m <= endM)) {
    // Every other month: Mar, May, Jul, Sep…
    if (m % 2 === 1) keys.push(`${y}-${String(m).padStart(2, "0")}`);
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

  const feeHead = await prisma.feeHead.upsert({
    where: { organizationId_name: { organizationId: org.id, name: TEST_DUES } },
    update: {
      isActive: true,
      defaultAmount: AMOUNT,
      // Odd months only — matches seed periods
      applicableMonths: [3, 5, 7, 9, 11],
    },
    create: {
      organizationId: org.id,
      name: TEST_DUES,
      category: "TEST_DUES",
      frequency: "MONTHLY",
      description: "Test / exam dues",
      defaultAmount: AMOUNT,
      applicableMonths: [3, 5, 7, 9, 11],
      isActive: true,
    },
    select: { id: true },
  });

  const students = await prisma.student.findMany({
    where: { organizationId: org.id, isActive: true },
    select: { id: true, rollNumber: true, name: true },
    orderBy: { rollNumber: "asc" },
  });
  if (!students.length) throw new Error("No students");

  // Wipe prior Test Dues for clean reseed
  const old = await prisma.feeCharge.findMany({
    where: { organizationId: org.id, feeHeadId: feeHead.id },
    select: { id: true },
  });
  const oldIds = old.map((c) => c.id);
  if (oldIds.length) {
    await prisma.feePaymentAllocation.deleteMany({ where: { chargeId: { in: oldIds } } });
    await prisma.feeCharge.deleteMany({ where: { id: { in: oldIds } } });
  }
  const emptyPayments = await prisma.feePayment.findMany({
    where: {
      organizationId: org.id,
      note: { contains: "Test Dues" },
      allocations: { none: {} },
    },
    select: { id: true },
  });
  if (emptyPayments.length) {
    await prisma.feePayment.deleteMany({
      where: { id: { in: emptyPayments.map((p) => p.id) } },
    });
  }

  const periods = testPeriods();
  let paid = 0;
  let pending = 0;
  let skippedStudents = 0;
  let skippedMonths = 0;

  for (const student of students) {
    const h = hashInt(student.id);
    // ~1 in 5 students: no Test Dues at all
    if (h % 5 === 0) {
      skippedStudents += 1;
      continue;
    }

    for (const periodKey of periods) {
      // ~1 in 4 of remaining months: skip charge entirely (miss)
      if ((h + periodKey.length + Number(periodKey.slice(-2))) % 4 === 0) {
        skippedMonths += 1;
        continue;
      }

      // ~1 in 3 of charged months: leave unpaid
      const leavePending = (h + Number(periodKey.replace("-", ""))) % 3 === 0;
      const paidAt = new Date(`${periodKey}-12T10:00:00.000Z`);
      const charge = await prisma.feeCharge.create({
        data: {
          organizationId: org.id,
          studentId: student.id,
          feeHeadId: feeHead.id,
          periodKey,
          description: TEST_DUES,
          amount: AMOUNT,
          status: leavePending ? "UNPAID" : "PAID",
        },
        select: { id: true },
      });

      if (leavePending) {
        pending += 1;
        continue;
      }

      await prisma.feePayment.create({
        data: {
          organizationId: org.id,
          studentId: student.id,
          receiptNumber: `TST-${periodKey.replace("-", "")}-${student.rollNumber}-${randomUUID().slice(0, 3).toUpperCase()}`,
          amount: AMOUNT,
          method: "CASH",
          paidAt,
          note: `Test Dues ${periodKey}`,
          allocations: { create: { chargeId: charge.id, amount: AMOUNT } },
        },
      });
      paid += 1;
    }
  }

  console.log(`${org.name}: Test Dues @ PKR ${AMOUNT}`);
  console.log(`Periods (odd months): ${periods.join(", ")}`);
  console.log(`Students skipped entirely: ${skippedStudents}`);
  console.log(`Month charges skipped (miss): ${skippedMonths}`);
  console.log(`Paid: ${paid} · Pending: ${pending}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
