/**
 * Import SYNONYM and PUNCTUATION questions for Class 11 & 12 English
 * from PTS raw export files into our DB.
 *
 * Usage: npx tsx scripts/pts-import-inter-english-new-types.ts
 */
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { prisma } from "../src/lib/prisma";

function rewriteMedia(html: string | null | undefined): string {
  if (!html) return "";
  return String(html)
    .replace(/src="\/images\//g, 'src="/pts-media/')
    .replace(/src='\/images\//g, "src='/pts-media/");
}

interface PtsTopic { TopicID: number; ChapterID: number; TopicNo?: number; TopicName?: string; }
interface PtsChapter { ChapterID: number; ChapterNo: number; ChapterName?: string; }
interface PtsQuestion {
  QuestionID: number;
  TopicID: number;
  TopicName?: string;
  QuestionText?: string;
  Question?: string;
  EnglishQuestionDetails?: string;
  UrduQuestionDetails?: string;
  QuestionTextUrdu?: string;
  OptionA?: string; Option1?: string;
  OptionB?: string; Option2?: string;
  OptionC?: string; Option3?: string;
  OptionD?: string; Option4?: string;
  CorrectAnswer?: string;
  Answer?: string;
  EnglishFillAnswer?: string;
  MultipleOptions?: Array<{ OptionText?: string; IsCorrect?: boolean; UrduOptionText?: string }>;
  _meta?: { chapterNo?: number; chapterName?: string; topicName?: string; field?: string };
}

async function importForClass(className: string, rawDir: string) {
  console.log(`\n=== ${className} English ===`);

  const subj = await prisma.subject.findFirst({
    where: { name: { contains: "English", mode: "insensitive" }, class: { name: className } },
    select: { id: true },
  });
  if (!subj) { console.log("  Subject not found"); return; }

  const ourChapters = await prisma.chapter.findMany({
    where: { subjectId: subj.id },
    include: { topics: { orderBy: { order: "asc" } } },
    orderBy: { order: "asc" },
  });

  // Load PTS hierarchy
  const hierPath = path.join(rawDir, "hierarchy.json");
  let ptsTopics: PtsTopic[] = [];
  let ptsChapters: PtsChapter[] = [];
  if (fs.existsSync(hierPath)) {
    const hier = JSON.parse(fs.readFileSync(hierPath, "utf8"));
    ptsTopics = hier.topics || [];
    ptsChapters = hier.chapters || [];
  }

  // Build TopicID → our topic ID map
  const topicMap = new Map<number, string>();
  for (const ptsTopic of ptsTopics) {
    const ptsChapter = ptsChapters.find(c => c.ChapterID === ptsTopic.ChapterID);
    if (!ptsChapter) continue;
    const ourChapter = ourChapters.find(c => c.order === ptsChapter.ChapterNo);
    if (!ourChapter) continue;
    const ptsTopicsInCh = ptsTopics
      .filter(t => t.ChapterID === ptsTopic.ChapterID)
      .sort((a, b) => (a.TopicNo ?? 0) - (b.TopicNo ?? 0));
    const idx = ptsTopicsInCh.findIndex(t => t.TopicID === ptsTopic.TopicID);
    const ourTopic = ourChapter.topics[idx] ?? ourChapter.topics[0];
    if (ourTopic) topicMap.set(ptsTopic.TopicID, ourTopic.id);
  }
  console.log(`  Topic map: ${topicMap.size} topics mapped`);

  const TYPES = [
    { file: "mcq-synonym-raw.json",      subType: "SYNONYM",     qType: "MCQ" as const,  source: "Tick cross synonyms" },
    { file: "long-punctuation-raw.json", subType: "PUNCTUATION", qType: "LONG" as const, source: "Punctuate the paragraph" },
  ];

  for (const { file, subType, qType, source } of TYPES) {
    const filePath = path.join(rawDir, file);
    if (!fs.existsSync(filePath)) { console.log(`  Missing: ${file}`); continue; }

    const raw = JSON.parse(fs.readFileSync(filePath, "utf8")) as { questions: PtsQuestion[] };
    const questions = raw.questions || [];
    if (questions.length === 0) { console.log(`  ${subType}: 0 questions — skip`); continue; }
    console.log(`\n  ${subType}: ${questions.length} from PTS`);

    // Delete placeholder questions (text starts with "[")
    const deleted = await prisma.question.deleteMany({
      where: {
        subType,
        topic: { chapter: { subjectId: subj.id } },
        text: { startsWith: "[" },
      },
    });
    console.log(`  Deleted ${deleted.count} placeholders`);

    let inserted = 0;
    let skipped = 0;

    for (const q of questions) {
      let topicId = topicMap.get(q.TopicID);

      // Fallback via _meta chapterName matching
      if (!topicId && q._meta?.chapterName) {
        const chName = q._meta.chapterName.toLowerCase();
        // Extract chapter number from name like "UNIT 1: ..." or "UNIT 8: ..."
        const numMatch = chName.match(/unit\s+(\d+)/i) || chName.match(/^(\d+)\./);
        const chNum = numMatch ? parseInt(numMatch[1]) : null;
        let ch;
        if (chNum) {
          ch = ourChapters.find(c => c.order === chNum);
        } else {
          // Try fuzzy name match
          ch = ourChapters.find(c =>
            c.name.toLowerCase().includes(chName.slice(0, 15)) ||
            chName.includes(c.name.toLowerCase().slice(5, 20))
          );
        }
        // Match topic by name
        if (ch && q._meta.topicName) {
          const tName = q._meta.topicName.toLowerCase();
          const t = ch.topics.find(t => t.name.toLowerCase().includes(tName.slice(0, 10)));
          topicId = t?.id ?? ch.topics[0]?.id;
        } else {
          topicId = ch?.topics[0]?.id;
        }
      }

      // Also try by TopicName in PTS
      if (!topicId && q.TopicName) {
        const tName = q.TopicName.toLowerCase();
        for (const ch of ourChapters) {
          const t = ch.topics.find(t => t.name.toLowerCase().includes(tName.slice(0, 10)));
          if (t) { topicId = t.id; break; }
        }
      }

      if (!topicId) { skipped++; continue; }

      // Extract text — PTS uses EnglishQuestionDetails for English text
      const text = rewriteMedia(
        q.EnglishQuestionDetails || q.QuestionText || q.Question || ""
      ).trim();
      if (!text) { skipped++; continue; }

      // Extract options for MCQ
      let optionA = "", optionB = "", optionC = "", optionD = "", correctAnswer = "";
      if (qType === "MCQ" && q.MultipleOptions?.length) {
        const opts = q.MultipleOptions;
        optionA = rewriteMedia(opts[0]?.OptionText);
        optionB = rewriteMedia(opts[1]?.OptionText);
        optionC = rewriteMedia(opts[2]?.OptionText);
        optionD = rewriteMedia(opts[3]?.OptionText);
        const ci = opts.findIndex(o => o.IsCorrect);
        correctAnswer = ci >= 0 ? ["A", "B", "C", "D"][ci] : "A";
      } else if (qType === "MCQ") {
        optionA = rewriteMedia(q.OptionA || q.Option1);
        optionB = rewriteMedia(q.OptionB || q.Option2);
        optionC = rewriteMedia(q.OptionC || q.Option3);
        optionD = rewriteMedia(q.OptionD || q.Option4);
        correctAnswer = q.CorrectAnswer || q.Answer || "A";
      }

      try {
        await prisma.question.create({
          data: {
            topicId,
            type: qType,
            subType,
            source,
            text,
            textUrdu: rewriteMedia(q.UrduQuestionDetails || q.QuestionTextUrdu) || null,
            isActive: true,
            marks: qType === "MCQ" ? 1 : 5,
            ...(qType === "MCQ" ? { optionA, optionB, optionC, optionD, correctAnswer } : {
              correctAnswer: rewriteMedia(q.EnglishFillAnswer || q.Answer || q.CorrectAnswer) || null,
            }),
          },
        });
        inserted++;
      } catch { skipped++; }
    }

    console.log(`  Inserted: ${inserted}, Skipped: ${skipped}`);
  }
}

async function main() {
  const base = path.join(process.cwd(), "data", "lahore-board");

  await importForClass("Class 11", path.join(base, "11th", "english", "pts-raw"));
  await importForClass("Class 12", path.join(base, "12th", "english", "pts-raw"));

  // Verify
  console.log("\n=== Final counts ===");
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
      console.log(`  ${className} ${st}: ${count}`);
    }
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
