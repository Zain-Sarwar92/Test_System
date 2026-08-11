/**
 * Fast media patch/import for a subject folder:
 * - Updates existing externalKey rows when seed text has <img> (or differs)
 * - Creates missing questions in chunks
 *
 * Usage:
 *   npx tsx scripts/patch-import-media-subject.ts 10th biology punjab-textbook:10:biology
 *   npx tsx scripts/patch-import-media-subject.ts 10th general-math punjab-textbook:10:general-math
 *
 * Key modes:
 *   dedicated-bio | dedicated-std | remaining
 */
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { prisma } from "../src/lib/prisma";
import type { QuestionType, Prisma } from "../src/generated/prisma/client";

const classFolder = process.argv[2];
const slug = process.argv[3];
const mode = process.argv[4] || "remaining";

if (!classFolder || !slug) {
  console.error(
    "Usage: npx tsx scripts/patch-import-media-subject.ts <9th|10th|11th|12th> <slug> [dedicated-bio|dedicated-std|remaining]",
  );
  process.exit(1);
}

type Q = {
  id: number;
  chapter: number;
  topic_id: string;
  source?: string;
  type: "short" | "long" | "mcq";
  series?: string;
  field?: string;
  en: string;
  ur?: string;
  optionA?: string;
  optionB?: string;
  optionC?: string;
  optionD?: string;
  correctAnswer?: string;
};

function mapType(type: Q["type"]): QuestionType {
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

function classKeyFromFolder(folder: string) {
  if (folder === "9th") return "9";
  if (folder === "10th") return "10";
  if (folder === "11th") return "11";
  if (folder === "12th") return "12";
  return folder;
}

function externalKeyFor(q: Q, classKey: string): string {
  const keyRoot = "punjab-textbook";
  if (mode === "dedicated-bio") {
    return q.type === "mcq"
      ? `${keyRoot}:${classKey}:${slug}:mcq:${q.id}`
      : q.type === "long" && q.series === "smart-syllabus"
        ? `${keyRoot}:${classKey}:${slug}:long:${q.id}`
        : `${keyRoot}:${classKey}:${slug}:${q.id}`;
  }
  if (mode === "dedicated-std") {
    // chemistry/physics/computer style
    return q.type === "mcq"
      ? `${keyRoot}:${classKey}:${slug}:mcq:${q.id}`
      : `${keyRoot}:${classKey}:${slug}:${q.id}`;
  }
  // remaining / class9 / inter style
  const subType = (q.field || q.type).toLowerCase();
  if (q.field) {
    return `${keyRoot}:${classKey}:${slug}:${subType}:${q.id}`;
  }
  return `${keyRoot}:${classKey}:${slug}:${q.type}:${q.id}`;
}

async function main() {
  const dataDir = path.join(
    process.cwd(),
    "data",
    "lahore-board",
    classFolder,
    slug,
  );
  const syllabus = JSON.parse(
    fs.readFileSync(path.join(dataDir, "syllabus.json"), "utf8"),
  ) as {
    subject: string;
    class: string;
    chapters: Array<{
      number: number;
      title: string;
      topics: Array<{ id: string; title: string }>;
    }>;
  };
  const questionsFile = JSON.parse(
    fs.readFileSync(path.join(dataDir, "all-questions.json"), "utf8"),
  ) as { questions: Q[] };

  const classKey = classKeyFromFolder(classFolder);
  const className = `Class ${classKey}`;
  const boardName = "Punjab Textbook";

  const board = await prisma.board.upsert({
    where: { name: boardName },
    create: { name: boardName },
    update: {},
  });
  const klass = await prisma.class.upsert({
    where: { boardId_name: { boardId: board.id, name: className } },
    create: { boardId: board.id, name: className },
    update: {},
  });
  const subject = await prisma.subject.upsert({
    where: { classId_name: { classId: klass.id, name: syllabus.subject } },
    create: { classId: klass.id, name: syllabus.subject },
    update: {},
  });

  const topicIdByCode = new Map<string, string>();
  for (const ch of syllabus.chapters) {
    const chapter = await prisma.chapter.upsert({
      where: { subjectId_name: { subjectId: subject.id, name: ch.title } },
      create: { subjectId: subject.id, name: ch.title, order: ch.number },
      update: { order: ch.number },
    });
    for (const t of ch.topics) {
      const topic = await prisma.topic.upsert({
        where: { chapterId_name: { chapterId: chapter.id, name: t.title } },
        create: {
          chapterId: chapter.id,
          name: t.title,
          order: topicOrder(t.id),
        },
        update: { order: topicOrder(t.id) },
      });
      topicIdByCode.set(t.id, topic.id);
    }
  }

  const keyPrefix = `punjab-textbook:${classKey}:${slug}:`;
  const existing = await prisma.question.findMany({
    where: { externalKey: { startsWith: keyPrefix } },
    select: { id: true, externalKey: true, text: true },
  });
  const existingByKey = new Map(
    existing
      .filter((r): r is { id: string; externalKey: string; text: string } =>
        Boolean(r.externalKey),
      )
      .map((r) => [r.externalKey, r]),
  );

  let created = 0;
  let updated = 0;
  let skipped = 0;
  let unchanged = 0;
  const toCreate: Prisma.QuestionCreateManyInput[] = [];

  for (const q of questionsFile.questions) {
    const topicId = topicIdByCode.get(q.topic_id);
    if (!topicId || !q.en?.trim()) {
      skipped++;
      continue;
    }
    if (q.type === "mcq") {
      if (!q.optionA || !q.optionB || !q.optionC || !q.optionD || !q.correctAnswer) {
        skipped++;
        continue;
      }
    }

    const type = mapType(q.type);
    const subType = (q.field || type).toUpperCase();
    const externalKey = externalKeyFor(q, classKey);
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
      source: q.source ?? null,
      topicId,
      isActive: true,
      externalKey,
    };

    const ex = existingByKey.get(externalKey);
    if (ex) {
      const needsUpdate =
        ex.text !== payload.text ||
        /<img/i.test(payload.text) ||
        /<img/i.test(payload.optionA || "") ||
        /<img/i.test(payload.optionB || "") ||
        /<img/i.test(payload.optionC || "") ||
        /<img/i.test(payload.optionD || "");
      if (!needsUpdate) {
        unchanged++;
        continue;
      }
      await prisma.question.update({ where: { id: ex.id }, data: payload });
      updated++;
    } else {
      toCreate.push(payload);
    }
  }

  for (let i = 0; i < toCreate.length; i += 200) {
    const chunk = toCreate.slice(i, i + 200);
    const result = await prisma.question.createMany({ data: chunk });
    created += result.count;
  }

  const imgInSeed = questionsFile.questions.filter((q) =>
    /<img/i.test(
      [q.en, q.ur, q.optionA, q.optionB, q.optionC, q.optionD]
        .filter(Boolean)
        .join("\n"),
    ),
  ).length;

  console.log(
    JSON.stringify(
      {
        classFolder,
        slug,
        mode,
        totalSource: questionsFile.questions.length,
        imgInSeed,
        created,
        updated,
        unchanged,
        skipped,
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
  .finally(() => prisma.$disconnect());
