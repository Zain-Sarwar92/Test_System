import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { prisma } from "../src/lib/prisma";

const PTS_TYPES = [
  { id: 1, key: "COMPREHENSION", label: "Multiple options", type: "MCQ" },
  { id: 4, key: "SYNONYM", label: "Tick correct synonyms", type: "MCQ" },
  { id: 14, key: "QA", label: "Question answers", type: "SHORT" },
  { id: 35, key: "PAIR", label: "Pair of words", type: "SHORT" },
  { id: 43, key: "TRANSLATE_UR", label: "Translate into Urdu paragraphs", type: "LONG" },
  { id: 46, key: "PUNCTUATION", label: "Punctuate the paragraph", type: "LONG" },
  { id: 47, key: "POEM_STANZA", label: "Poem stanzas", type: "LONG" },
  { id: 6, key: "GRAMMAR", label: "Correct form of verb / grammar", type: "MCQ" },
] as const;

async function getPtsCountsByChapter() {
  const rawDir = path.join(process.cwd(), "data", "lahore-board", "11th", "english", "pts-raw");
  const hierarchy = JSON.parse(
    fs.readFileSync(path.join(rawDir, "hierarchy.json"), "utf8"),
  ) as {
    chapters: Array<{ ChapterID: number; ChapterName: string }>;
    topics: Array<{ TopicID: number; ChapterID: number; TopicName: string }>;
  };
  const ChaptersList = hierarchy.chapters;
  const TopicsList = hierarchy.topics;
  const out = new Map<number, Record<string, number>>();
  ChaptersList.forEach((chapter, idx) => out.set(idx + 1, {}));

  for (const t of PTS_TYPES) {
    const filename = {
      COMPREHENSION: "mcq-comprehension-raw.json",
      SYNONYM: "mcq-synonym-raw.json",
      QA: "short-qa-raw.json",
      PAIR: "short-pair-raw.json",
      TRANSLATE_UR: "long-translate-urdu-raw.json",
      PUNCTUATION: "long-punctuation-raw.json",
      POEM_STANZA: "long-poem-stanzas-raw.json",
      GRAMMAR: "mcq-grammar-raw.json",
    }[t.key];
    const filePath = path.join(rawDir, filename);
    if (!fs.existsSync(filePath)) continue;
    const raw = JSON.parse(fs.readFileSync(filePath, "utf8")) as {
      questions: Array<{ TopicID: number; QuestionID: number }>;
    };
    const byTopic = new Map<number, number>();
    for (const q of raw.questions || []) {
      byTopic.set(q.TopicID, (byTopic.get(q.TopicID) ?? 0) + 1);
    }
    ChaptersList.forEach((chapter, idx) => {
      const chapterTopicIds = new Set(
        TopicsList.filter((topic) => topic.ChapterID === chapter.ChapterID).map((topic) => topic.TopicID),
      );
      let count = 0;
      for (const [topicId, n] of byTopic.entries()) {
        if (chapterTopicIds.has(topicId)) count += n;
      }
      out.get(idx + 1)![t.key] = count;
    });
  }
  return {
    counts: out,
    chapters: ChaptersList.map((chapter, idx) => ({
      ChapterNo: idx + 1,
      ChapterName: chapter.ChapterName,
    })),
  };
}

async function getLocalCountsByChapter() {
  const subject = await prisma.subject.findFirst({
    where: { name: { contains: "English", mode: "insensitive" }, class: { name: "Class 11" } },
    select: { id: true },
  });
  if (!subject) throw new Error("Local Class 11 English subject not found");
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
    for (const t of PTS_TYPES) {
      rec[t.key] =
        rows.find((r) => r.type === t.type && r.subType === t.key)?._count._all ?? 0;
    }
    out.set(chapter.order, rec);
  }
  return out;
}

function visibleTypes(rec: Record<string, number>) {
  return PTS_TYPES.filter((t) => (rec[t.key] ?? 0) > 0).map((t) => t.key);
}

async function main() {
  const [{ counts: ptsCounts, chapters }, localCounts] = await Promise.all([
    getPtsCountsByChapter(),
    getLocalCountsByChapter(),
  ]);

  const mismatches: Array<string> = [];
  const typeMismatches: Array<string> = [];
  const perfect: Array<string> = [];

  for (const ch of chapters) {
    const pts = ptsCounts.get(ch.ChapterNo) ?? {};
    const local = localCounts.get(ch.ChapterNo) ?? {};
    const ptsTypes = visibleTypes(pts);
    const localTypes = visibleTypes(local);
    const typeMatch =
      ptsTypes.length === localTypes.length &&
      ptsTypes.every((value, idx) => value === localTypes[idx]);

    const countDiffs = PTS_TYPES.filter((t) => (pts[t.key] ?? 0) !== (local[t.key] ?? 0)).map(
      (t) => `${t.key}: PTS ${pts[t.key] ?? 0} vs local ${local[t.key] ?? 0}`,
    );

    if (typeMatch && countDiffs.length === 0) {
      perfect.push(`Ch ${ch.ChapterNo} ${ch.ChapterName}`);
    } else {
      if (!typeMatch) {
        typeMismatches.push(
          `Ch ${ch.ChapterNo} ${ch.ChapterName}\n  PTS types: ${ptsTypes.join(", ") || "none"}\n  Local types: ${localTypes.join(", ") || "none"}`,
        );
      }
      if (countDiffs.length > 0) {
        mismatches.push(`Ch ${ch.ChapterNo} ${ch.ChapterName}\n  ${countDiffs.join("\n  ")}`);
      }
    }
  }

  console.log("=== PERFECT MATCH CHAPTERS ===");
  for (const line of perfect) console.log(line);

  console.log("\n=== TYPE MISMATCHES ===");
  if (typeMismatches.length === 0) console.log("None");
  for (const line of typeMismatches) console.log(line);

  console.log("\n=== COUNT MISMATCHES ===");
  if (mismatches.length === 0) console.log("None");
  for (const line of mismatches) console.log(line);
}

main().catch(console.error).finally(() => prisma.$disconnect());
