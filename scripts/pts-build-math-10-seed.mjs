/**
 * Build Class 10 Mathematics seed JSON from PTS raw export.
 * Downloads equation SVGs into public/pts-equations/ (read-only asset copy).
 * Does NOT call PTS SavePaper.
 */
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";

const BASE = "https://www.paktestsolution.com";
const RAW = path.join(
  process.cwd(),
  "data",
  "lahore-board",
  "10th",
  "mathematics",
  "pts-raw",
);
const OUT = path.join(process.cwd(), "data", "lahore-board", "10th", "mathematics");
const ASSET_DIR = path.join(process.cwd(), "public", "pts-equations");

const hierarchy = JSON.parse(
  fs.readFileSync(path.join(RAW, "hierarchy.json"), "utf8"),
);

function stripHtmlKeepImgs(html) {
  if (!html) return "";
  let s = String(html);
  // normalize img src to local public path if /Equations/
  s = s.replace(
    /src=["'](\/Equations\/[^"']+)["']/gi,
    (_m, p1) => `src="/pts-equations${p1.replace(/^\/Equations/, "")}"`,
  );
  s = s.replace(
    /src=["'](https?:\/\/[^"']*\/Equations\/([^"']+))["']/gi,
    (_m, _full, rest) => `src="/pts-equations/${rest}"`,
  );
  // remove outer <p>
  s = s.replace(/<\/?p[^>]*>/gi, "");
  s = s.replace(/&nbsp;/g, " ");
  s = s.replace(/\r\n/g, " ").replace(/\s+/g, " ").trim();
  // decode a few entities
  s = s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#x([0-9A-Fa-f]+);/g, (_, h) =>
      String.fromCodePoint(parseInt(h, 16)),
    )
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)));
  return s.trim();
}

function optionText(opt) {
  const en = stripHtmlKeepImgs(opt.EmOption || "");
  const ur = stripHtmlKeepImgs(opt.UmOption || "");
  if (en && ur && en !== ur) return `${en} / ${ur}`;
  return en || ur || "";
}

function correctLetter(options) {
  if (!Array.isArray(options)) return null;
  const idx = options.findIndex((o) => o.Answer === true);
  return idx >= 0 ? ["A", "B", "C", "D"][idx] ?? null : null;
}

function topicCodeFromRef(ref, topicName) {
  // TopicRef like "1.1" or maybe empty for review
  if (ref && /^\d+\.\d+$/.test(String(ref).trim())) return String(ref).trim();
  const m = String(topicName || "").match(/(\d+)\.(\d+)/);
  if (m) return `${m[1]}.${m[2]}`;
  const rev = String(topicName || "").match(/REVIEW\s*EXERCISE\s*(\d+)/i);
  if (rev) return `${rev[1]}.R`;
  if (/REVIEW/i.test(topicName || "")) {
    // infer chapter from nearby - handled via chapter map later
    return null;
  }
  return String(ref || "0.0");
}

function chapterNumber(chapterName, chapterId, chapterIdToNum) {
  if (chapterIdToNum.has(chapterId)) return chapterIdToNum.get(chapterId);
  const m = String(chapterName || "").match(/UNIT\s*(\d+)/i);
  return m ? Number(m[1]) : 0;
}

// Build syllabus.json from hierarchy
const chapterIdToNum = new Map();
const chapters = (hierarchy.chapters || []).map((ch, i) => {
  const num =
    Number(String(ch.ChapterName).match(/UNIT\s*(\d+)/i)?.[1]) || i + 1;
  chapterIdToNum.set(ch.ChapterID, num);
  const title = String(ch.ChapterName)
    .replace(/^UNIT\s*\d+\s*:\s*/i, "")
    .trim()
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .replace(/\bAnd\b/g, "and")
    .replace(/\bOf\b/g, "of")
    .replace(/\bIn\b/g, "in")
    .replace(/\bA\b/g, "a");
  const topics = (hierarchy.topics || [])
    .filter((t) => t.ChapterID === ch.ChapterID)
    .map((t) => {
      let id = topicCodeFromRef(t.TopicRef, t.TopicName);
      if (!id || id === "0.0") {
        if (/REVIEW/i.test(t.TopicName)) id = `${num}.R`;
        else id = `${num}.${t.TopicID}`;
      }
      // clean title
      let titleT = String(t.TopicName || "")
        .replace(/^\d+\.\d+\s*/, "")
        .replace(/^E\.X:\s*/i, "Exercise ")
        .trim();
      if (/REVIEW/i.test(t.TopicName)) titleT = `Review Exercise ${num}`;
      return { id, title: titleT || t.TopicName, _topicId: t.TopicID };
    });
  return {
    number: num,
    title,
    topics,
    _chapterId: ch.ChapterID,
  };
});

