/**
 * Audit Class 12 English: PTS raw exports vs local DB
 * Usage: npx tsx scripts/audit-pts-vs-local-english-12.ts
 */
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { prisma } from "../src/lib/prisma";

const PTS_TYPES = [
  { key: "COMPREHENSION", file: "mcq-comprehension-raw.json", type: "MCQ" },
  { key: "MEANING", file: "mcq-meaning-raw.json", type: "MCQ" },
  { key: "QA", file: "short-qa-raw.json", type: "SHORT" },
  { key: "POEM_STANZA", file: "long-poem-stanzas-raw.json", type: "LONG" },
] as const;

const rawDir = path.join(process.cwd(), "data", "lahore-board", "12th", "english", "pts-raw");

function getPtsCounts() {
  const hierarchy = JSON.parse(fs.readFileSync(path.join(rawDir, "hierarchy.json"), "utf8")) as {
    chapters: Array<{ ChapterID: number; ChapterName: string }>;
    topics: Array<{ TopicID: number; ChapterID: number }>;
  };
  const out = new Map<number, Record<string, number>>();
  hierarchy.chapters.forEach((_, idx) => out.set(idx + 1, {}));

  for (const t of PTS_TYPES) {
    const fp = path.join(rawDir, t.file);
    if (!fs.existsSync(fp)) continue;
    const raw = JSON.parse(fs.readFileSync(fp, "utf8")) as {
      questions: Array<{ TopicID: number }>;
    };
    const byTopic = new Map<number, number>();
    for (const q of raw.questions || []) {
      byTopic.set(q.TopicID, (byTopic.get(q.TopicID) ?? 0) + 1);
    }
    hierarchy.chapters.forEach((chapter, idx) => {
      const topicIds = new Set(
        hierarchy.topics.filter((tp) => tp.ChapterID === chapter.ChapterID).map((tp) => tp.TopicID),
      );
      let count = 0;
      for (const [tid, n] of byTopic) if (topicIds.has(tid)) count += n;
      out.get(idx + 1)![t.key] = count;
    });
  }

  return {
    counts: out,
    chapters: hierarchy.chapters.map((c, idx) => ({
      ChapterNo: idx + 1,
      ChapterName: c.ChapterName,
    })),
  };
}

async function getLocalCounts() {
  const subject = await prisma.subject.findFirst({
    where: { name: { contains: "English", mode: "insensitive" }, class: { name: "Class 12" } },
    select: { id: true },
  });
  if (!subject) throw new Error("Class 12 English not found");
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
    for (const t of PTS_TYPES) {
      rec[t.key] = rows.find((r) => r.type === t.type && r.subType === t.key)?._count._all ?? 0;
    }
    // Also track wrong types that shouldn't be there
    rec.SYNONYM = rows.find((r) => r.subType === "SYNONYM")?._count._all ?? 0;
    rec.PUNCTUATION = rows.find((r) => r.subType === "PUNCTUATION")?._count._all ?? 0;
    out.set(ch.order, rec);
  }
  return out;
}

function visible(rec: Record<string, number>) {
  return PTS_TYPES.filter((t) => (rec[t.key] ?? 0) > 0).map((t) => t.key);
}

async function main() {
  const [{ counts: pts, chapters }, local] = await Promise.all([
    Promise.resolve(getPtsCounts()),
    getLocalCounts(),
  ]);

  const perfect: string[] = [];
  const typeMismatch: string[] = [];
  const countMismatch: string[] = [];
  const extraTypes: string[] = [];

  for (const ch of chapters) {
    const p = pts.get(ch.ChapterNo) ?? {};
    const l = local.get(ch.ChapterNo) ?? {};
    const pTypes = visible(p);
    const lTypes = visible(l);
    const typesOk =
      pTypes.length === lTypes.length && pTypes.every((v, i) => v === lTypes[i]);
    const diffs = PTS_TYPES.filter((t) => (p[t.key] ?? 0) !== (l[t.key] ?? 0)).map(
      (t) => `${t.key}: PTS ${p[t.key] ?? 0} vs local ${l[t.key] ?? 0}`,
    );
    if ((l.SYNONYM ?? 0) > 0 || (l.PUNCTUATION ?? 0) > 0) {
      extraTypes.push(
        `Ch ${ch.ChapterNo} ${ch.ChapterName}: extra SYNONYM=${l.SYNONYM ?? 0}, PUNCTUATION=${l.PUNCTUATION ?? 0}`,
      );
    }
    if (typesOk && diffs.length === 0 && !(l.SYNONYM || l.PUNCTUATION)) {
      perfect.push(`Ch ${ch.ChapterNo} ${ch.ChapterName}`);
    } else {
      if (!typesOk) {
        typeMismatch.push(
          `Ch ${ch.ChapterNo} ${ch.ChapterName}\n  PTS: ${pTypes.join(", ") || "none"}\n  Local: ${lTypes.join(", ") || "none"}`,
        );
      }
      if (diffs.length) {
        countMismatch.push(`Ch ${ch.ChapterNo} ${ch.ChapterName}\n  ${diffs.join("\n  ")}`);
      }
    }
  }

  console.log("=== PERFECT ===");
  perfect.forEach((x) => console.log(x));
  console.log("\n=== EXTRA WRONG TYPES (SYNONYM/PUNCTUATION placeholders) ===");
  extraTypes.forEach((x) => console.log(x)) || console.log("None");
  console.log("\n=== TYPE MISMATCHES ===");
  typeMismatch.forEach((x) => console.log(x)) || console.log("None");
  console.log("\n=== COUNT MISMATCHES ===");
  countMismatch.forEach((x) => console.log(x)) || console.log("None");
}

main().catch(console.error).finally(() => prisma.$disconnect());
