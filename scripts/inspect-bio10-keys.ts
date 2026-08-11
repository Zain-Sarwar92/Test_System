import "dotenv/config";
import { prisma } from "../src/lib/prisma";

async function main() {
  const board = await prisma.board.findUnique({
    where: { name: "Punjab Textbook" },
  });
  const klass = await prisma.class.findUnique({
    where: { boardId_name: { boardId: board!.id, name: "Class 10" } },
  });
  const subject = await prisma.subject.findUnique({
    where: { classId_name: { classId: klass!.id, name: "Biology" } },
  });

  const samples = await prisma.question.findMany({
    where: { topic: { chapter: { subjectId: subject!.id } } },
    select: { externalKey: true, text: true, createdAt: true },
    orderBy: { createdAt: "asc" },
    take: 8,
  });
  console.log("Oldest samples:");
  for (const s of samples) {
    console.log(s.createdAt.toISOString(), s.externalKey, s.text.slice(0, 60));
  }

  const newest = await prisma.question.findMany({
    where: { topic: { chapter: { subjectId: subject!.id } } },
    select: { externalKey: true, text: true, createdAt: true },
    orderBy: { createdAt: "desc" },
    take: 8,
  });
  console.log("\nNewest samples:");
  for (const s of newest) {
    console.log(s.createdAt.toISOString(), s.externalKey, s.text.slice(0, 60));
  }

  const groups = await prisma.$queryRaw<
    Array<{ prefix: string; count: bigint }>
  >`
    SELECT split_part("externalKey", ':', 1) || ':' ||
           split_part("externalKey", ':', 2) || ':' ||
           split_part("externalKey", ':', 3) AS prefix,
           COUNT(*)::bigint AS count
    FROM question q
    JOIN topic t ON t.id = q."topicId"
    JOIN chapter c ON c.id = t."chapterId"
    WHERE c."subjectId" = ${subject!.id}
    GROUP BY 1
    ORDER BY count DESC
  `;
  console.log("\nKey prefixes:");
  for (const g of groups) console.log(Number(g.count), g.prefix);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