const syllabus = {
  board: "Lahore",
  class: "10",
  subject: "Mathematics",
  chapters: chapters.map(({ number, title, topics }) => ({
    number,
    title,
    topics: topics.map(({ id, title }) => ({ id, title })),
  })),
};
fs.writeFileSync(path.join(OUT, "syllabus.json"), JSON.stringify(syllabus, null, 2));

const topicIdToCode = new Map();
for (const ch of chapters) {
  for (const t of ch.topics) {
    topicIdToCode.set(t._topicId, { code: t.id, chapter: ch.number });
  }
}

// Collect image paths and download
const imgPaths = new Set();
function collectImgs(html) {
  if (!html) return;
  for (const m of String(html).matchAll(/\/Equations\/([^"'>\s]+)/gi)) {
    imgPaths.add(m[1]);
  }
}

function mapQuestion(raw, type) {
  collectImgs(raw.EnglishQuestionDetails);
  collectImgs(raw.UrduQuestionDetails);
  const opts = raw.MultipleOptions || [];
  for (const o of opts) {
    collectImgs(o.EmOption);
    collectImgs(o.UmOption);
  }
  const meta = topicIdToCode.get(raw.TopicID) || {
    code: String(raw.TopicRef || "0.0"),
    chapter: 0,
  };
  const en = stripHtmlKeepImgs(raw.EnglishQuestionDetails);
  const ur = stripHtmlKeepImgs(raw.UrduQuestionDetails);
  const sortedOpts = [...opts].sort((a, b) => a.OptionID - b.OptionID);
  const q = {
    id: raw.QuestionID,
    chapter: meta.chapter,
    topic_id: meta.code,
    source: raw.QuestionPeriority || undefined,
    type,
    en,
    ur,
  };
  if (type === "mcq") {
    q.optionA = optionText(sortedOpts[0] || {});
    q.optionB = optionText(sortedOpts[1] || {});
    q.optionC = optionText(sortedOpts[2] || {});
    q.optionD = optionText(sortedOpts[3] || {});
    q.correctAnswer = correctLetter(sortedOpts) || undefined;
  }
  return q;
}

const mcqRaw = JSON.parse(fs.readFileSync(path.join(RAW, "mcq-raw.json"), "utf8"));
const shortRaw = JSON.parse(
  fs.readFileSync(path.join(RAW, "short-raw.json"), "utf8"),
);
const longRaw = JSON.parse(fs.readFileSync(path.join(RAW, "long-raw.json"), "utf8"));

const questions = [
  ...mcqRaw.questions.map((q) => mapQuestion(q, "mcq")),
  ...shortRaw.questions.map((q) => mapQuestion(q, "short")),
  ...longRaw.questions.map((q) => mapQuestion(q, "long")),
];

console.log("Collecting", imgPaths.size, "equation assets...");
fs.mkdirSync(ASSET_DIR, { recursive: true });
let downloaded = 0;
let failed = 0;
for (const rel of imgPaths) {
  const dest = path.join(ASSET_DIR, rel);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  if (fs.existsSync(dest) && fs.statSync(dest).size > 0) continue;
  try {
    const res = await fetch(`${BASE}/Equations/${rel}`);
    if (!res.ok) {
      failed++;
      continue;
    }
    const buf = Buffer.from(await res.arrayBuffer());
    fs.writeFileSync(dest, buf);
    downloaded++;
  } catch {
    failed++;
  }
}
console.log({ downloaded, failed, totalAssets: imgPaths.size });

const outFile = {
  board: "Lahore",
  class: "10",
  subject: "Mathematics",
  source: "PTS PTB Class 10 Mathematics (read-only export)",
  total_questions: questions.length,
  counts: {
    mcq: mcqRaw.questions.length,
    short: shortRaw.questions.length,
    long: longRaw.questions.length,
  },
  questions,
};

fs.writeFileSync(path.join(OUT, "all-questions.json"), JSON.stringify(outFile, null, 2));
fs.writeFileSync(
  path.join(OUT, "mcq-questions.json"),
  JSON.stringify(
    { ...outFile, type: "mcq", questions: questions.filter((q) => q.type === "mcq") },
    null,
    2,
  ),
);
fs.writeFileSync(
  path.join(OUT, "short-questions.json"),
  JSON.stringify(
    {
      ...outFile,
      type: "short",
      questions: questions.filter((q) => q.type === "short"),
    },
    null,
    2,
  ),
);
fs.writeFileSync(
  path.join(OUT, "long-questions.json"),
  JSON.stringify(
    {
      ...outFile,
      type: "long",
      questions: questions.filter((q) => q.type === "long"),
    },
    null,
    2,
  ),
);

console.log("Built seeders:", outFile.counts, "total", questions.length);
console.log(
  "sample mcq",
  questions.find((q) => q.type === "mcq"),
);
