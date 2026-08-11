import fs from "node:fs";
import path from "node:path";
import "dotenv/config";
import { prisma } from "../src/lib/prisma";

const root = path.join(process.cwd(), "data", "lahore-board");
const samples: string[] = [];
let imagesFiles = 0;

function walk(dir: string) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      walk(p);
      continue;
    }
    if (!e.name.endsWith(".json") && !e.name.endsWith(".txt")) continue;
    const t = fs.readFileSync(p, "utf8");
    if (/\/Images\//i.test(t) || /pts-media\/Images\//i.test(t)) {
      imagesFiles += 1;
      if (samples.length < 10) {
        const m = t.match(/[^\s"'<>]*Images\/[^\s"'<>]+/i);
        if (m) samples.push(`${path.relative(process.cwd(), p)} => ${m[0]}`);
      }
    }
  }
}

async function main() {
  walk(root);
  console.log("Files mentioning /Images/:", imagesFiles);
  console.log(samples);

  const textMentions = await prisma.question.count({
    where: {
      OR: [
        { text: { contains: "diagram", mode: "insensitive" } },
        { text: { contains: "figure", mode: "insensitive" } },
        { text: { contains: "labelled", mode: "insensitive" } },
      ],
    },
  });
  console.log("DB questions mentioning diagram/figure/labelled:", textMentions);

  const imgQs = await prisma.question.count({
    where: { text: { contains: "<img", mode: "insensitive" } },
  });
  console.log("DB questions with <img> in text:", imgQs);

  const mediaRoot = path.join(process.cwd(), "public", "pts-media");
  console.log(
    "pts-media folders:",
    fs.existsSync(mediaRoot)
      ? fs.readdirSync(mediaRoot).join(", ")
      : "MISSING",
  );
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
