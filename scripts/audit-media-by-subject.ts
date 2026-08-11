import fs from "node:fs";
import path from "node:path";

const root = path.join(process.cwd(), "data", "lahore-board");
const rows: Array<{
  classFolder: string;
  slug: string;
  rawImg: number;
  builtImg: number;
  rawEq: number;
  builtEq: number;
  builtPathPtsMedia: number;
  builtPathPtsEquations: number;
}> = [];

for (const classFolder of ["9th", "10th", "11th", "12th"]) {
  const classDir = path.join(root, classFolder);
  if (!fs.existsSync(classDir)) continue;
  for (const slug of fs.readdirSync(classDir)) {
    const dir = path.join(classDir, slug);
    if (!fs.statSync(dir).isDirectory() || slug.startsWith("_")) continue;
    let rawImg = 0;
    let rawEq = 0;
    const rawDir = path.join(dir, "pts-raw");
    if (fs.existsSync(rawDir)) {
      for (const f of fs.readdirSync(rawDir)) {
        if (!f.endsWith(".json")) continue;
        const t = fs.readFileSync(path.join(rawDir, f), "utf8");
        rawImg += (t.match(/<img\b/gi) || []).length;
        rawEq += (t.match(/Equations\//gi) || []).length;
      }
    }
    const builtPath = path.join(dir, "all-questions.json");
    let builtImg = 0;
    let builtEq = 0;
    let builtPathPtsMedia = 0;
    let builtPathPtsEquations = 0;
    if (fs.existsSync(builtPath)) {
      const t = fs.readFileSync(builtPath, "utf8");
      builtImg = (t.match(/<img\b/gi) || []).length;
      builtEq = (t.match(/Equations\//gi) || []).length;
      builtPathPtsMedia = (t.match(/\/pts-media\//g) || []).length;
      builtPathPtsEquations = (t.match(/\/pts-equations\//g) || []).length;
    }
    if (rawImg || builtImg || rawEq || builtEq) {
      rows.push({
        classFolder,
        slug,
        rawImg,
        builtImg,
        rawEq,
        builtEq,
        builtPathPtsMedia,
        builtPathPtsEquations,
      });
    }
  }
}

rows.sort((a, b) => b.rawImg - b.builtImg - (a.rawImg - a.builtImg));
console.log("class\tslug\trawImg\tbuiltImg\tdelta\tpts-media\tpts-equations");
for (const r of rows) {
  const delta = r.rawImg - r.builtImg;
  if (delta > 0 || r.builtPathPtsEquations > 0)
    console.log(
      `${r.classFolder}\t${r.slug}\t${r.rawImg}\t${r.builtImg}\t${delta}\t${r.builtPathPtsMedia}\t${r.builtPathPtsEquations}`,
    );
}
console.log("\nALL with any media:");
for (const r of rows) {
  console.log(
    `${r.classFolder}\t${r.slug}\t${r.rawImg}\t${r.builtImg}\t${r.rawImg - r.builtImg}\t${r.builtPathPtsMedia}\t${r.builtPathPtsEquations}`,
  );
}
