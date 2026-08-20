import "dotenv/config";
import { prisma } from "../src/lib/prisma";

const ORG_ID = "cmsun5a6j000060w1n3vf4btl"; // AL Zain

/** 4 Pre-medical + Biology elective; 1 Pre-medical + Computer elective. */
const STUDENTS = [
  {
    roll: "1201",
    name: "Ayesha Khan",
    father: "Imran Khan",
    phone: "03011234501",
    elective: "Biology" as const,
  },
  {
    roll: "1202",
    name: "Fatima Noor",
    father: "Noor Ahmad",
    phone: "03011234502",
    elective: "Biology" as const,
  },
  {
    roll: "1203",
    name: "Sara Ali",
    father: "Ali Raza",
    phone: "03011234503",
    elective: "Biology" as const,
  },
  {
    roll: "1204",
    name: "Hina Malik",
    father: "Tariq Malik",
    phone: "03011234504",
    elective: "Biology" as const,
  },
  {
    roll: "1205",
    name: "Maryam Iqbal",
    father: "Iqbal Hussain",
    phone: "03011234505",
    elective: "Computer" as const,
  },
];

async function main() {
  const section = await prisma.section.findFirst({
    where: {
      organizationId: ORG_ID,
      class: { name: { contains: "12", mode: "insensitive" } },
    },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      classId: true,
      organization: { select: { name: true } },
      class: { select: { id: true, name: true } },
    },
  });
  if (!section) throw new Error("Class 12 section not found for AL Zain");

  const biology = await prisma.subject.findFirst({
    where: {
      classId: section.classId,
      name: { equals: "Biology", mode: "insensitive" },
    },
  });
  const computer = await prisma.subject.findFirst({
    where: {
      classId: section.classId,
      OR: [
        { name: { equals: "Computer", mode: "insensitive" } },
        { name: { equals: "Computer Science", mode: "insensitive" } },
      ],
    },
  });
  if (!biology || !computer) {
    throw new Error(
      `Biology or Computer missing for ${section.class.name}. Found bio=${!!biology} computer=${!!computer}`,
    );
  }

  await prisma.subject.update({
    where: { id: biology.id },
    data: { track: "SCIENCE", electiveGroup: "SCIENCE_ELECTIVE" },
  });
  await prisma.subject.update({
    where: { id: computer.id },
    data: { track: "SCIENCE", electiveGroup: "SCIENCE_ELECTIVE" },
  });

  let created = 0;
  for (const row of STUDENTS) {
    const electiveId = row.elective === "Biology" ? biology.id : computer.id;
    const student = await prisma.student.upsert({
      where: {
        sectionId_rollNumber: {
          sectionId: section.id,
          rollNumber: row.roll,
        },
      },
      update: {
        name: row.name,
        fatherName: row.father,
        phone: row.phone,
        isActive: true,
        stream: "SCIENCE",
        studyGroup: "PRE_MEDICAL",
        electiveSubjectId: electiveId,
      },
      create: {
        organizationId: ORG_ID,
        sectionId: section.id,
        rollNumber: row.roll,
        name: row.name,
        fatherName: row.father,
        phone: row.phone,
        isActive: true,
        stream: "SCIENCE",
        studyGroup: "PRE_MEDICAL",
        electiveSubjectId: electiveId,
      },
    });

    await prisma.studentElectiveChoice.deleteMany({ where: { studentId: student.id } });
    await prisma.studentElectiveChoice.create({
      data: { studentId: student.id, subjectId: electiveId },
    });
    created += 1;
  }

  const students = await prisma.student.findMany({
    where: { sectionId: section.id, rollNumber: { in: STUDENTS.map((s) => s.roll) } },
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
        sectionId: section.id,
        classId: section.classId,
        createdOrUpdated: created,
        biologyId: biology.id,
        computerId: computer.id,
        students,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
