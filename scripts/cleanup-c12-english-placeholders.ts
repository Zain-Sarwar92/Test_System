/**
 * Remove Class 12 English placeholder SYNONYM/PUNCTUATION questions.
 * PTS Class 12 uses MEANING (not SYNONYM) and has no punctuation type.
 *
 * Usage: npx tsx scripts/cleanup-c12-english-placeholders.ts
 */
import "dotenv/config";
import { prisma } from "../src/lib/prisma";

async function main() {
  const subj = await prisma.subject.findFirst({
    where: { name: { contains: "English", mode: "insensitive" }, class: { name: "Class 12" } },
    select: { id: true },
  });
  if (!subj) throw new Error("Class 12 English not found");

  for (const subType of ["SYNONYM", "PUNCTUATION"] as const) {
    const deleted = await prisma.question.deleteMany({
      where: {
        subType,
        topic: { chapter: { subjectId: subj.id } },
      },
    });
    console.log(`Deleted ${deleted.count} ${subType} questions`);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
