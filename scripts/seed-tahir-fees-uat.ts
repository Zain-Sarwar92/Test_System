/**
 * Tahir Fees UAT seed:
 * - Fee heads + Class 9 monthly plan
 * - Generate current-month dues for Class 9 A / B / Arts (75 students)
 * - Partial + full payments for collect/pending scenarios
 * - Logic assertions
 */
import "dotenv/config";
import { Prisma } from "../src/generated/prisma/client";
import { prisma } from "../src/lib/prisma";

const PERIOD = new Date().toISOString().slice(0, 7);

const HEADS = [
  {
    name: "Monthly Tuition",
    category: "TUITION" as const,
    amount: "4500.00",
    frequency: "MONTHLY" as const,
  },
  {
    name: "Generator Dues",
    category: "GENERATOR" as const,
    amount: "500.00",
    frequency: "MONTHLY" as const,
  },
  {
    name: "Test Dues",
    category: "TEST_DUES" as const,
    amount: "800.00",
    frequency: "MONTHLY" as const,
  },
] as const;

async function main() {
  const org = await prisma.organization.findFirst({
    where: {
      OR: [
        { slug: { equals: "tahir", mode: "insensitive" } },
        { name: { contains: "tahir", mode: "insensitive" } },
      ],
    },
    select: { id: true, name: true, slug: true },
  });
  if (!org) throw new Error("Tahir org not found");

  await prisma.organization.update({
    where: { id: org.id },
    data: { moduleFees: true },
  });

  const klass = await prisma.class.findFirst({
    where: { name: { equals: "Class 9", mode: "insensitive" } },
    select: { id: true, name: true },
    orderBy: { board: { name: "asc" } },
  });
  if (!klass) throw new Error("Class 9 not found");

  const sections = await prisma.section.findMany({
    where: {
      organizationId: org.id,
      classId: klass.id,
      name: { in: ["A", "B", "Arts"] },
    },
    select: { id: true, name: true, _count: { select: { students: true } } },
    orderBy: { name: "asc" },
  });
  if (sections.length < 3) {
    throw new Error("Need Class 9 sections A, B, Arts — run seed-tahir-results-uat.ts first");
  }

  console.log(`Org: ${org.name}`);
  console.log(
    `Sections: ${sections.map((s) => `${s.name}(${s._count.students})`).join(", ")}`,
  );

  const headRows = [];
  for (const head of HEADS) {
    const row = await prisma.feeHead.upsert({
      where: { organizationId_name: { organizationId: org.id, name: head.name } },
      update: { category: head.category, isActive: true },
      create: {
        organizationId: org.id,
        name: head.name,
        category: head.category,
        description: `${head.name} · Tahir UAT`,
      },
    });
    headRows.push({ ...head, id: row.id });
  }
  console.log(`Fee heads: ${headRows.map((h) => h.name).join(", ")}`);

  const planName = "Class 9 Monthly Bundle";
  let plan = await prisma.feePlan.findFirst({
    where: { organizationId: org.id, name: planName },
    select: { id: true },
  });
  if (!plan) {
    plan = await prisma.feePlan.create({
      data: {
        organizationId: org.id,
        name: planName,
        classId: klass.id,
        sectionId: null,
        isActive: true,
        items: {
          create: headRows.map((head) => ({
            feeHeadId: head.id,
            amount: new Prisma.Decimal(head.amount),
            frequency: head.frequency,
          })),
        },
      },
      select: { id: true },
    });
    console.log(`Created plan ${planName}`);
  } else {
    await prisma.feePlan.update({
      where: { id: plan.id },
      data: { isActive: true, classId: klass.id, sectionId: null },
    });
    for (const head of headRows) {
      await prisma.feePlanItem.upsert({
        where: { planId_feeHeadId: { planId: plan.id, feeHeadId: head.id } },
        update: {
          amount: new Prisma.Decimal(head.amount),
          frequency: head.frequency,
        },
        create: {
          planId: plan.id,
          feeHeadId: head.id,
          amount: new Prisma.Decimal(head.amount),
          frequency: head.frequency,
        },
      });
    }
    console.log(`Updated plan ${planName}`);
  }

  const planItems = await prisma.feePlanItem.findMany({
    where: { planId: plan.id, feeHead: { isActive: true } },
    select: {
      id: true,
      feeHeadId: true,
      amount: true,
      feeHead: { select: { name: true } },
    },
  });

  const students = await prisma.student.findMany({
    where: {
      organizationId: org.id,
      isActive: true,
      sectionId: { in: sections.map((s) => s.id) },
    },
    select: {
      id: true,
      rollNumber: true,
      name: true,
      sectionId: true,
      section: { select: { name: true } },
    },
    orderBy: [{ section: { name: "asc" } }, { rollNumber: "asc" }],
  });
  if (students.length < 50) {
    throw new Error(`Expected ~75 Class 9 A/B/Arts students, found ${students.length}`);
  }

  // Generate dues (idempotent via unique student+head+period)
  let createdCharges = 0;
  for (const student of students) {
    for (const item of planItems) {
      const existing = await prisma.feeCharge.findUnique({
        where: {
          studentId_feeHeadId_periodKey: {
            studentId: student.id,
            feeHeadId: item.feeHeadId,
            periodKey: PERIOD,
          },
        },
        select: { id: true },
      });
      if (existing) continue;
      await prisma.feeCharge.create({
        data: {
          organizationId: org.id,
          studentId: student.id,
          feeHeadId: item.feeHeadId,
          planItemId: item.id,
          periodKey: PERIOD,
          description: planName,
          amount: item.amount,
          status: "UNPAID",
        },
      });
      createdCharges += 1;
    }
  }
  console.log(`Created ${createdCharges} new charges for ${PERIOD} (${students.length} students × ${planItems.length} heads)`);

  // Payments: first student per section = partial tuition; second = full all dues
  let partialCount = 0;
  let paidCount = 0;
  for (const section of sections) {
    const sectionStudents = students.filter((s) => s.sectionId === section.id);
    const partialStudent = sectionStudents[0];
    const fullStudent = sectionStudents[1];

    if (partialStudent) {
      const tuition = await prisma.feeCharge.findFirst({
        where: {
          studentId: partialStudent.id,
          periodKey: PERIOD,
          feeHead: { name: "Monthly Tuition" },
          status: { in: ["UNPAID", "PARTIAL"] },
        },
        select: { id: true, amount: true, status: true },
      });
      if (tuition && tuition.status === "UNPAID") {
        const payAmount = new Prisma.Decimal("2000.00");
        await prisma.feePayment.create({
          data: {
            organizationId: org.id,
            studentId: partialStudent.id,
            receiptNumber: `UAT-P-${section.name}-${PERIOD.replace("-", "")}-${partialStudent.rollNumber}`,
            amount: payAmount,
            method: "CASH",
            paidAt: new Date(),
            note: "UAT partial tuition",
            allocations: { create: { chargeId: tuition.id, amount: payAmount } },
          },
        });
        await prisma.feeCharge.update({
          where: { id: tuition.id },
          data: { status: "PARTIAL" },
        });
        partialCount += 1;
      }
    }

    if (fullStudent) {
      const unpaid = await prisma.feeCharge.findMany({
        where: {
          studentId: fullStudent.id,
          periodKey: PERIOD,
          status: { in: ["UNPAID", "PARTIAL"] },
        },
        select: { id: true, amount: true },
      });
      if (unpaid.length) {
        const total = unpaid.reduce(
          (sum, row) => sum.add(row.amount),
          new Prisma.Decimal(0),
        );
        await prisma.feePayment.create({
          data: {
            organizationId: org.id,
            studentId: fullStudent.id,
            receiptNumber: `UAT-F-${section.name}-${PERIOD.replace("-", "")}-${fullStudent.rollNumber}`,
            amount: total,
            method: "CASH",
            paidAt: new Date(),
            note: "UAT full month clear",
            allocations: {
              create: unpaid.map((row) => ({
                chargeId: row.id,
                amount: row.amount,
              })),
            },
          },
        });
        await prisma.feeCharge.updateMany({
          where: { id: { in: unpaid.map((r) => r.id) } },
          data: { status: "PAID" },
        });
        paidCount += 1;
      }
    }
  }
  console.log(`Payments: partial=${partialCount}, full-clear=${paidCount}`);

  // ---- Tests ----
  const failures: string[] = [];

  const planOk = await prisma.feePlan.findFirst({
    where: { id: plan.id, isActive: true },
    include: { items: true },
  });
  if (!planOk || planOk.items.length < 3) {
    failures.push("Plan missing or incomplete items");
  }

  const chargeCount = await prisma.feeCharge.count({
    where: {
      organizationId: org.id,
      periodKey: PERIOD,
      studentId: { in: students.map((s) => s.id) },
    },
  });
  const expectedMin = students.length * planItems.length;
  if (chargeCount < expectedMin) {
    failures.push(`Charges ${chargeCount} < expected ${expectedMin}`);
  } else {
    console.log(`OK: ${chargeCount} charges for period ${PERIOD}`);
  }

  const unpaid = await prisma.feeCharge.count({
    where: {
      organizationId: org.id,
      periodKey: PERIOD,
      studentId: { in: students.map((s) => s.id) },
      status: "UNPAID",
    },
  });
  const partial = await prisma.feeCharge.count({
    where: {
      organizationId: org.id,
      periodKey: PERIOD,
      studentId: { in: students.map((s) => s.id) },
      status: "PARTIAL",
    },
  });
  const paid = await prisma.feeCharge.count({
    where: {
      organizationId: org.id,
      periodKey: PERIOD,
      studentId: { in: students.map((s) => s.id) },
      status: "PAID",
    },
  });
  console.log(`Status mix: UNPAID=${unpaid} PARTIAL=${partial} PAID=${paid}`);
  if (partial < 1) failures.push("Expected at least 1 PARTIAL charge");
  if (paid < 3) failures.push("Expected PAID charges from full clears");
  if (unpaid < 1) failures.push("Expected remaining UNPAID dues");

  // Duplicate generate should not increase (unique constraint)
  let dupBlocked = 0;
  for (const student of students.slice(0, 3)) {
    for (const item of planItems) {
      try {
        await prisma.feeCharge.create({
          data: {
            organizationId: org.id,
            studentId: student.id,
            feeHeadId: item.feeHeadId,
            planItemId: item.id,
            periodKey: PERIOD,
            description: "dup",
            amount: item.amount,
            status: "UNPAID",
          },
        });
      } catch {
        dupBlocked += 1;
      }
    }
  }
  if (dupBlocked === 9) console.log("OK: duplicate charges blocked by unique");
  else failures.push(`Expected 9 dup blocks, got ${dupBlocked}`);

  // Org isolation
  const otherOrg = await prisma.organization.findFirst({
    where: { NOT: { id: org.id } },
    select: { id: true },
  });
  if (otherOrg) {
    const leak = await prisma.feeCharge.count({
      where: {
        organizationId: otherOrg.id,
        studentId: { in: students.map((s) => s.id) },
      },
    });
    if (leak) failures.push(`Cross-org charge leak ${leak}`);
    else console.log("OK: no cross-org charge ownership");
  }

  console.log("\n--- Tests ---");
  if (failures.length) {
    for (const f of failures) console.error("FAIL", f);
    process.exitCode = 1;
  } else {
    console.log("PASSED: fee plan + dues + payment mix + uniqueness");
  }

  console.log(`\nOpen Fees → Class 9 → pending / collect · period ${PERIOD}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
