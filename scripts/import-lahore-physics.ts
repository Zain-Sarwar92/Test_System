import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { prisma } from "../src/lib/prisma";
import type { Prisma, QuestionType } from "../src/generated/prisma/client";

const CHUNK = 200;

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

export async function importLahorePhysicsQuestionBank(
  dataDir = path.join(process.cwd(), "data", "lahore-board", "10th", "physics"),
) {
  const syllabusPath = path.join(dataDir, "syllabus.json");
  const questionsPath = path.join(dataDir, "all-questions.json");

  if (!fs.existsSync(syllabusPath) || !fs.existsSync(questionsPath)) {
    throw new Error(
      `Physics data not found in ${dataDir}. Expected syllabus.json and all-questions.json`,
    );
  }

  const syllabus = JSON.parse(
    fs.readFileSync(syllabusPath, "utf8"),
  ) as SyllabusFile;
  const questionsFile = JSON.parse(
    fs.readFileSync(questionsPath, "utf8"),
  ) as QuestionsFile;

  const classKey = String(syllabus.class);
  const boardName = "Punjab Textbook";
  const className = `Class ${syllabus.class}`;
  const subjectName = syllabus.subject;
  const keyRoot = "punjab-textbook";

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

  const keyPrefix = `${keyRoot}:${classKey}:physics:`;
  const existing = await prisma.question.findMany({
    where: { externalKey: { startsWith: keyPrefix } },
    select: { id: true, externalKey: true },
  });
  const existingByKey = new Map(
    existing
      .filter((row): row is { id: string; externalKey: string } =>
        Boolean(row.externalKey),
      )
      .map((row) => [row.externalKey, row.id]),
  );

  let created = 0;
  let updated = 0;
  let skipped = 0;
  const toCreate: Prisma.QuestionCreateManyInput[] = [];

  for (const q of questionsFile.questions) {
    const topicId = topicIdByCode.get(q.topic_id);
    if (!topicId) {
      skipped += 1;
      continue;
    }

    const type = mapType(q.type);
    const externalKey =
      q.type === "mcq"
        ? `${keyRoot}:${classKey}:physics:mcq:${q.id}`
        : q.type === "long"
          ? `${keyRoot}:${classKey}:physics:long:${q.id}`
          : `${keyRoot}:${classKey}:physics:short:${q.id}`;

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

    const existingId = existingByKey.get(externalKey);
    if (existingId) {
      await prisma.question.update({ where: { id: existingId }, data: payload });
      updated += 1;
    } else {
      toCreate.push(payload);
      created += 1;
    }
  }

  for (let i = 0; i < toCreate.length; i += CHUNK) {
    await prisma.question.createMany({ data: toCreate.slice(i, i + CHUNK) });
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
  const classFolder = process.argv[2] ?? "10th";
  const dataDir = path.join(
    process.cwd(),
    "data",
    "lahore-board",
    classFolder,
    "physics",
  );
  const result = await importLahorePhysicsQuestionBank(dataDir);
  console.log("Import complete:", result);
}

const isDirectRun = process.argv[1]?.includes("import-lahore-physics");

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
