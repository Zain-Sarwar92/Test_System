import "dotenv/config";
import { prisma } from "../src/lib/prisma";

const BOARDS = ["Sindh Board", "Oxford Board"];
const CLASSES = ["Class 9", "Class 10", "Class 11", "Class 12"];
const SUBJECTS = [
  "English",
  "Urdu",
  "Mathematics",
  "Physics",
  "Chemistry",
  "Biology",
];

async function ensureBoard(name: string) {
  return prisma.board.upsert({
    where: { name },
    update: {},
    create: { name },
  });
}

async function ensureClass(boardId: string, name: string) {
  return prisma.class.upsert({
    where: {
      boardId_name: { boardId, name },
    },
    update: {},
    create: { boardId, name },
  });
}

async function ensureSubject(classId: string, name: string) {
  return prisma.subject.upsert({
    where: {
      classId_name: { classId, name },
    },
    update: {},
    create: { classId, name },
  });
}

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

  const topicName = `1.1 Basics of ${subjectName}`;
  await prisma.topic.upsert({
    where: {
      chapterId_name: { chapterId: chapter.id, name: topicName },
    },
    update: { order: 1 },
    create: {
      chapterId: chapter.id,
      name: topicName,
      order: 1,
    },
  });
}

async function main() {
  let boardsCreated = 0;
  let classesCreated = 0;
  let subjectsCreated = 0;

  for (const boardName of BOARDS) {
    const board = await ensureBoard(boardName);
    boardsCreated += 1;

    for (const className of CLASSES) {
      const klass = await ensureClass(board.id, className);
      classesCreated += 1;

      for (const subjectName of SUBJECTS) {
        const subject = await ensureSubject(klass.id, subjectName);
        subjectsCreated += 1;
        await ensureStarterChapterAndTopic(subject.id, subjectName);
      }
    }
  }

  console.log("Boards/classes/subjects seed complete");
  console.log({
    boards: BOARDS,
    classes: CLASSES,
    subjects: SUBJECTS,
    boardsProcessed: boardsCreated,
    classesProcessed: classesCreated,
    subjectsProcessed: subjectsCreated,
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
