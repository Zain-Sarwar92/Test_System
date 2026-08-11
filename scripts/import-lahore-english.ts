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

type EnglishField =
  | "COMPREHENSION"
  | "SPELLING"
  | "MEANING"
  | "VERB"
  | "GRAMMAR"
  | "QA"
  | "DI"
  | "PAIR"
  | "ESSAYS"
  | "SUMMARY";

type SourceQuestion = {
  id: number;
  chapter: number;
  topic_id: string;
  source?: string;
  type: "short" | "long" | "mcq";
  field?: EnglishField | string;
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

function inferField(q: SourceQuestion): string {
  if (q.field) return String(q.field).toUpperCase();
  const sourceLower = (q.source ?? "").toLowerCase();
  if (sourceLower.includes("spelling")) return "SPELLING";
  if (sourceLower.includes("meaning")) return "MEANING";
  if (sourceLower.includes("form of verb")) return "VERB";
  if (sourceLower.includes("pair of words")) return "PAIR";
  if (sourceLower.includes("summary")) return "SUMMARY";
  if (sourceLower.includes("translate into urdu")) return "TRANSLATE_UR";
  if (sourceLower.includes("translate into english")) return "TRANSLATE_EN";
  if (sourceLower.includes("poem stanza")) return "POEM_STANZA";
  if (sourceLower.includes("grammar")) return "GRAMMAR";
  if (
    sourceLower.includes("direct") ||
    (q.type === "short" && String(q.topic_id).startsWith("14."))
  ) {
    return "DI";
  }
  if (q.type === "long" && sourceLower.includes("exercise")) return "ESSAYS";
  if (q.type === "mcq") return "COMPREHENSION";
  if (q.type === "short") return "QA";
  if (q.type === "long") return "ESSAYS";
  return "UNKNOWN";
}

function externalKeyFor(classKey: string, q: SourceQuestion, field: string) {
  const slug = field.toLowerCase();
  return `punjab-textbook:${classKey}:english:${slug}:${q.id}`;
}

export async function importLahoreEnglishQuestionBank(
  dataDir = path.join(
    process.cwd(),
    "data",
    "lahore-board",
    "10th",
    "english",
  ),
) {
  const syllabusPath = path.join(dataDir, "syllabus.json");
  const questionsPath = path.join(dataDir, "all-questions.json");

  if (!fs.existsSync(syllabusPath) || !fs.existsSync(questionsPath)) {
    throw new Error(
      `English data not found in ${dataDir}. Expected syllabus.json and all-questions.json`,
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
  let skippedNoTopic = 0;
  let skippedBadMcq = 0;
  const typeCounts: Record<string, number> = { MCQ: 0, SHORT: 0, LONG: 0 };
  const fieldCounts: Record<string, number> = {};

  for (const q of questionsFile.questions) {
    const topicId = topicIdByCode.get(q.topic_id);
    if (!topicId) {
      skipped += 1;
      skippedNoTopic += 1;
      continue;
    }

    const type = mapType(q.type);
    const field = inferField(q);

    if (type === "MCQ") {
      if (!q.optionA || !q.optionB || !q.optionC || !q.optionD || !q.correctAnswer) {
        skipped += 1;
        skippedBadMcq += 1;
        continue;
      }
    }

    const externalKey = externalKeyFor(classKey, q, field);

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

    typeCounts[type] = (typeCounts[type] || 0) + 1;
    fieldCounts[field] = (fieldCounts[field] || 0) + 1;
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
    skippedNoTopic,
    skippedBadMcq,
    typeCounts,
    fieldCounts,
  };
}

async function main() {
  const classFolder = process.argv[2] ?? "10th";
  const dataDir = path.join(
    process.cwd(),
    "data",
    "lahore-board",
    classFolder,
    "english",
  );
  const result = await importLahoreEnglishQuestionBank(dataDir);
  console.log("Import complete:", result);
}

const isDirectRun = process.argv[1]?.includes("import-lahore-english");

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
