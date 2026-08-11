import fs from "node:fs";
import path from "node:path";

const root = path.join(process.cwd(), "data", "lahore-board");
let total = 0;
let withImg = 0;
let withDiagram = 0;
let withEquation = 0;
let withPtsMedia = 0;
const samples: string[] = [];

function scanText(t: string) {
  if (/<img/i.test(t)) withImg += 1;
  if (/Diagrams\//i.test(t) || /\/pts-media\/Diagrams\//i.test(t)) {
    withDiagram += 1;
    if (samples.length < 8) {
      const m = t.match(/src=["'][^"']+/i);
      if (m) samples.push(m[0]);
    }
  }
  if (/Equations\//i.test(t) || /\/pts-media\/equations\//i.test(t)) withEquation += 1;
  if (/\/pts-media\//i.test(t)) withPtsMedia += 1;
}

function walk(dir: string) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      walk(p);
      continue;
    }
    if (e.name !== "all-questions.json") continue;
    let j: { questions?: Array<Record<string, string>> };
    try {
      j = JSON.parse(fs.readFileSync(p, "utf8"));
    } catch {
      continue;
    }
    for (const q of j.questions || []) {
      total += 1;
      const t = [q.en, q.ur, q.optionA, q.optionB, q.optionC, q.optionD]
        .filter(Boolean)
        .join("\n");
      scanText(t);
    }
  }
}

walk(root);
console.log({ total, withImg, withDiagram, withEquation, withPtsMedia, samples });

const mediaRoot = path.join(process.cwd(), "public", "pts-media");
if (!fs.existsSync(mediaRoot)) {
  console.log("public/pts-media: MISSING");
} else {
  const counts: Record<string, number> = {};
  let files = 0;
  function walkMedia(dir: string, top?: string) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walkMedia(p, top || e.name);
      else {
        files += 1;
        const bucket = top || "(root)";
        counts[bucket] = (counts[bucket] || 0) + 1;
      }
    }
  }
  walkMedia(mediaRoot);
  console.log({ mediaFiles: files, byFolder: counts });
}
