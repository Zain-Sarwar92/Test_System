/**
 * For Class 10 core subjects re-exported from PTS, delete legacy parser rows
 * whose externalKeys are not in the new all-questions.json key set.
 */
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { prisma } from "../src/lib/prisma";

const SUBJECTS: Array<{
  slug: string;
  name: string;
  mode: "dedicated-bio" | "dedicated-std";
}> = [
  { slug: "biology", name: "Biology", mode: "dedicated-bio" },
  { slug: "computer", name: "Computer", mode: "dedicated-std" },
  { slug: "chemistry", name: "Chemistry", mode: "dedicated-std" },
  { slug: "physics", name: "Physics", mode: "dedicated-std" },
];

type Q = {
  id: number;
  type: "short" | "long" | "mcq";
  series?: string;
};

function keyFor(slug: string, mode: string, q: Q) {
  const base = `punjab-textbook:10:${slug}`;
  if (mode === "dedicated-bio") {
    return q.type === "mcq"
      ? `${base}:mcq:${q.id}`
      : q.type === "long" && q.series === "smart-syllabus"
        ? `${base}:long:${q.id}`
        : `${base}:${q.id}`;
  }
  return q.type === "mcq" ? `${base}:mcq:${q.id}` : `${base}:${q.id}`;
}

async function main() {
  const board = await prisma.board.findUnique({
    where: { name: "Punjab Textbook" },
  });
  if (!board) throw new Error("board missing");
  const klass = await prisma.class.findUnique({
    where: { boardId_name: { boardId: board.id, name: "Class 10" } },
  });
  if (!klass) throw new Error("class missing");

  for (const s of SUBJECTS) {
    const seedPath = path.join(
      process.cwd(),
      "data",
      "lahore-board",
      "10th",
      s.slug,
      "all-questions.json",
    );
    const seed = JSON.parse(fs.readFileSync(seedPath, "utf8")) as {
      questions: Q[];
    };
    const keep = new Set(seed.questions.map((q) => keyFor(s.slug, s.mode, q)));

    const subject = await prisma.subject.findUnique({
      where: { classId_name: { classId: klass.id, name: s.name } },
    });
    if (!subject) {
      console.log(`skip missing subject ${s.name}`);
      continue;
    }

    const rows = await prisma.question.findMany({
      where: { topic: { chapter: { subjectId: subject.id } } },
      select: { id: true, externalKey: true },
    });

    const toDelete = rows
      .filter((r) => !r.externalKey || !keep.has(r.externalKey))
      .map((r) => r.id);

    console.log(
      `${s.name}: total=${rows.length} keep=${keep.size} delete=${toDelete.length}`,
    );

    for (let i = 0; i < toDelete.length; i += 500) {
      const chunk = toDelete.slice(i, i + 500);
      await prisma.question.deleteMany({ where: { id: { in: chunk } } });
    }

    const after = await prisma.question.count({
      where: { topic: { chapter: { subjectId: subject.id } } },
    });
    const withImg = await prisma.question.count({
      where: {
        topic: { chapter: { subjectId: subject.id } },
        OR: [
          { text: { contains: "<img", mode: "insensitive" } },
          { optionA: { contains: "<img", mode: "insensitive" } },
          { optionB: { contains: "<img", mode: "insensitive" } },
          { optionC: { contains: "<img", mode: "insensitive" } },
          { optionD: { contains: "<img", mode: "insensitive" } },
        ],
      },
    });
    console.log(`  after: total=${after} withImg=${withImg}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
