import "dotenv/config";
import { prisma } from "../src/lib/prisma";

async function main() {
  const board = await prisma.board.findUnique({
    where: { name: "Punjab Textbook" },
    include: {
      classes: {
        orderBy: { name: "asc" },
        include: { _count: { select: { subjects: true } } },
      },
    },
  });
  if (!board) {
    console.log("No Punjab Textbook board");
    return;
  }
  for (const c of board.classes) {
    console.log(`${c.name}: ${c._count.subjects} subjects`);
  }
  const q = await prisma.question.count();
  console.log(`Total questions: ${q}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
