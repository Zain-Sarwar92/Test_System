import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { prisma } from "../src/lib/prisma";

type PtsQuestion = {
  chapter: number;
  field?: string;
};

const RAW_DIR = path.join(
  process.cwd(),
  "data",
  "lahore-board",
  "9th",
  "urdu-compulsory",
);

const FIELDS = [
  { key: "MCQ", type: "MCQ" },
  { key: "QA", type: "SHORT" },
  { key: "POEM", type: "LONG" },
  { key: "SUMMARY", type: "LONG" },
  { key: "PASSAGE", type: "LONG" },
] as const;

function getPtsCountsByChapter() {
  const all = JSON.parse(
    fs.readFileSync(path.join(RAW_DIR, "all-questions.json"), "utf8"),
  ) as { questions: PtsQuestion[] };
  const syllabus = JSON.parse(
    fs.readFileSync(path.join(RAW_DIR, "syllabus.json"), "utf8"),
  ) as { chapters: Array<{ number: number; title: string }> };

  const out = new Map<number, Record<string, number>>();
  for (const ch of syllabus.chapters) out.set(ch.number, {});
  for (const q of all.questions || []) {
    const rec = out.get(q.chapter) ?? {};
    const field = q.field || "MCQ";
    rec[field] = (rec[field] ?? 0) + 1;
    out.set(q.chapter, rec);
  }
  return { counts: out, chapters: syllabus.chapters };
}

async function getLocalCountsByChapter() {
  const subject = await prisma.subject.findFirst({
    where: {
      name: "اُردو لازمی",
      class: {
        name: "Class 9",
        board: { name: "Punjab Textbook" },
      },
    },
    select: { id: true },
  });
  if (!subject) throw new Error("Local Class 9 Urdu subject not found");

  const chapters = await prisma.chapter.findMany({
    where: { subjectId: subject.id },
    include: { topics: { select: { id: true } } },
    orderBy: { order: "asc" },
  });

  const out = new Map<number, Record<string, number>>();
  for (const chapter of chapters) {
    const topicIds = chapter.topics.map((t) => t.id);
    const rows = await prisma.question.groupBy({
      by: ["type", "subType"],
      where: { topicId: { in: topicIds }, isActive: true },
      _count: { _all: true },
    });
    const rec: Record<string, number> = {};
    for (const f of FIELDS) {
      rec[f.key] =
        rows.find((r) => r.type === f.type && r.subType === f.key)?._count._all ?? 0;
    }
    out.set(chapter.order, rec);
  }
  return out;
}

function visibleTypes(rec: Record<string, number>) {
  return FIELDS.filter((f) => (rec[f.key] ?? 0) > 0).map((f) => f.key);
}

async function main() {
  const [{ counts: pts, chapters }, local] = await Promise.all([
    Promise.resolve(getPtsCountsByChapter()),
    getLocalCountsByChapter(),
  ]);

  const perfect: string[] = [];
  const typeMismatch: string[] = [];
  const countMismatch: string[] = [];

  for (const ch of chapters) {
    const p = pts.get(ch.number) ?? {};
    const l = local.get(ch.number) ?? {};
    const pTypes = visibleTypes(p);
    const lTypes = visibleTypes(l);
    const typesOk =
      pTypes.length === lTypes.length && pTypes.every((v, i) => v === lTypes[i]);
    const diffs = FIELDS.filter((f) => (p[f.key] ?? 0) !== (l[f.key] ?? 0)).map(
      (f) => `${f.key}: PTS ${p[f.key] ?? 0} vs local ${l[f.key] ?? 0}`,
    );

    if (typesOk && diffs.length === 0) {
      perfect.push(`Ch ${ch.number} ${ch.title}`);
    } else {
      if (!typesOk) {
        typeMismatch.push(
          `Ch ${ch.number} ${ch.title}\n  PTS: ${pTypes.join(", ") || "none"}\n  Local: ${lTypes.join(", ") || "none"}`,
        );
      }
      if (diffs.length) {
        countMismatch.push(`Ch ${ch.number} ${ch.title}\n  ${diffs.join("\n  ")}`);
      }
    }
  }

  console.log("=== PERFECT ===");
  if (perfect.length === 0) console.log("None");
  for (const x of perfect) console.log(x);

  console.log("\n=== TYPE MISMATCHES ===");
  if (typeMismatch.length === 0) console.log("None");
  for (const x of typeMismatch) console.log(x);

  console.log("\n=== COUNT MISMATCHES ===");
  if (countMismatch.length === 0) console.log("None");
  for (const x of countMismatch) console.log(x);
}

main().catch(console.error).finally(() => prisma.$disconnect());
