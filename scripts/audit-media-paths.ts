import fs from "node:fs";
import path from "node:path";

const root = path.join(process.cwd(), "data", "lahore-board");

let rawEq = 0;
let rawDiag = 0;
let rawImg = 0;
let builtEq = 0;
let builtDiag = 0;
let builtPtsMedia = 0;
let builtPtsEquations = 0;
let builtImg = 0;
const diagSamples = [];
const pathStyles = {
  ptsMedia: 0,
  ptsEquations: 0,
  absoluteEquations: 0,
  absoluteDiagrams: 0,
};

function scanFile(p, kind) {
  const t = fs.readFileSync(p, "utf8");
  const eq = (t.match(/Equations\//gi) || []).length;
  const diag = (t.match(/Diagrams\//gi) || []).length;
  const img = (t.match(/<img\b/gi) || []).length;
  if (kind === "raw") {
    rawEq += eq;
    rawDiag += diag;
    rawImg += img;
    if (diag && diagSamples.length < 10) {
      const m = t.match(/[^\s"'<>]*Diagrams\/[^\s"'<>]+/i);
      if (m) diagSamples.push(`${p} => ${m[0]}`);
    }
  } else {
    builtEq += eq;
    builtDiag += diag;
    builtImg += img;
    pathStyles.ptsMedia += (t.match(/\/pts-media\//g) || []).length;
    pathStyles.ptsEquations += (t.match(/\/pts-equations\//g) || []).length;
    pathStyles.absoluteEquations += (t.match(/\/Equations\//g) || []).length;
    pathStyles.absoluteDiagrams += (t.match(/\/Diagrams\//g) || []).length;
  }
}

function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      walk(p);
      continue;
    }
    if (e.name === "all-questions.json") scanFile(p, "built");
    else if (e.name.endsWith("-raw.json") || e.name.endsWith("raw.json"))
      scanFile(p, "raw");
  }
}

walk(root);
console.log(
  JSON.stringify(
    {
      raw: { equationsRefs: rawEq, diagramsRefs: rawDiag, imgTags: rawImg },
      builtAllQuestions: {
        equationsRefs: builtEq,
        diagramsRefs: builtDiag,
        imgTags: builtImg,
        pathStyles,
      },
      diagSamples,
    },
    null,
    2,
  ),
);

const media = path.join(process.cwd(), "public");
for (const name of ["pts-media", "pts-equations"]) {
  const d = path.join(media, name);
  if (!fs.existsSync(d)) {
    console.log(`${name}: MISSING`);
    continue;
  }
  let n = 0;
  const walkM = (x) => {
    for (const e of fs.readdirSync(x, { withFileTypes: true })) {
      const p = path.join(x, e.name);
      if (e.isDirectory()) walkM(p);
      else n++;
    }
  };
  walkM(d);
  console.log(`${name}: ${n} files`);
}
