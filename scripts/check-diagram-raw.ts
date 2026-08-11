import fs from "node:fs";
import path from "node:path";

const root = path.join(process.cwd(), "data", "lahore-board");
let diagramHits = 0;
let imageHits = 0;
let contentHits = 0;
let uploadHits = 0;
const samples: string[] = [];

function walk(dir: string) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      walk(p);
      continue;
    }
    if (!e.name.endsWith(".json") && !e.name.endsWith(".txt")) continue;
    const t = fs.readFileSync(p, "utf8");
    if (/Diagrams\//i.test(t)) {
      diagramHits += 1;
      if (samples.length < 12) {
        const m = t.match(/[^\s"'<>]*Diagrams\/[^\s"'<>]+/i);
        if (m) samples.push(`${p} => ${m[0]}`);
      }
    }
    if (/\/Images\//i.test(t)) imageHits += 1;
    if (/\/Content\//i.test(t)) contentHits += 1;
    if (/UploadImages\//i.test(t)) uploadHits += 1;
  }
}

walk(root);
console.log({ diagramHits, imageHits, contentHits, uploadHits, samples });
