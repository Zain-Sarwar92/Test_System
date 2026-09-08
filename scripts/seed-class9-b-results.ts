import "dotenv/config";
import { randomUUID } from "node:crypto";
import { Prisma } from "../src/generated/prisma/client";
import { academicSession } from "../src/lib/results";
import {
  chosenElectiveIds,
  isDefaultResultSubject,
  isStudentEnrolledInSubject,
  type StudentStream,
} from "../src/lib/subject-stream";
import { prisma } from "../src/lib/prisma";

type SeedStudent = {
  rollNumber: string;
  name: string;
  fatherName: string;
  phone: string;
  studyGroup: "BIOLOGY" | "COMPUTER";
  monthlyFee: string;
};

const SECTION_B: SeedStudent[] = [
  { rollNumber: "921", name: "Ali Hassan", fatherName: "Hassan Raza", phone: "03001239201", studyGroup: "BIOLOGY", monthlyFee: "4000" },
  { rollNumber: "922", name: "Sara Ahmed", fatherName: "Ahmed Khan", phone: "03001239202", studyGroup: "BIOLOGY", monthlyFee: "4000" },
  { rollNumber: "923", name: "Kashif Ali", fatherName: "Ali Akbar", phone: "03001239203", studyGroup: "COMPUTER", monthlyFee: "3500" },
  { rollNumber: "924", name: "Nida Fatima", fatherName: "Imran Shah", phone: "03001239204", studyGroup: "COMPUTER", monthlyFee: "4000" },
  { rollNumber: "925", name: "Waleed Khan", fatherName: "Khalid Khan", phone: "03001239205", studyGroup: "BIOLOGY", monthlyFee: "3500" },
  { rollNumber: "926", name: "Iqra Noor", fatherName: "Noor Alam", phone: "03001239206", studyGroup: "COMPUTER", monthlyFee: "4000" },
];

function hashMark(seed: string, total: number) {
  let h = 0;
  for (let i = 0; i < seed.length; i += 1) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  const min = Math.ceil(total * 0.4);
  const max = Math.floor(total * 0.95);
  return min + (h % (max - min + 1));
}

async function electiveFor(classId: string, studyGroup: "BIOLOGY" | "COMPUTER") {
  const name = studyGroup === "BIOLOGY" ? "Biology" : "Computer";
  const subject = await prisma.subject.findFirst({
    where: { classId, name: { equals: name, mode: "insensitive" } },
    select: { id: true },
  });
  return subject?.id ?? null;
}

async function wipeSectionStudents(ids: string[]) {
  if (!ids.length) return;
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
}

