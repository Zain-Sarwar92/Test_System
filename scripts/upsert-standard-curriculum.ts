import "dotenv/config";
import { prisma } from "../src/lib/prisma";

const CLASS_NAMES = ["Class 9", "Class 10", "Class 11", "Class 12"];
const SUBJECT_NAMES = [
  "Physics",
  "Chemistry",
  "Biology",
  "Mathematics",
  "English",
  "Urdu",
  "Islamiyat",
];

async function ensureStarterChapterAndTopic(subjectId: string, subjectName: string) {
  const chapterName = `1. Introduction to ${subjectName}`;
  const chapter = await prisma.chapter.upsert({
    where: {
      subjectId_name: { subjectId, name: chapterName },
    },
    update: { order: 1 },
    create: {
      subjectId,
      name: chapterName,
      order: 1,
    },
  });

  await prisma.topic.upsert({
    where: {
      chapterId_name: {
        chapterId: chapter.id,
        name: `1.1 Basics of ${subjectName}`,
      },
    },
    update: { order: 1 },
    create: {
      chapterId: chapter.id,
      name: `1.1 Basics of ${subjectName}`,
      order: 1,
    },
  });
}

async function main() {
  const boards = await prisma.board.findMany({
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  let classesProcessed = 0;
  let subjectsProcessed = 0;

  for (const board of boards) {
    for (const className of CLASS_NAMES) {
      const klass = await prisma.class.upsert({
        where: {
          boardId_name: { boardId: board.id, name: className },
        },
        update: {},
        create: { boardId: board.id, name: className },
      });
      classesProcessed += 1;

      for (const subjectName of SUBJECT_NAMES) {
        const subject = await prisma.subject.upsert({
          where: {
            classId_name: { classId: klass.id, name: subjectName },
          },
          update: {},
          create: { classId: klass.id, name: subjectName },
        });
        subjectsProcessed += 1;
        await ensureStarterChapterAndTopic(subject.id, subjectName);
      }
    }
  }

  console.log("Curriculum upsert complete");
  console.log({
    boardsProcessed: boards.length,
    classesProcessed,
    subjectsProcessed,
    subjects: SUBJECT_NAMES,
  });
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
