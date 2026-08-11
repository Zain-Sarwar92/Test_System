/**
 * Ensures Nursery / Prep / Class 1–8 exist so Primary teachers can be assigned subjects.
 */
import { prisma } from "../src/lib/prisma";

const PRIMARY_CLASSES = [
  "Nursery",
  "Prep",
  "Class 1",
  "Class 2",
  "Class 3",
  "Class 4",
  "Class 5",
  "Class 6",
  "Class 7",
  "Class 8",
];

const PRIMARY_SUBJECTS = [
  "English",
  "Urdu",
  "Mathematics",
  "Science",
  "Islamiyat",
  "Social Studies",
];

async function main() {
  const boards = await prisma.board.findMany({ select: { id: true, name: true } });
  if (boards.length === 0) {
    throw new Error("No boards found. Create boards first.");
  }

  for (const board of boards) {
    for (const className of PRIMARY_CLASSES) {
      const classRow = await prisma.class.upsert({
        where: {
          boardId_name: { boardId: board.id, name: className },
        },
        update: {},
        create: { boardId: board.id, name: className },
      });

      for (const subjectName of PRIMARY_SUBJECTS) {
        await prisma.subject.upsert({
          where: {
            classId_name: { classId: classRow.id, name: subjectName },
          },
          update: {},
          create: { classId: classRow.id, name: subjectName },
        });
      }
    }
    console.log(`Primary curriculum ready for ${board.name}`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
