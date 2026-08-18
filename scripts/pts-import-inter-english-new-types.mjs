/**
 * Import SYNONYM and PUNCTUATION questions for Class 11 & 12 English
 * from PTS raw export files into our DB.
 *
 * 1. Deletes existing placeholder questions for SYNONYM/PUNCTUATION
 * 2. Maps PTS TopicID → our DB topic via chapter order + topic order matching
 * 3. Inserts real questions
 *
 * Usage: node scripts/pts-import-inter-english-new-types.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "../src/generated/prisma/client/index.js";

const prisma = new PrismaClient();

function rewriteMedia(html) {
  if (!html) return "";
  return String(html)
    .replace(/src="\/images\//g, 'src="/pts-media/')
    .replace(/src='\/images\//g, "src='/pts-media/");
}

function stripHtml(html) {
  return String(html || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

async function importForClass(className, rawDir, ptsSubjectId) {
  console.log(`\n=== ${className} English ===`);

  const subj = await prisma.subject.findFirst({
    where: { name: { contains: "English", mode: "insensitive" }, class: { name: className } },
    select: { id: true },
  });
  if (!subj) { console.log("  Subject not found"); return; }

  // Load our chapters + topics
  const ourChapters = await prisma.chapter.findMany({
    where: { subjectId: subj.id },
    include: { topics: { orderBy: { order: "asc" } } },
    orderBy: { order: "asc" },
  });

  // Load PTS hierarchy to map TopicID → chapter order + topic order
  const hierPath = path.join(rawDir, "hierarchy.json");
  let ptsTopics = [];
  let ptsChapters = [];
  if (fs.existsSync(hierPath)) {
    const hier = JSON.parse(fs.readFileSync(hierPath, "utf8"));
    ptsTopics = hier.topics || [];
    ptsChapters = hier.chapters || [];
  } else {
    console.log("  No hierarchy.json — will skip topic matching");
  }

  // Build map: PTS TopicID → our topic ID
  const topicMap = new Map();
  for (const ptsTopic of ptsTopics) {
    const ptsChapter = ptsChapters.find(c => c.ChapterID === ptsTopic.ChapterID);
    if (!ptsChapter) continue;
    const chNo = ptsChapter.ChapterNo;
    const ourChapter = ourChapters.find(c => c.order === chNo);
    if (!ourChapter) continue;
    // Match by topic order within chapter
    const ptsTopicsInChapter = ptsTopics
      .filter(t => t.ChapterID === ptsTopic.ChapterID)
      .sort((a, b) => (a.TopicNo || 0) - (b.TopicNo || 0));
    const ptsIdx = ptsTopicsInChapter.findIndex(t => t.TopicID === ptsTopic.TopicID);
    const ourTopic = ourChapter.topics[ptsIdx] ?? ourChapter.topics[0];
    if (ourTopic) topicMap.set(ptsTopic.TopicID, ourTopic.id);
  }
  console.log(`  Topic map: ${topicMap.size} PTS topics mapped`);

  // Process each type
  for (const { file, subType, qType, source } of [
    { file: "mcq-synonym-raw.json",     subType: "SYNONYM",     qType: "MCQ",  source: "Tick cross synonyms" },
    { file: "long-punctuation-raw.json", subType: "PUNCTUATION", qType: "LONG", source: "Punctuate the paragraph" },
  ]) {
    const filePath = path.join(rawDir, file);
    if (!fs.existsSync(filePath)) { console.log(`  Missing: ${file}`); continue; }

    const raw = JSON.parse(fs.readFileSync(filePath, "utf8"));
    const questions = raw.questions || [];
    if (questions.length === 0) { console.log(`  ${file}: 0 questions — skipping`); continue; }

    console.log(`\n  ${subType}: ${questions.length} questions from PTS`);

    // Delete existing placeholder questions
    const deleted = await prisma.question.deleteMany({
      where: {
        subType,
        topic: { chapter: { subjectId: subj.id } },
        text: { startsWith: "[" }, // only placeholders
      },
    });
    console.log(`  Deleted ${deleted.count} placeholder questions`);

    // Insert real questions
    let inserted = 0;
    let skipped = 0;

    for (const q of questions) {
      // Get our topic ID
      let ourTopicId = topicMap.get(q.TopicID);

      // Fallback: use chapter+topic from _meta if available
      if (!ourTopicId && q._meta?.chapterNo) {
        const ourChapter = ourChapters.find(c => c.order === q._meta.chapterNo);
        ourTopicId = ourChapter?.topics[0]?.id;
      }

      if (!ourTopicId) { skipped++; continue; }

      const text = rewriteMedia(q.QuestionText || q.Question || "").trim();
      if (!text) { skipped++; continue; }

      const data = {
        topicId: ourTopicId,
        type: qType,
        subType,
        source,
        text,
        textUrdu: q.QuestionTextUrdu ? rewriteMedia(q.QuestionTextUrdu) : null,
        isActive: true,
        marks: qType === "MCQ" ? 1 : 5,
      };

      if (qType === "MCQ") {
        data.optionA = rewriteMedia(q.OptionA || q.Option1 || "");
        data.optionB = rewriteMedia(q.OptionB || q.Option2 || "");
        data.optionC = rewriteMedia(q.OptionC || q.Option3 || "");
        data.optionD = rewriteMedia(q.OptionD || q.Option4 || "");
        data.correctAnswer = q.CorrectAnswer || q.Answer || "";
      } else {
        data.correctAnswer = rewriteMedia(q.Answer || q.CorrectAnswer || "");
      }

      try {
        await prisma.question.create({ data });
        inserted++;
      } catch (e) {
        skipped++;
      }
    }

    console.log(`  Inserted: ${inserted}, Skipped: ${skipped}`);
  }
}

async function main() {
  const base = path.join(process.cwd(), "data", "lahore-board");

  await importForClass(
    "Class 11",
    path.join(base, "11th", "english", "pts-raw"),
    101
  );

  await importForClass(
    "Class 12",
    path.join(base, "12th", "english", "pts-raw"),
    123
  );

  // Verify
  console.log("\n=== Verification ===");
  for (const className of ["Class 11", "Class 12"]) {
    const subj = await prisma.subject.findFirst({
      where: { name: { contains: "English", mode: "insensitive" }, class: { name: className } },
      select: { id: true },
    });
    if (!subj) continue;
    for (const st of ["SYNONYM", "PUNCTUATION"]) {
      const count = await prisma.question.count({
        where: { subType: st, topic: { chapter: { subjectId: subj.id } }, isActive: true },
      });
      console.log(`  ${className} ${st}: ${count} questions`);
    }
  }

  console.log("\nDone.");
}

main().catch(console.error).finally(() => prisma.$disconnect());
