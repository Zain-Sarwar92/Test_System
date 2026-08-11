/**
 * Compare local lahore-board seed folders vs Neon PTB subjects/questions.
 */
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { prisma } from "../src/lib/prisma";

const ROOT = path.join(process.cwd(), "data", "lahore-board");

const CLASSES: Array<{ folder: string; className: string }> = [
  { folder: "9th", className: "Class 9" },
  { folder: "10th", className: "Class 10" },
  { folder: "11th", className: "Class 11" },
  { folder: "12th", className: "Class 12" },
];

function listSeedDirs(folder: string) {
  const dir = path.join(ROOT, folder);
  if (!fs.existsSync(dir)) return [] as string[];
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && !d.name.startsWith("_"))
    .map((d) => d.name)
    .sort();
}

function sourceQuestionCount(folder: string, slug: string) {
  const p = path.join(ROOT, folder, slug, "all-questions.json");
  if (!fs.existsSync(p)) return null;
  try {
    const raw = JSON.parse(fs.readFileSync(p, "utf8")) as {
      questions?: unknown[];
    };
    return Array.isArray(raw.questions) ? raw.questions.length : 0;
  } catch {
    return null;
  }
}

async function main() {
  const board = await prisma.board.findUnique({
    where: { name: "Punjab Textbook" },
  });
  if (!board) {
    console.log("No Punjab Textbook board");
    return;
  }

  let zeroQuestionSubjects = 0;

  for (const { folder, className } of CLASSES) {
    const seeds = listSeedDirs(folder);
    const klass = await prisma.class.findUnique({
      where: { boardId_name: { boardId: board.id, name: className } },
      include: {
        subjects: {
          include: {
            chapters: {
              include: { _count: { select: { topics: true } } },
            },
            _count: { select: { chapters: true } },
          },
          orderBy: { name: "asc" },
        },
      },
    });

    console.log(`\n=== ${className} ===`);
    console.log(`Seed folders: ${seeds.length}`);
    console.log(`DB subjects: ${klass?.subjects.length ?? 0}`);

    for (const s of klass?.subjects ?? []) {
      const qCount = await prisma.question.count({
        where: { topic: { chapter: { subjectId: s.id } } },
      });
      console.log(
        `  DB  ${s.name}: questions=${qCount}, chapters=${s._count.chapters}`,
      );
      if (qCount === 0) zeroQuestionSubjects += 1;
    }

    for (const slug of seeds) {
      const src = sourceQuestionCount(folder, slug);
      if (src === null) {
        console.log(`  SRC ${slug}: (no all-questions.json — dedicated importer)`);
      } else {
        console.log(`  SRC ${slug}: ${src} in all-questions.json`);
      }
    }

    if ((klass?.subjects.length ?? 0) < seeds.length) {
      console.log(
        `  !! Possible missing subjects: DB ${klass?.subjects.length ?? 0} < seeds ${seeds.length}`,
      );
    }
  }

  const totalQ = await prisma.question.count();
  console.log(`\nTotal questions in DB: ${totalQ}`);
  console.log(`zeroQuestionSubjects=${zeroQuestionSubjects}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