async function seedExamMarks(input: {
  organizationId: string;
  examTermId: string;
  sectionId: string;
  classId: string;
  students: Array<{
    id: string;
    stream: StudentStream;
    studyGroup: string | null;
    electiveSubjectId: string | null;
    electiveChoices: Array<{ subjectId: string }>;
  }>;
  includePhysics: boolean;
  seedPrefix: string;
}) {
  // Clear prior assessments for this section+exam
  const old = await prisma.subjectAssessment.findMany({
    where: {
      organizationId: input.organizationId,
      examTermId: input.examTermId,
      sectionId: input.sectionId,
    },
    select: { id: true },
  });
  const oldIds = old.map((a) => a.id);
  if (oldIds.length) {
    await prisma.studentMark.deleteMany({ where: { assessmentId: { in: oldIds } } });
    await prisma.assessmentManualMark.deleteMany({ where: { assessmentId: { in: oldIds } } });
    await prisma.assessmentSheet.deleteMany({ where: { assessmentId: { in: oldIds } } });
    await prisma.subjectAssessment.deleteMany({ where: { id: { in: oldIds } } });
  }

  const allSubjects = await prisma.subject.findMany({
    where: { classId: input.classId },
    select: { id: true, name: true, track: true, electiveGroup: true },
  });
  const subjects = allSubjects.filter((subject) => {
    if (!isDefaultResultSubject(subject)) return false;
    if (!input.includePhysics) {
      const n = subject.name.toLowerCase();
      if (n.includes("physics") || subject.name.includes("فزکس") || subject.name.includes("طبیعیات")) {
        return false;
      }
    }
    return true;
  });

  let markCount = 0;
  for (const subject of subjects) {
    const assessment = await prisma.subjectAssessment.create({
      data: {
        organizationId: input.organizationId,
        examTermId: input.examTermId,
        sectionId: input.sectionId,
        subjectId: subject.id,
        totalMarks: new Prisma.Decimal(30),
      },
      select: { id: true },
    });
    for (const student of input.students) {
      const electiveIds = chosenElectiveIds({
        electiveSubjectId: student.electiveSubjectId,
        electiveChoiceIds: student.electiveChoices.map((c) => c.subjectId),
      });
      if (
        !isStudentEnrolledInSubject(
          {
            stream: student.stream,
            studyGroup: student.studyGroup,
            electiveSubjectId: student.electiveSubjectId,
            electiveChoiceIds: electiveIds,
          },
          subject,
        )
      ) {
        continue;
      }
      await prisma.studentMark.create({
        data: {
          assessmentId: assessment.id,
          studentId: student.id,
          obtainedMarks: new Prisma.Decimal(
            hashMark(`${input.seedPrefix}:${student.id}:${subject.id}`, 30),
          ),
          isAbsent: false,
        },
      });
      markCount += 1;
    }
  }
  return { subjects: subjects.map((s) => s.name), markCount };
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

  const klass = await prisma.class.findFirst({
    where: { name: { equals: "Class 9", mode: "insensitive" } },
    select: { id: true, name: true },
    orderBy: { board: { name: "asc" } },
  });
  if (!klass) throw new Error("Class 9 not found");

  let section = await prisma.section.findFirst({
    where: { organizationId: org.id, classId: klass.id, name: "B" },
    select: { id: true, name: true },
  });
  if (!section) {
    section = await prisma.section.create({
      data: { organizationId: org.id, classId: klass.id, name: "B" },
      select: { id: true, name: true },
    });
    console.log("Created section B");
  }

  const existing = await prisma.student.findMany({
    where: { organizationId: org.id, sectionId: section.id },
    select: { id: true },
  });
  await wipeSectionStudents(existing.map((s) => s.id));
  console.log(`Cleared ${existing.length} students in Class 9 · B`);

  const period = new Date().toISOString().slice(0, 7);
  const feeHead = await prisma.feeHead.upsert({
    where: { organizationId_name: { organizationId: org.id, name: "Monthly Fee" } },
    update: { isActive: true },
    create: {
      organizationId: org.id,
      name: "Monthly Fee",
      category: "TUITION",
      frequency: "MONTHLY",
      isActive: true,
    },
    select: { id: true },
  });

  const createdStudents = [];
  for (const row of SECTION_B) {
    const electiveSubjectId = await electiveFor(klass.id, row.studyGroup);
    const amount = new Prisma.Decimal(row.monthlyFee);
    const student = await prisma.student.create({
      data: {
        organizationId: org.id,
        sectionId: section.id,
        rollNumber: row.rollNumber,
        name: row.name,
        fatherName: row.fatherName,
        phone: row.phone,
        stream: "SCIENCE",
        studyGroup: row.studyGroup,
        monthlyFee: amount,
        electiveSubjectId,
        isActive: true,
        ...(electiveSubjectId
          ? { electiveChoices: { create: { subjectId: electiveSubjectId } } }
          : {}),
      },
      select: {
        id: true,
        stream: true,
        studyGroup: true,
        electiveSubjectId: true,
        electiveChoices: { select: { subjectId: true } },
      },
    });

    const charge = await prisma.feeCharge.create({
      data: {
        organizationId: org.id,
        studentId: student.id,
        feeHeadId: feeHead.id,
        periodKey: period,
        description: "Monthly Fee",
        amount,
        status: "PAID",
      },
      select: { id: true },
    });
    await prisma.feePayment.create({
      data: {
        organizationId: org.id,
        studentId: student.id,
        receiptNumber: `RCP-B-${row.rollNumber}-${randomUUID().slice(0, 4).toUpperCase()}`,
        amount,
        method: "CASH",
        paidAt: new Date(),
        note: "Auto-paid on enrollment",
        allocations: { create: { chargeId: charge.id, amount } },
      },
    });
    createdStudents.push(student);
  }
  console.log(`Created ${createdStudents.length} students in Class 9 · B`);

  const session = academicSession();
  const round1 = await prisma.examTerm.findFirst({
    where: { organizationId: org.id, name: "Round1", session },
    select: { id: true },
  });
  const round2 = await prisma.examTerm.findFirst({
    where: { organizationId: org.id, name: "Round2", session },
    select: { id: true },
  });
  if (!round1 || !round2) {
    throw new Error("Round1/Round2 exams not found — create section A results first");
  }

  const r1 = await seedExamMarks({
    organizationId: org.id,
    examTermId: round1.id,
    sectionId: section.id,
    classId: klass.id,
    students: createdStudents,
    includePhysics: false,
    seedPrefix: "B-R1",
  });
  const r2 = await seedExamMarks({
    organizationId: org.id,
    examTermId: round2.id,
    sectionId: section.id,
    classId: klass.id,
    students: createdStudents,
    includePhysics: true,
    seedPrefix: "B-R2",
  });

  console.log(`Round1 marks: ${r1.markCount} · subjects: ${r1.subjects.join(", ")}`);
  console.log(`Round2 marks: ${r2.markCount} · subjects: ${r2.subjects.join(", ")}`);
  console.log("Done. Combine A + B from Results → Class 9.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
