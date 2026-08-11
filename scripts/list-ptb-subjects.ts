import "dotenv/config";
import { prisma } from "../src/lib/prisma";

async function main() {
  const board = await prisma.board.findUnique({ where: { name: "Punjab Textbook" } });
  if (!board) return;
  for (const name of ["Class 9", "Class 10", "Class 11", "Class 12"]) {
    const klass = await prisma.class.findUnique({
      where: { boardId_name: { boardId: board.id, name } },
      include: { subjects: { select: { name: true }, orderBy: { name: "asc" } } },
    });
    console.log(`\n=== ${name} (${klass?.subjects.length ?? 0}) ===`);
    console.log(klass?.subjects.map((s) => s.name).join(", ") ?? "missing");
  }
}

main().finally(() => prisma.$disconnect());
