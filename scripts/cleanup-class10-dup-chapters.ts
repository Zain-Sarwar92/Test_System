/**
 * Remove empty duplicate Class 10 chapters that share an order with a filled chapter.
 * Usage: npx tsx scripts/cleanup-class10-dup-chapters.ts
 */
import "dotenv/config";
import { prisma } from "../src/lib/prisma";

async function main() {
  const subjects = await prisma.subject.findMany({
    where: {
      class: { name: "Class 10", board: { name: "Punjab Textbook" } },
    },
    include: {
      chapters: {
        include: {
          topics: { include: { _count: { select: { questions: true } } } },
        },
      },
    },
  });

  let deleted = 0;
  for (const subject of subjects) {
    const byOrder = new Map<number, typeof subject.chapters>();
    for (const ch of subject.chapters) {
      byOrder.set(ch.order, [...(byOrder.get(ch.order) ?? []), ch]);
    }
    for (const [order, chapters] of byOrder) {
      if (chapters.length < 2) continue;
      const withQs = chapters.filter((ch) =>
        ch.topics.some((t) => t._count.questions > 0),
      );
      const empty = chapters.filter((ch) =>
        ch.topics.every((t) => t._count.questions === 0),
      );
      if (withQs.length === 0 || empty.length === 0) continue;
      for (const ch of empty) {
        await prisma.chapter.delete({ where: { id: ch.id } });
        deleted += 1;
        console.log(`Deleted empty dup: ${subject.name} order=${order} ${ch.name}`);
      }
    }
  }
  console.log(`\nDeleted ${deleted} empty duplicate chapters`);
}

main().finally(() => prisma.$disconnect());
