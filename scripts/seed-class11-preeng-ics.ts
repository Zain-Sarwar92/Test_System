import "dotenv/config";
import { prisma } from "../src/lib/prisma";

const CLASS_11_ID = "cmsoamwyo0000hgw15b7wo0vn";
const SECTION_ID = "cmsx6xu3s0004nww1ju3zaeyj"; // Class 11 · A · AL Zain
const ORG_ID = "cmsun5a6j000060w1n3vf4btl";

const PRE_ENG = [
  { roll: "1101", name: "Ahmed Raza", father: "Muhammad Raza", phone: "03001234501" },
  { roll: "1102", name: "Hassan Ali", father: "Ali Akbar", phone: "03001234502" },
  { roll: "1103", name: "Usman Khan", father: "Imran Khan", phone: "03001234503" },
  { roll: "1104", name: "Bilal Ahmed", father: "Saeed Ahmed", phone: "03001234504" },
  { roll: "1105", name: "Zain Malik", father: "Tariq Malik", phone: "03001234505" },
];

const ICS = [
  { roll: "1111", name: "Hamza Iqbal", father: "Iqbal Hussain", phone: "03001234511" },
  { roll: "1112", name: "Saad Farooq", father: "Farooq Ahmad", phone: "03001234512" },
  { roll: "1113", name: "Omar Sheikh", father: "Nadeem Sheikh", phone: "03001234513" },
  { roll: "1114", name: "Ali Haider", father: "Haider Ali", phone: "03001234514" },
  { roll: "1115", name: "Rehan Siddiqui", father: "Asif Siddiqui", phone: "03001234515" },
];

async function main() {
  const section = await prisma.section.findFirst({
    where: { id: SECTION_ID, organizationId: ORG_ID, classId: CLASS_11_ID },
    select: { id: true, name: true, organization: { select: { name: true } }, class: { select: { name: true } } },
  });
  if (!section) throw new Error("Target Class 11 section not found");

  const chemistry = await prisma.subject.findFirst({
    where: { classId: CLASS_11_ID, name: { equals: "Chemistry", mode: "insensitive" } },
  });
  const computer = await prisma.subject.findFirst({
    where: { classId: CLASS_11_ID, name: { equals: "Computer", mode: "insensitive" } },
  });
  if (!chemistry || !computer) {
    throw new Error("Chemistry or Computer subject missing for Class 11");
  }

  // Class 11: treat Chemistry as science elective so Pre-eng vs ICS mix works in results.
  await prisma.subject.update({
    where: { id: chemistry.id },
    data: { track: "SCIENCE", electiveGroup: "SCIENCE_ELECTIVE" },
  });
  await prisma.subject.update({
    where: { id: computer.id },
    data: { track: "SCIENCE", electiveGroup: "SCIENCE_ELECTIVE" },
  });

  let created = 0;

  async function upsertStudent(row: (typeof PRE_ENG)[number], studyGroup: "PRE_ENGINEERING" | "ICS", electiveId: string) {
    const student = await prisma.student.upsert({
      where: {
        sectionId_rollNumber: {
          sectionId: SECTION_ID,
          rollNumber: row.roll,
        },
      },
      update: {
        name: row.name,
        fatherName: row.father,
        phone: row.phone,
        isActive: true,
        stream: "SCIENCE",
        studyGroup,
        electiveSubjectId: electiveId,
      },
      create: {
        organizationId: ORG_ID,
        sectionId: SECTION_ID,
        rollNumber: row.roll,
        name: row.name,
        fatherName: row.father,
        phone: row.phone,
        isActive: true,
        stream: "SCIENCE",
        studyGroup,
        electiveSubjectId: electiveId,
      },
    });

    await prisma.studentElectiveChoice.deleteMany({ where: { studentId: student.id } });
    await prisma.studentElectiveChoice.create({
      data: { studentId: student.id, subjectId: electiveId },
    });
    created += 1;
  }

  for (const row of PRE_ENG) {
    await upsertStudent(row, "PRE_ENGINEERING", chemistry.id);
  }
  for (const row of ICS) {
    await upsertStudent(row, "ICS", computer.id);
  }

  const students = await prisma.student.findMany({
    where: { sectionId: SECTION_ID },
    orderBy: { rollNumber: "asc" },
    select: {
      rollNumber: true,
      name: true,
      studyGroup: true,
      electiveSubject: { select: { name: true } },
    },
  });

  console.log(
    JSON.stringify(
      {
        section: `${section.class.name} · ${section.name} (${section.organization.name})`,
        createdOrUpdated: created,
        chemistryId: chemistry.id,
        computerId: computer.id,
        students,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
