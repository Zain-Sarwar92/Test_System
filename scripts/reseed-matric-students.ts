import "dotenv/config";
import { Prisma } from "../src/generated/prisma/client";
import { prisma } from "../src/lib/prisma";

type SeedStudent = {
  rollNumber: string;
  name: string;
  fatherName: string;
  phone: string;
  stream: "SCIENCE" | "ARTS";
  studyGroup: "BIOLOGY" | "COMPUTER" | "ARTS";
  monthlyFee: string;
};

const CLASS_9: SeedStudent[] = [
  { rollNumber: "901", name: "Ahmed Raza", fatherName: "Muhammad Raza", phone: "03001239001", stream: "SCIENCE", studyGroup: "BIOLOGY", monthlyFee: "4000" },
  { rollNumber: "902", name: "Hassan Ali", fatherName: "Ali Akbar", phone: "03001239002", stream: "SCIENCE", studyGroup: "BIOLOGY", monthlyFee: "4000" },
  { rollNumber: "903", name: "Bilal Khan", fatherName: "Imran Khan", phone: "03001239003", stream: "SCIENCE", studyGroup: "COMPUTER", monthlyFee: "4000" },
  { rollNumber: "904", name: "Usman Tariq", fatherName: "Tariq Mehmood", phone: "03001239004", stream: "SCIENCE", studyGroup: "COMPUTER", monthlyFee: "4000" },
  { rollNumber: "905", name: "Zain Abbas", fatherName: "Abbas Ali", phone: "03001239005", stream: "ARTS", studyGroup: "ARTS", monthlyFee: "3500" },
  { rollNumber: "906", name: "Ayesha Noor", fatherName: "Noor Hassan", phone: "03001239006", stream: "SCIENCE", studyGroup: "BIOLOGY", monthlyFee: "4000" },
  { rollNumber: "907", name: "Fatima Zahra", fatherName: "Zahid Hussain", phone: "03001239007", stream: "SCIENCE", studyGroup: "COMPUTER", monthlyFee: "4000" },
  { rollNumber: "908", name: "Sana Malik", fatherName: "Malik Asif", phone: "03001239008", stream: "ARTS", studyGroup: "ARTS", monthlyFee: "3500" },
];

const CLASS_10: SeedStudent[] = [
  { rollNumber: "1001", name: "Hamza Iqbal", fatherName: "Iqbal Ahmed", phone: "03001231001", stream: "SCIENCE", studyGroup: "BIOLOGY", monthlyFee: "4500" },
  { rollNumber: "1002", name: "Saad Farooq", fatherName: "Farooq Ahmad", phone: "03001231002", stream: "SCIENCE", studyGroup: "BIOLOGY", monthlyFee: "4500" },
  { rollNumber: "1003", name: "Omar Sheikh", fatherName: "Sheikh Nadeem", phone: "03001231003", stream: "SCIENCE", studyGroup: "COMPUTER", monthlyFee: "4500" },
  { rollNumber: "1004", name: "Daniyal Rauf", fatherName: "Abdul Rauf", phone: "03001231004", stream: "SCIENCE", studyGroup: "COMPUTER", monthlyFee: "4500" },
  { rollNumber: "1005", name: "Maryam Javed", fatherName: "Javed Iqbal", phone: "03001231005", stream: "SCIENCE", studyGroup: "BIOLOGY", monthlyFee: "4500" },
  { rollNumber: "1006", name: "Hira Shah", fatherName: "Shahid Ali", phone: "03001231006", stream: "SCIENCE", studyGroup: "COMPUTER", monthlyFee: "4500" },
  { rollNumber: "1007", name: "Laiba Asim", fatherName: "Asim Raza", phone: "03001231007", stream: "ARTS", studyGroup: "ARTS", monthlyFee: "4000" },
  { rollNumber: "1008", name: "Nimra Yousaf", fatherName: "Yousaf Khan", phone: "03001231008", stream: "ARTS", studyGroup: "ARTS", monthlyFee: "4000" },
];

async function electiveFor(classId: string, studyGroup: SeedStudent["studyGroup"]) {
  if (studyGroup === "ARTS") return null;
  const name = studyGroup === "BIOLOGY" ? "Biology" : "Computer";
  const subject = await prisma.subject.findFirst({
    where: { classId, name: { equals: name, mode: "insensitive" } },
    select: { id: true },
  });
  return subject?.id ?? null;
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
  if (!org) throw new Error("AL Zain organization not found");

  console.log("Org:", org.name);

  for (const [className, roster] of [
    ["Class 9", CLASS_9],
    ["Class 10", CLASS_10],
  ] as const) {
    const klass = await prisma.class.findFirst({
      where: { name: className },
      select: { id: true },
      orderBy: { board: { name: "asc" } },
    });
    if (!klass) {
      console.log("Skip missing class", className);
      continue;
    }

    let section = await prisma.section.findFirst({
      where: { organizationId: org.id, classId: klass.id, name: "A" },
      select: { id: true },
    });
    if (!section) {
      section = await prisma.section.create({
        data: { organizationId: org.id, classId: klass.id, name: "A" },
        select: { id: true },
      });
    }

    let created = 0;
    for (const row of roster) {
      const existing = await prisma.student.findFirst({
        where: { sectionId: section.id, rollNumber: row.rollNumber },
        select: { id: true },
      });
      if (existing) {
        await prisma.student.update({
          where: { id: existing.id },
          data: {
            name: row.name,
            fatherName: row.fatherName,
            phone: row.phone,
            stream: row.stream,
            studyGroup: row.studyGroup,
            monthlyFee: new Prisma.Decimal(row.monthlyFee),
            isActive: true,
          },
        });
        continue;
      }

      const electiveSubjectId = await electiveFor(klass.id, row.studyGroup);
      await prisma.student.create({
        data: {
          organizationId: org.id,
          sectionId: section.id,
          rollNumber: row.rollNumber,
          name: row.name,
          fatherName: row.fatherName,
          phone: row.phone,
          stream: row.stream,
          studyGroup: row.studyGroup,
          monthlyFee: new Prisma.Decimal(row.monthlyFee),
          electiveSubjectId,
          isActive: true,
          ...(electiveSubjectId
            ? { electiveChoices: { create: { subjectId: electiveSubjectId } } }
            : {}),
        },
      });
      created += 1;
    }
    console.log(`${className} · A — created ${created}, roster ${roster.length}`);
  }

  console.log("Done.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
