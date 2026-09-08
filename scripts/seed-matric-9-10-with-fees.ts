import "dotenv/config";
import { Prisma } from "../src/generated/prisma/client";
import { prisma } from "../src/lib/prisma";

const MATRIC_CLASSES = ["Class 9", "Class 10"] as const;
const PERIOD = new Date().toISOString().slice(0, 7); // YYYY-MM

type SeedStudent = {
  rollNumber: string;
  name: string;
  fatherName: string;
  phone: string;
  stream: "SCIENCE" | "ARTS";
  studyGroup: "BIOLOGY" | "COMPUTER" | "ARTS";
};

const CLASS_9_STUDENTS: SeedStudent[] = [
  { rollNumber: "901", name: "Ahmed Raza", fatherName: "Muhammad Raza", phone: "03001239001", stream: "SCIENCE", studyGroup: "BIOLOGY" },
  { rollNumber: "902", name: "Hassan Ali", fatherName: "Ali Akbar", phone: "03001239002", stream: "SCIENCE", studyGroup: "BIOLOGY" },
  { rollNumber: "903", name: "Bilal Khan", fatherName: "Imran Khan", phone: "03001239003", stream: "SCIENCE", studyGroup: "COMPUTER" },
  { rollNumber: "904", name: "Usman Tariq", fatherName: "Tariq Mehmood", phone: "03001239004", stream: "SCIENCE", studyGroup: "COMPUTER" },
  { rollNumber: "905", name: "Zain Abbas", fatherName: "Abbas Ali", phone: "03001239005", stream: "ARTS", studyGroup: "ARTS" },
  { rollNumber: "906", name: "Ayesha Noor", fatherName: "Noor Hassan", phone: "03001239006", stream: "SCIENCE", studyGroup: "BIOLOGY" },
  { rollNumber: "907", name: "Fatima Zahra", fatherName: "Zahid Hussain", phone: "03001239007", stream: "SCIENCE", studyGroup: "COMPUTER" },
  { rollNumber: "908", name: "Sana Malik", fatherName: "Malik Asif", phone: "03001239008", stream: "ARTS", studyGroup: "ARTS" },
];

const CLASS_10_STUDENTS: SeedStudent[] = [
  { rollNumber: "1001", name: "Hamza Iqbal", fatherName: "Iqbal Ahmed", phone: "03001231001", stream: "SCIENCE", studyGroup: "BIOLOGY" },
  { rollNumber: "1002", name: "Saad Farooq", fatherName: "Farooq Ahmad", phone: "03001231002", stream: "SCIENCE", studyGroup: "BIOLOGY" },
  { rollNumber: "1003", name: "Omar Sheikh", fatherName: "Sheikh Nadeem", phone: "03001231003", stream: "SCIENCE", studyGroup: "COMPUTER" },
  { rollNumber: "1004", name: "Daniyal Rauf", fatherName: "Abdul Rauf", phone: "03001231004", stream: "SCIENCE", studyGroup: "COMPUTER" },
  { rollNumber: "1005", name: "Maryam Javed", fatherName: "Javed Iqbal", phone: "03001231005", stream: "SCIENCE", studyGroup: "BIOLOGY" },
  { rollNumber: "1006", name: "Hira Shah", fatherName: "Shahid Ali", phone: "03001231006", stream: "SCIENCE", studyGroup: "COMPUTER" },
  { rollNumber: "1007", name: "Laiba Asim", fatherName: "Asim Raza", phone: "03001231007", stream: "ARTS", studyGroup: "ARTS" },
  { rollNumber: "1008", name: "Nimra Yousaf", fatherName: "Yousaf Khan", phone: "03001231008", stream: "ARTS", studyGroup: "ARTS" },
];

async function pickOrg() {
  const preferred = await prisma.organization.findFirst({
    where: {
      OR: [
        { slug: { contains: "zain", mode: "insensitive" } },
        { name: { contains: "zain", mode: "insensitive" } },
        { moduleFees: true },
      ],
    },
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true, slug: true, moduleFees: true },
  });
  if (preferred) return preferred;
  return prisma.organization.findFirst({
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true, slug: true, moduleFees: true },
  });
}

