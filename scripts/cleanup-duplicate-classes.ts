import "dotenv/config";
import { prisma } from "../src/lib/prisma";

/** Ordinal-style class names that duplicate "Class N" entries. */
const ORDINAL_CLASS_NAMES = ["9th", "10th", "11th", "12th"];

async function main() {
  const duplicates = await prisma.class.findMany({
    where: { name: { in: ORDINAL_CLASS_NAMES } },
    include: {
      board: { select: { name: true } },
      _count: { select: { subjects: true } },
    },
  });

  if (duplicates.length === 0) {
    console.log("No ordinal duplicate classes found.");
    return;
  }

  console.log(
    "Deleting duplicate classes:",
    duplicates.map((c) => `${c.board.name}/${c.name}`),
  );

  // Cascade removes subjects → chapters → topics → questions for these classes.
  const result = await prisma.class.deleteMany({
    where: { name: { in: ORDINAL_CLASS_NAMES } },
  });

  const remaining = await prisma.class.findMany({
    include: { board: { select: { name: true } } },
    orderBy: [{ board: { name: "asc" } }, { name: "asc" }],
  });

  console.log({
    deleted: result.count,
    remainingClasses: remaining.map((c) => `${c.board.name} · ${c.name}`),
  });
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
