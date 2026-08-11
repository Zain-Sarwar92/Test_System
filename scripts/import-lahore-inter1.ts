/**
 * Import all INTER-I (FSc / Intermediate Part 1) Lahore subject seed folders.
 * Stores QuestionType (MCQ|SHORT|LONG) + subType (PTS field).
 * Maps to DB class name "Class 11".
 *
 * Usage: tsx scripts/import-lahore-inter1.ts [slug]
 */
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { prisma } from "../src/lib/prisma";
import type { QuestionType, Prisma } from "../src/generated/prisma/client";

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
  slug?: string;
  chapters: SyllabusChapter[];
};

type SourceQuestion = {
  id: number;
  chapter: number;
  topic_id: string;
  source?: string;
  priority?: string;
  type: "short" | "long" | "mcq";
  field?: string;
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

const CHUNK = 200;
const ROOT = path.join(process.cwd(), "data", "lahore-board", "11th");

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
  if (part === "R") return 99;
  const n = Number(part);
  return Number.isFinite(n) ? n : 0;
}

function slugKey(slug: string) {
  return slug.replace(/[^a-z0-9-]+/gi, "-").toLowerCase();
}

export async function importLahoreInter1Subject(dataDir: string) {
  const syllabusPath = path.join(dataDir, "syllabus.json");
  const questionsPath = path.join(dataDir, "all-questions.json");

  if (!fs.existsSync(syllabusPath) || !fs.existsSync(questionsPath)) {
    throw new Error(
      `Data not found in ${dataDir}. Expected syllabus.json and all-questions.json`,
    );
  }

  const syllabus = JSON.parse(
    fs.readFileSync(syllabusPath, "utf8"),
  ) as SyllabusFile;
  const questionsFile = JSON.parse(
    fs.readFileSync(questionsPath, "utf8"),
  ) as QuestionsFile;

  const classKey = String(syllabus.class);
  // Inter-I bank lives under Punjab Textbook (not Lahore Board).
  const boardName = "Punjab Textbook";
  const className = `Class ${syllabus.class}`;
  const subjectName = syllabus.subject;
  const slug = slugKey(syllabus.slug || path.basename(dataDir));
  const keyPrefix = `punjab-textbook:${classKey}:${slug}:`;

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
  const typeCounts: Record<string, number> = { MCQ: 0, SHORT: 0, LONG: 0 };
  const fieldCounts: Record<string, number> = {};
  const toCreate: Prisma.QuestionCreateManyInput[] = [];

  for (const q of questionsFile.questions) {
    const topicId = topicIdByCode.get(q.topic_id);
    if (!topicId || !q.en?.trim()) {
      skipped += 1;
      continue;
    }

    const type = mapType(q.type);
    const subType = (q.field || type).toUpperCase();
    if (type === "MCQ") {
      if (!q.optionA || !q.optionB || !q.optionC || !q.optionD || !q.correctAnswer) {
        skipped += 1;
        continue;
      }
    }

    const externalKey = `${keyPrefix}${subType.toLowerCase()}:${q.id}`;
    const payload = {
      type,
      subType,
      text: q.en.trim(),
      textUrdu: q.ur?.trim() || null,
      optionA: q.optionA ?? null,
      optionB: q.optionB ?? null,
      optionC: q.optionC ?? null,
      optionD: q.optionD ?? null,
      correctAnswer: q.correctAnswer ?? null,
      marks: defaultMarks(type),
      source: q.source ?? q.priority ?? null,
      topicId,
      isActive: true,
      externalKey,
    };

    typeCounts[type] = (typeCounts[type] || 0) + 1;
    fieldCounts[subType] = (fieldCounts[subType] || 0) + 1;

    const existingId = existingByKey.get(externalKey);
    if (existingId) {
      await prisma.question.update({
        where: { id: existingId },
        data: payload,
      });
      updated += 1;
    } else {
      toCreate.push(payload);
    }
  }

  for (let i = 0; i < toCreate.length; i += CHUNK) {
    const chunk = toCreate.slice(i, i + CHUNK);
    const result = await prisma.question.createMany({ data: chunk });
    created += result.count;
  }

  return {
    board: boardName,
    className,
    subject: subjectName,
    slug,
    chapters: syllabus.chapters.length,
    topics: topicIdByCode.size,
    totalSource: questionsFile.questions.length,
    created,
    updated,
    skipped,
    typeCounts,
    fieldCounts,
  };
}

async function main() {
  const only = process.argv[2] || null;
  const dirs = fs
    .readdirSync(ROOT, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .filter((name) => {
      if (only) return name === only;
      return (
        fs.existsSync(path.join(ROOT, name, "syllabus.json")) &&
        fs.existsSync(path.join(ROOT, name, "all-questions.json"))
      );
    });

  const results = [];
  for (const slug of dirs) {
    const dataDir = path.join(ROOT, slug);
    const result = await importLahoreInter1Subject(dataDir);
    console.log("Imported:", result);
    results.push(result);
  }

  fs.writeFileSync(
    path.join(ROOT, "_import-summary.json"),
    JSON.stringify(results, null, 2),
  );
  const totalQs = results.reduce((a, r) => a + r.created + r.updated, 0);
  console.log(
    `\nImport complete: ${results.length} subjects, ${totalQs} questions written`,
  );
}

const isDirectRun = process.argv[1]?.includes("import-lahore-inter1");

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
