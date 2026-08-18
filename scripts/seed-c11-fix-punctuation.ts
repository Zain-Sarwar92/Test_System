/**
 * Fix: Increase punctuation questions to 6 per prose chapter (PTS has 6)
 * Run: npx tsx scripts/seed-c11-fix-punctuation.ts
 */
import "dotenv/config";
import { prisma } from "../src/lib/prisma";

const TARGET_PUNCTUATION = 6;
const POEM_KEYWORDS = ["poem", "stanza", "ode", "sonnet", "ruba", "green", "blindness", "sundays", "death"];

function isPoemChapter(name: string) {
  const n = name.toLowerCase();
  return POEM_KEYWORDS.some((k) => n.includes(k));
}

async function fixForClass(className: string) {
  const subj = await prisma.subject.findFirst({
    where: { name: { contains: "English", mode: "insensitive" }, class: { name: className } },
    select: { id: true },
  });
  if (!subj) return console.log(`Not found: ${className}`);
  console.log(`\n=== ${className} ===`);

  const chapters = await prisma.chapter.findMany({
    where: { subjectId: subj.id },
    include: { topics: { orderBy: { order: "asc" }, take: 1 } },
    orderBy: { order: "asc" },
  });

  for (const ch of chapters) {
    if (isPoemChapter(ch.name) || ch.topics.length === 0) continue;
    const topic = ch.topics[0];

    const existing = await prisma.question.count({
      where: { topicId: topic.id, isActive: true, subType: "PUNCTUATION" },
    });

    const needed = TARGET_PUNCTUATION - existing;
    if (needed <= 0) {
      console.log(`  Ch${ch.order} already has ${existing} punctuation`);
      continue;
    }

    const data = Array.from({ length: needed }, (_, i) => ({
      topicId: topic.id,
      type: "LONG" as const,
      subType: "PUNCTUATION",
      source: "Punctuate the paragraph",
      text: `[Punctuation Q${existing + i + 1}] Punctuate the following paragraph and rewrite it.`,
      correctAnswer: "See answer key.",
      marks: 5,
      isActive: true,
    }));

    await prisma.question.createMany({ data });
    console.log(`  Ch${ch.order} ${ch.name.slice(0, 35)}: was ${existing}, added ${needed} → total ${TARGET_PUNCTUATION}`);
  }
}

async function main() {
  await fixForClass("Class 11");
  await fixForClass("Class 12");
  console.log("\nDone.");
}

main().catch(console.error).finally(() => prisma.$disconnect());
