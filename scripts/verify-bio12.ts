import "dotenv/config";
import fs from "node:fs";
import { prisma } from "../src/lib/prisma";

async function main() {
  const board = await prisma.board.findUnique({
    where: { name: "Punjab Textbook" },
  });
  if (!board) throw new Error("board missing");
  const klass = await prisma.class.findUnique({
    where: { boardId_name: { boardId: board.id, name: "Class 12" } },
  });
  if (!klass) throw new Error("class missing");
  const subject = await prisma.subject.findUnique({
    where: { classId_name: { classId: klass.id, name: "Biology" } },
  });
  if (!subject) throw new Error("subject missing");

  const dbCount = await prisma.question.count({
    where: { topic: { chapter: { subjectId: subject.id } } },
  });
  const seed = JSON.parse(
    fs.readFileSync(
      "data/lahore-board/12th/biology/all-questions.json",
      "utf8",
    ),
  ) as { questions: Array<{ source?: string; priority?: string; type: string }> };

  const bySource: Record<string, number> = {};
  const byType: Record<string, number> = {};
  for (const q of seed.questions) {
    const s = q.source || q.priority || "(none)";
    bySource[s] = (bySource[s] || 0) + 1;
    byType[q.type] = (byType[q.type] || 0) + 1;
  }

  console.log(
    JSON.stringify(
      {
        dbCount,
        seedCount: seed.questions.length,
        byType,
        bySource,
        match: dbCount === seed.questions.length,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
