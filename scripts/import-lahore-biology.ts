import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { prisma } from "../src/lib/prisma";
import type { QuestionType } from "../src/generated/prisma/client";

type SyllabusTopic = { id: string; title: string };
type SyllabusChapter = {
  number: number;
  title: string;
  topics: SyllabusTopic[];
};
type SyllabusFile = {
  board: string;
  class: string;
  subject: string;
  chapters: SyllabusChapter[];
};

type SourceQuestion = {
  id: number;
  chapter: number;
  topic_id: string;
  source?: string;
  type: "short" | "long" | "mcq";
  /** Smart-syllabus long bank uses typed external keys to avoid id clashes */
  series?: "smart-syllabus";
  en: string;
  ur?: string;
  optionA?: string;
  optionB?: string;
  optionC?: string;
  optionD?: string;
  correctAnswer?: string;
};

type QuestionsFile = {
  questions: SourceQuestion[];
};

function mapType(type: SourceQuestion["type"]): QuestionType {
  if (type === "long") return "LONG";
  if (type === "mcq") return "MCQ";
  return "SHORT";
}

function defaultMarks(type: QuestionType) {
  if (type === "LONG") return 5;
  if (type === "MCQ") return 1;
  return 2;
}

function topicOrder(topicId: string) {
  const part = topicId.split(".")[1];
  const n = Number(part);
  return Number.isFinite(n) ? n : 0;
}

export async function importLahoreBiologyQuestionBank(
  dataDir = path.join(process.cwd(), "data", "lahore-board", "9th", "biology"),
) {
  const syllabusPath = path.join(dataDir, "syllabus.json");
  const questionsPath = path.join(dataDir, "all-questions.json");

  if (!fs.existsSync(syllabusPath) || !fs.existsSync(questionsPath)) {
    throw new Error(
      `Biology data not found in ${dataDir}. Expected syllabus.json and all-questions.json`,
    );
  }

  const syllabus = JSON.parse(
    fs.readFileSync(syllabusPath, "utf8"),
  ) as SyllabusFile;
  const questionsFile = JSON.parse(
    fs.readFileSync(questionsPath, "utf8"),
  ) as QuestionsFile;

  const boardName =
    ["9", "9th", "10", "10th"].includes(String(syllabus.class))
      ? "Punjab Textbook"
      : `${syllabus.board} Board`;
  const className = `Class ${syllabus.class}`;
  const subjectName = syllabus.subject;
  const classKey = String(syllabus.class);
  const keyRoot =
    boardName === "Punjab Textbook" ? "punjab-textbook" : "lahore";

  const board = await prisma.board.upsert({
    where: { name: boardName },
    update: {},
    create: { name: boardName },
  });

  const klass = await prisma.class.upsert({
    where: {
      boardId_name: {
        boardId: board.id,
        name: className,
      },
    },
    update: {},
    create: {
      boardId: board.id,
      name: className,
    },
  });

  const subject = await prisma.subject.upsert({
    where: {
      classId_name: {
        classId: klass.id,
        name: subjectName,
      },
    },
    update: {},
    create: {
      classId: klass.id,
      name: subjectName,
    },
  });

  const topicIdByCode = new Map<string, string>();

  for (const chapterData of syllabus.chapters) {
    const chapterName = `${chapterData.number}. ${chapterData.title}`;
    const chapter = await prisma.chapter.upsert({
      where: {
        subjectId_name: {
          subjectId: subject.id,
          name: chapterName,
        },
      },
      update: {
        order: chapterData.number,
      },
      create: {
        subjectId: subject.id,
        name: chapterName,
        order: chapterData.number,
      },
    });

    for (const topicData of chapterData.topics) {
      const topicName = `${topicData.id} ${topicData.title}`;
      const topic = await prisma.topic.upsert({
        where: {
          chapterId_name: {
            chapterId: chapter.id,
            name: topicName,
          },
        },
        update: {
          order: topicOrder(topicData.id),
        },
        create: {
          chapterId: chapter.id,
          name: topicName,
          order: topicOrder(topicData.id),
        },
      });
      topicIdByCode.set(topicData.id, topic.id);
    }
  }

  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const q of questionsFile.questions) {
    const topicId = topicIdByCode.get(q.topic_id);
    if (!topicId) {
      skipped += 1;
      continue;
    }

    const type = mapType(q.type);
    // MCQ + smart-syllabus longs share numeric ids with the short bank
    const externalKey =
      q.type === "mcq"
        ? `${keyRoot}:${classKey}:biology:mcq:${q.id}`
        : q.type === "long" && q.series === "smart-syllabus"
          ? `${keyRoot}:${classKey}:biology:long:${q.id}`
          : `${keyRoot}:${classKey}:biology:${q.id}`;
    const payload = {
      type,
      text: q.en.trim(),
      textUrdu: q.ur?.trim() || null,
      optionA: q.optionA ?? null,
      optionB: q.optionB ?? null,
      optionC: q.optionC ?? null,
      optionD: q.optionD ?? null,
      correctAnswer: q.correctAnswer ?? null,
      marks: defaultMarks(type),
      source: q.source ?? null,
      topicId,
      isActive: true,
      externalKey,
    };

    const existing = await prisma.question.findFirst({
      where: { externalKey },
    });

    if (existing) {
      await prisma.question.update({
        where: { id: existing.id },
        data: payload,
      });
      updated += 1;
    } else {
      await prisma.question.create({ data: payload });
      created += 1;
    }
  }

  return {
    board: boardName,
    className,
    subject: subjectName,
    chapters: syllabus.chapters.length,
    topics: topicIdByCode.size,
    totalSource: questionsFile.questions.length,
    created,
    updated,
    skipped,
  };
}

async function main() {
  const classFolder = process.argv[2] ?? "9th";
  const dataDir = path.join(
    process.cwd(),
    "data",
    "lahore-board",
    classFolder,
    "biology",
  );
  const result = await importLahoreBiologyQuestionBank(dataDir);
  console.log("Import complete:", result);
}

const isDirectRun = process.argv[1]?.includes("import-lahore-biology");

if (isDirectRun) {
  main()
    .catch((error) => {
      console.error(error);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