async function ensureFeeSetup(organizationId: string, classId: string, className: string) {
  await prisma.organization.update({
    where: { id: organizationId },
    data: { moduleFees: true },
  });

  const heads = [
    { name: "Monthly Tuition", category: "TUITION" as const, amount: "4500.00", frequency: "MONTHLY" as const },
    { name: "Generator Dues", category: "GENERATOR" as const, amount: "500.00", frequency: "MONTHLY" as const },
    { name: "Test Dues", category: "TEST_DUES" as const, amount: "800.00", frequency: "MONTHLY" as const },
  ];

  const headRows = [];
  for (const head of heads) {
    const row = await prisma.feeHead.upsert({
      where: { organizationId_name: { organizationId, name: head.name } },
      update: { category: head.category, isActive: true },
      create: {
        organizationId,
        name: head.name,
        category: head.category,
        description: `${head.name} for matric classes`,
      },
    });
    headRows.push({ ...head, id: row.id });
  }

  const planName = `${className} Monthly Bundle`;
  let plan = await prisma.feePlan.findFirst({
    where: { organizationId, name: planName },
    select: { id: true },
  });
  if (!plan) {
    plan = await prisma.feePlan.create({
      data: {
        organizationId,
        name: planName,
        classId,
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
  } else {
    await prisma.feePlan.update({
      where: { id: plan.id },
      data: { isActive: true, classId, sectionId: null },
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
  }

  const items = await prisma.feePlanItem.findMany({
    where: { planId: plan.id, feeHead: { isActive: true } },
    select: { id: true, feeHeadId: true, amount: true, feeHead: { select: { name: true } } },
  });
  return { planId: plan.id, planName, items };
}

async function deleteMatricStudents(organizationId: string) {
  const students = await prisma.student.findMany({
    where: {
      organizationId,
      section: { class: { name: { in: [...MATRIC_CLASSES] } } },
    },
    select: { id: true },
  });
  const ids = students.map((s) => s.id);
  if (!ids.length) return 0;

  // Delete fee payment allocations via payments/charges, then students.
  await prisma.feePaymentAllocation.deleteMany({
    where: { payment: { studentId: { in: ids } } },
  });
  await prisma.feePaymentAllocation.deleteMany({
    where: { charge: { studentId: { in: ids } } },
  });
  await prisma.feePayment.deleteMany({ where: { studentId: { in: ids } } });
  await prisma.feeCharge.deleteMany({ where: { studentId: { in: ids } } });
  await prisma.studentMark.deleteMany({ where: { studentId: { in: ids } } });
  await prisma.studentElectiveChoice.deleteMany({ where: { studentId: { in: ids } } });
  await prisma.studentFieldValue.deleteMany({ where: { studentId: { in: ids } } });
  await prisma.student.deleteMany({ where: { id: { in: ids } } });
  return ids.length;
}

async function electiveFor(
  classId: string,
  studyGroup: SeedStudent["studyGroup"],
) {
  if (studyGroup === "ARTS") return null;
  const name = studyGroup === "BIOLOGY" ? "Biology" : "Computer";
  const subject = await prisma.subject.findFirst({
    where: { classId, name: { equals: name, mode: "insensitive" } },
    select: { id: true },
  });
  return subject?.id ?? null;
}

async function seedSectionStudents(input: {
  organizationId: string;
  sectionId: string;
  classId: string;
  students: SeedStudent[];
  plan: Awaited<ReturnType<typeof ensureFeeSetup>>;
}) {
  const created = [];
  for (const row of input.students) {
    const electiveSubjectId = await electiveFor(input.classId, row.studyGroup);
    const student = await prisma.student.create({
      data: {
        organizationId: input.organizationId,
        sectionId: input.sectionId,
        rollNumber: row.rollNumber,
        name: row.name,
        fatherName: row.fatherName,
        phone: row.phone,
        stream: row.stream,
        studyGroup: row.studyGroup,
        electiveSubjectId,
        isActive: true,
        ...(electiveSubjectId
          ? {
              electiveChoices: {
                create: { subjectId: electiveSubjectId },
              },
            }
          : {}),
      },
      select: { id: true, name: true, rollNumber: true },
    });

    // Generate current-month dues for all plan items.
    await prisma.feeCharge.createMany({
      data: input.plan.items.map((item) => ({
        organizationId: input.organizationId,
        studentId: student.id,
        feeHeadId: item.feeHeadId,
        planItemId: item.id,
        periodKey: PERIOD,
        description: input.plan.planName,
        amount: item.amount,
        status: "UNPAID" as const,
      })),
      skipDuplicates: true,
    });

    // Mark first student partially paid (demo collect flow).
    if (row.rollNumber === input.students[0]?.rollNumber) {
      const tuition = await prisma.feeCharge.findFirst({
        where: {
          studentId: student.id,
          periodKey: PERIOD,
          feeHead: { name: "Monthly Tuition" },
        },
        select: { id: true, amount: true },
      });
      if (tuition) {
        const payAmount = new Prisma.Decimal("2000.00");
        await prisma.feePayment.create({
          data: {
            organizationId: input.organizationId,
            studentId: student.id,
            receiptNumber: `RCP-SEED-${student.rollNumber}-${PERIOD.replace("-", "")}`,
            amount: payAmount,
            method: "CASH",
            paidAt: new Date(),
            note: "Seed partial tuition payment",
            allocations: {
              create: { chargeId: tuition.id, amount: payAmount },
            },
          },
        });
        await prisma.feeCharge.update({
          where: { id: tuition.id },
          data: { status: "PARTIAL" },
        });
      }
    }

    created.push(student);
  }
  return created;
}

async function main() {
  const org = await pickOrg();
  if (!org) throw new Error("No organization found");

  console.log(`Using org: ${org.name} (${org.slug})`);

  const deleted = await deleteMatricStudents(org.id);
  console.log(`Deleted ${deleted} Class 9/10 students (+ fee records)`);

  for (const className of MATRIC_CLASSES) {
    const klass = await prisma.class.findFirst({
      where: { name: className },
      select: { id: true, name: true, board: { select: { name: true } } },
      orderBy: { board: { name: "asc" } },
    });
    if (!klass) {
      console.log(`Skip: ${className} not found`);
      continue;
    }

    let section = await prisma.section.findFirst({
      where: { organizationId: org.id, classId: klass.id, name: "A" },
      select: { id: true, name: true },
    });
    if (!section) {
      section = await prisma.section.create({
        data: {
          organizationId: org.id,
          classId: klass.id,
          name: "A",
        },
        select: { id: true, name: true },
      });
      console.log(`Created section ${className} / A`);
    }

    const plan = await ensureFeeSetup(org.id, klass.id, className);
    const roster = className === "Class 9" ? CLASS_9_STUDENTS : CLASS_10_STUDENTS;
    const created = await seedSectionStudents({
      organizationId: org.id,
      sectionId: section.id,
      classId: klass.id,
      students: roster,
      plan,
    });
    console.log(
      `Seeded ${created.length} students in ${klass.board.name} · ${className} · ${section.name} with ${plan.items.length} fee heads for ${PERIOD}`,
    );
  }

  console.log("Done.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
