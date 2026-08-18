import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { prisma } from "../src/lib/prisma";

const RAW_DIR = path.join(
  process.cwd(),
  "data",
  "lahore-board",
  "10th",
  "urdu-compulsory",
  "pts-raw",
);

const FILES = [
  { file: "mcq-raw.json", key: "MCQ", type: "MCQ" },
  { file: "short-qa-raw.json", key: "QA", type: "SHORT" },
  { file: "long-poem-raw.json", key: "POEM", type: "LONG" },
  { file: "long-summary-raw.json", key: "SUMMARY", type: "LONG" },
  { file: "long-passage-raw.json", key: "PASSAGE", type: "LONG" },
] as const;

function getPtsCounts() {
  const hierarchy = JSON.parse(
    fs.readFileSync(path.join(RAW_DIR, "hierarchy.json"), "utf8"),
  ) as {
    chapters: Array<{ ChapterID: number; ChapterName: string }>;
    topics: Array<{ TopicID: number; ChapterID: number }>;
  };
  const out = new Map<number, Record<string, number>>();
  hierarchy.chapters.forEach((_, idx) => out.set(idx + 1, {}));

  for (const f of FILES) {
    const raw = JSON.parse(fs.readFileSync(path.join(RAW_DIR, f.file), "utf8")) as {
      questions: Array<{ TopicID: number }>;
    };
    const byTopic = new Map<number, number>();
    for (const q of raw.questions || []) {
      byTopic.set(q.TopicID, (byTopic.get(q.TopicID) ?? 0) + 1);
    }
    hierarchy.chapters.forEach((chapter, idx) => {
      const topicIds = new Set(
        hierarchy.topics.filter((t) => t.ChapterID === chapter.ChapterID).map((t) => t.TopicID),
      );
      let count = 0;
      for (const [tid, n] of byTopic) if (topicIds.has(tid)) count += n;
      out.get(idx + 1)![f.key] = count;
    });
  }

  return {
    chapters: hierarchy.chapters.map((c, idx) => ({
      number: idx + 1,
      title: c.ChapterName,
    })),
    counts: out,
  };
}

async function getLocalCounts() {
  const subject = await prisma.subject.findFirst({
    where: {
      name: "اُردو لازمی",
      class: { name: "Class 10", board: { name: "Punjab Textbook" } },
    },
    select: { id: true },
  });
  if (!subject) throw new Error("Class 10 Urdu subject not found");
  const chapters = await prisma.chapter.findMany({
    where: { subjectId: subject.id },
    include: { topics: { select: { id: true } } },
    orderBy: { order: "asc" },
  });
  const out = new Map<number, Record<string, number>>();
  for (const ch of chapters) {
    const topicIds = ch.topics.map((t) => t.id);
    const rows = await prisma.question.groupBy({
      by: ["type", "subType"],
      where: { topicId: { in: topicIds }, isActive: true },
      _count: { _all: true },
    });
    const rec: Record<string, number> = {};
    for (const f of FILES) {
      rec[f.key] =
        rows.find((r) => r.type === f.type && r.subType === f.key)?._count._all ?? 0;
    }
    out.set(ch.order, rec);
  }
  return out;
}

function visible(rec: Record<string, number>) {
  return FILES.filter((f) => (rec[f.key] ?? 0) > 0).map((f) => f.key);
}

async function main() {
  const [{ chapters, counts: pts }, local] = await Promise.all([
    Promise.resolve(getPtsCounts()),
    getLocalCounts(),
  ]);

  const perfect: string[] = [];
  const typeMismatch: string[] = [];
  const countMismatch: string[] = [];

  for (const ch of chapters) {
    const p = pts.get(ch.number) ?? {};
    const l = local.get(ch.number) ?? {};
    const pTypes = visible(p);
    const lTypes = visible(l);
    const typeOk =
      pTypes.length === lTypes.length && pTypes.every((v, i) => v === lTypes[i]);
    const diffs = FILES.filter((f) => (p[f.key] ?? 0) !== (l[f.key] ?? 0)).map(
      (f) => `${f.key}: PTS ${p[f.key] ?? 0} vs local ${l[f.key] ?? 0}`,
    );
    if (typeOk && diffs.length === 0) {
      perfect.push(`Ch ${ch.number} ${ch.title}`);
    } else {
      if (!typeOk) {
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
  if (!perfect.length) console.log("None");
  for (const x of perfect) console.log(x);
  console.log("\n=== TYPE MISMATCHES ===");
  if (!typeMismatch.length) console.log("None");
  for (const x of typeMismatch) console.log(x);
  console.log("\n=== COUNT MISMATCHES ===");
  if (!countMismatch.length) console.log("None");
  for (const x of countMismatch) console.log(x);
}

main().catch(console.error).finally(() => prisma.$disconnect());
