/**
 * Seed script: Add SYNONYM (MCQ) and PUNCTUATION (LONG) questions
 * to Class 11 & 12 English prose chapters (not poem chapters).
 *
 * These question types exist on PTS but were missing from our import.
 * We seed placeholder questions so teachers can select them when generating papers.
 *
 * Run: npx tsx scripts/seed-c11-missing-types.ts
 */
import "dotenv/config";
import { prisma } from "../src/lib/prisma";

// PTS approximate counts per prose chapter for Class 11
// Based on PTS data: ~15 synonym MCQs and ~3 punctuation LONG per chapter
const SYNONYM_COUNT_PER_PROSE_CHAPTER = 15;
const PUNCTUATION_COUNT_PER_PROSE_CHAPTER = 3;

// Poem chapters don't have synonym/punctuation in PTS
const POEM_CHAPTER_KEYWORDS = ["poem", "stanza", "ode", "sonnet", "ruba", "green", "blindness", "sundays", "death"];

function isPoemChapter(name: string): boolean {
  const n = name.toLowerCase();
  return POEM_CHAPTER_KEYWORDS.some((k) => n.includes(k));
}

async function seedForSubject(className: string) {
  const subj = await prisma.subject.findFirst({
    where: {
      name: { contains: "English", mode: "insensitive" },
      class: { name: className },
    },
    select: { id: true, name: true },
  });
  if (!subj) { console.log(`Subject not found for ${className}`); return; }
  console.log(`\n=== ${className} English (${subj.id}) ===`);

  const chapters = await prisma.chapter.findMany({
    where: { subjectId: subj.id },
    include: { topics: { orderBy: { order: "asc" }, take: 1 } },
    orderBy: { order: "asc" },
  });

  let totalSynonym = 0;
  let totalPunct = 0;

  for (const ch of chapters) {
    if (isPoemChapter(ch.name)) {
      console.log(`  Skipping poem chapter: ${ch.name}`);
      continue;
    }
    if (ch.topics.length === 0) {
      console.log(`  Skipping chapter with no topics: ${ch.name}`);
      continue;
    }

    const topic = ch.topics[0];

    // Check existing counts
    const existing = await prisma.question.groupBy({
      by: ["subType"],
      where: { topicId: topic.id, isActive: true, subType: { in: ["SYNONYM", "PUNCTUATION"] } },
      _count: { _all: true },
    });
    const existSynonym = existing.find((r) => r.subType === "SYNONYM")?._count._all ?? 0;
    const existPunct = existing.find((r) => r.subType === "PUNCTUATION")?._count._all ?? 0;

    // Seed SYNONYM (MCQ) questions
    const synonymNeeded = SYNONYM_COUNT_PER_PROSE_CHAPTER - existSynonym;
    if (synonymNeeded > 0) {
      const synonymData = Array.from({ length: synonymNeeded }, (_, i) => ({
        topicId: topic.id,
        type: "MCQ" as const,
        subType: "SYNONYM",
        source: "Tick cross synonyms",
        text: `[Synonym Q${i + 1}] Tick the correct synonym / antonym of the underlined word.`,
        optionA: "Option A",
        optionB: "Option B",
        optionC: "Option C",
        optionD: "Option D",
        correctAnswer: "A",
        marks: 1,
        isActive: true,
      }));
      await prisma.question.createMany({ data: synonymData });
      totalSynonym += synonymNeeded;
      console.log(`  Ch${ch.order} ${ch.name.slice(0, 35)}: +${synonymNeeded} SYNONYM`);
    }

    // Seed PUNCTUATION (LONG) questions
    const punctNeeded = PUNCTUATION_COUNT_PER_PROSE_CHAPTER - existPunct;
    if (punctNeeded > 0) {
      const punctData = Array.from({ length: punctNeeded }, (_, i) => ({
        topicId: topic.id,
        type: "LONG" as const,
        subType: "PUNCTUATION",
        source: "Punctuate the paragraph",
        text: `[Punctuation Q${i + 1}] Punctuate the following paragraph and rewrite it.`,
        correctAnswer: "See answer key.",
        marks: 5,
        isActive: true,
      }));
      await prisma.question.createMany({ data: punctData });
      totalPunct += punctNeeded;
      console.log(`  Ch${ch.order} ${ch.name.slice(0, 35)}: +${punctNeeded} PUNCTUATION`);
    }
  }

  console.log(`  Done: +${totalSynonym} SYNONYM, +${totalPunct} PUNCTUATION`);
}

async function main() {
  await seedForSubject("Class 11");
  await seedForSubject("Class 12");
  console.log("\nSeeding complete.");
}

main().catch(console.error).finally(() => prisma.$disconnect());
