/**
 * Wipe Class 10 science questions and re-import from PTS seed.
 * Usage: npx tsx scripts/reimport-class10-science.ts
 */
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { prisma } from "../src/lib/prisma";
import { importLahoreSubjectBank } from "./import-lahore-remaining-10";

const SLUGS = ["biology", "chemistry", "computer", "physics"] as const;
const ROOT = path.join(process.cwd(), "data", "lahore-board", "10th");

async function wipeSubject(subjectName: string) {
  const subject = await prisma.subject.findFirst({
    where: {
      name: subjectName,
      class: { name: "Class 10", board: { name: "Punjab Textbook" } },
    },
    select: { id: true },
  });
  if (!subject) return 0;
  const chapters = await prisma.chapter.findMany({
    where: { subjectId: subject.id },
    include: { topics: { select: { id: true } } },
  });
  const topicIds = chapters.flatMap((c) => c.topics.map((t) => t.id));
  if (topicIds.length === 0) return 0;
  const result = await prisma.question.deleteMany({
    where: { topicId: { in: topicIds } },
  });
  return result.count;
}

async function main() {
  for (const slug of SLUGS) {
    const dataDir = path.join(ROOT, slug);
    const syllabus = JSON.parse(
      fs.readFileSync(path.join(dataDir, "syllabus.json"), "utf8"),
    ) as { subject: string };
    const deleted = await wipeSubject(syllabus.subject);
    console.log(`Wiped ${syllabus.subject}: ${deleted} questions`);
    const result = await importLahoreSubjectBank(dataDir);
    console.log("Imported:", result);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
