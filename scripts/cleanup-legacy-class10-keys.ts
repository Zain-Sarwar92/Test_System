/**
 * Remove legacy Class 10 core question keys that used classKey "10th"
 * after re-import with classKey "10". Keeps new media-enabled rows.
 */
import "dotenv/config";
import { prisma } from "../src/lib/prisma";

const LEGACY_PREFIXES = [
  "punjab-textbook:10th:biology:",
  "punjab-textbook:10th:computer:",
  "punjab-textbook:10th:chemistry:",
  "punjab-textbook:10th:physics:",
  "lahore:10th:biology:",
  "lahore:10th:computer:",
  "lahore:10th:chemistry:",
  "lahore:10th:physics:",
  "lahore:10:biology:",
  "lahore:10:computer:",
  "lahore:10:chemistry:",
  "lahore:10:physics:",
];

async function main() {
  for (const prefix of LEGACY_PREFIXES) {
    const count = await prisma.question.count({
      where: { externalKey: { startsWith: prefix } },
    });
    if (!count) {
      console.log(`${prefix} -> 0`);
      continue;
    }
    const result = await prisma.question.deleteMany({
      where: { externalKey: { startsWith: prefix } },
    });
    console.log(`${prefix} -> deleted ${result.count}`);
  }

  // Also report current Class 10 subject question counts
  const board = await prisma.board.findUnique({
    where: { name: "Punjab Textbook" },
  });
  if (!board) return;
  const klass = await prisma.class.findUnique({
    where: { boardId_name: { boardId: board.id, name: "Class 10" } },
    include: { subjects: true },
  });
  console.log("\nClass 10 subject question counts:");
  for (const s of klass?.subjects ?? []) {
    if (
      ![
        "Biology",
        "Computer",
        "Chemistry",
        "Physics",
        "Mathematics",
        "General Science",
        "جنرل ریاضی",
      ].includes(s.name)
    )
      continue;
    const n = await prisma.question.count({
      where: { topic: { chapter: { subjectId: s.id } } },
    });
    const withImg = await prisma.question.count({
      where: {
        topic: { chapter: { subjectId: s.id } },
        text: { contains: "<img", mode: "insensitive" },
      },
    });
    console.log(`${s.name}: total=${n} withImg=${withImg}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
