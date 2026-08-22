/**
 * Build Class 9 seed JSON from PTS raw exports.
 * Downloads equation/diagram assets into public/pts-media/.
 *
 * Usage: node scripts/pts-build-class9-seed.mjs [slug]
 */
import fs from "node:fs";
import path from "node:path";

const BASE = "https://www.paktestsolution.com";
const ROOT = path.join(process.cwd(), "data", "lahore-board", "9th");
const ASSET_DIR = path.join(process.cwd(), "public", "pts-media");
const ONLY = process.argv[2] || null;

function fieldSource(field, priorityName) {
  switch (field) {
    case "SPELLING":
      return "Tick correct spelling";
    case "MEANING":
      return "Correct meaning of underlined word";
    case "VERB":
      return "Correct form of verb";
    case "PAIR":
      return "Pair of Words";
    case "SUMMARY":
      return "Summary";
    case "DI":
      return "Direct & Indirect";
    case "ESSAYS":
      return "Exercise";
    case "COMPREHENSION":
    case "QA":
    case "MCQ":
    case "LONG":
      return priorityName || "Exercise";
    case "GRAMMAR":
      return "Tick correct according to grammar";
    case "TRANSLATE_UR":
      return "Translate into Urdu";
    case "TRANSLATE_EN":
      return "Translate into English";
    case "POEM_STANZA":
    case "POEM":
      return "Poem Stanzas";
    case "AYAT":
      return "Ayat / Quranic text";
    case "HADITH":
      return "Hadith";
    case "PERSONALITY":
      return "Personalities";
    case "PASSAGE":
      return "Passage";
    case "WORD":
      return "Word meaning";
    case "IDIOM":
      return "Idiom completion";
    case "CORRECT":
      return "Sentence correction";
    case "LETTER":
      return "Letter";
    case "APPLICATION":
      return "Application";
    case "STORY":
      return "Story";
    case "DIALOGUE":
      return "Dialogue";
    case "CENTRAL":
      return "Central idea";
    default:
      return priorityName || field || "Exercise";
  }
}

function rewriteMediaSrc(html) {
  if (!html) return "";
  let s = String(html);
  // Equations → /pts-media/equations/...
  s = s.replace(
    /src=["'](\/Equations\/([^"']+))["']/gi,
    (_m, _p1, rest) => `src="/pts-media/equations/${rest}"`,
  );
  s = s.replace(
    /src=["'](https?:\/\/[^"']*\/Equations\/([^"']+))["']/gi,
    (_m, _full, rest) => `src="/pts-media/equations/${rest}"`,
  );
  // Diagrams / Images / Content media
  s = s.replace(
    /src=["'](\/(?:Diagrams|Images|Content|UploadImages)\/([^"']+))["']/gi,
    (_m, p1) => {
      const clean = p1.replace(/^\//, "");
      return `src="/pts-media/${clean}"`;
    },
  );
  s = s.replace(
    /src=["'](https?:\/\/[^"']*\/((?:Diagrams|Images|Content|UploadImages)\/[^"']+))["']/gi,
    (_m, _full, rest) => `src="/pts-media/${rest}"`,
  );
  return s;
}

function stripHtmlKeepMedia(html) {
  if (!html) return "";
  let s = rewriteMediaSrc(html);
  s = s.replace(/<\/?p[^>]*>/gi, "");
  s = s.replace(/<br\s*\/?>/gi, " ");
  // keep img tags
  s = s.replace(/<(?!\/?img\b)[^>]+>/gi, "");
  s = s.replace(/&nbsp;/g, " ");
  s = s.replace(/\r\n/g, " ").replace(/\s+/g, " ").trim();
  s = s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&ldquo;/g, "\u201C")
    .replace(/&rdquo;/g, "\u201D")
    .replace(/&lsquo;/g, "\u2018")
    .replace(/&rsquo;/g, "\u2019")
    .replace(/&#x([0-9A-Fa-f]+);/g, (_, h) =>
      String.fromCodePoint(parseInt(h, 16)),
    )
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)));
  return s.trim();
}

function optionText(opt) {
  const en = stripHtmlKeepMedia(opt?.EmOption || "");
  const ur = stripHtmlKeepMedia(opt?.UmOption || "");
  if (en && ur && en !== ur) return `${en} / ${ur}`;
  return en || ur || "";
}

function correctLetter(options) {
  if (!Array.isArray(options)) return null;
  const idx = options.findIndex((o) => o.Answer === true);
  return idx >= 0 ? ["A", "B", "C", "D"][idx] ?? null : null;
}

function titleCase(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .replace(/\bAnd\b/g, "and")
    .replace(/\bOf\b/g, "of")
    .replace(/\bIn\b/g, "in")
    .replace(/\bFor\b/g, "for")
    .replace(/\bWith\b/g, "with")
    .replace(/\bThe\b/g, "the")
    .replace(/\bTo\b/g, "to")
    .replace(/\bA\b/g, "a");
}

function chapterNumber(chapterName, index) {
  const m = String(chapterName || "").match(
    /(?:CHAP(?:TER)?|UNIT|باب|باب نمبر)\s*(\d+)/i,
  );
  if (m) return Number(m[1]);
  const m2 = String(chapterName || "").match(/^(\d+)\s*[:.\-]/);
  if (m2) return Number(m2[1]);
  return index + 1;
}

function chapterTitle(chapterName) {
  let t = String(chapterName || "")
    .replace(/^(?:CHAP(?:TER)?|UNIT)\s*\d+\s*:\s*/i, "")
    .replace(/^\d+\s*[:.\-]\s*/, "")
    .trim();
  if (/^[\x00-\x7F]+$/.test(t)) return titleCase(t);
  return t;
}

function topicCodeFromRef(ref, topicName, chapterNum, ti) {
  if (ref && /^\d+\.\d+[A-Za-z]?$/.test(String(ref).trim()))
    return String(ref).trim();
  const m = String(topicName || "").match(/(\d+)\.(\d+)/);
  if (m) return `${m[1]}.${m[2]}`;
  if (/REVIEW/i.test(topicName || "")) return `${chapterNum}.R`;
  return `${chapterNum}.${ti + 1}`;
}

const mediaPaths = new Set();

function collectMedia(html) {
  if (!html) return;
  const s = String(html);
  for (const m of s.matchAll(/\/Equations\/([^"'>\s]+)/gi)) {
    mediaPaths.add(`equations/${m[1]}`);
  }
  for (const m of s.matchAll(
    /\/((?:Diagrams|Images|Content|UploadImages)\/[^"'>\s]+)/gi,
  )) {
    mediaPaths.add(m[1].replace(/\\/g, "/"));
  }
}

async function downloadMedia() {
  fs.mkdirSync(ASSET_DIR, { recursive: true });
  let downloaded = 0;
  let skipped = 0;
  let failed = 0;
  for (const rel of mediaPaths) {
    const dest = path.join(ASSET_DIR, rel);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    if (fs.existsSync(dest) && fs.statSync(dest).size > 0) {
      skipped++;
      continue;
    }
    try {
      const urlPath = rel.startsWith("equations/")
        ? `/Equations/${rel.slice("equations/".length)}`
        : `/${rel}`;
      const res = await fetch(`${BASE}${urlPath}`);
      if (!res.ok) {
        failed++;
        continue;
      }
      fs.writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
      downloaded++;
    } catch {
      failed++;
    }
  }
  console.log({
    mediaTotal: mediaPaths.size,
    downloaded,
    skipped,
    failed,
  });
}

function buildOne(slug) {
  const rawDir = path.join(ROOT, slug, "pts-raw");
  const outDir = path.join(ROOT, slug);
  const hierarchyPath = path.join(rawDir, "hierarchy.json");
  if (!fs.existsSync(hierarchyPath)) {
    console.warn(`Skip ${slug}: no hierarchy.json`);
    return null;
  }

  const hierarchy = JSON.parse(fs.readFileSync(hierarchyPath, "utf8"));
  const subjectName = hierarchy.subject?.SubjectName || slug;
  const exportTypes = hierarchy.exportTypes || [];

  const chapters = (hierarchy.chapters || []).map((ch, i) => {
    const num = chapterNumber(ch.ChapterName, i);
    const title = chapterTitle(ch.ChapterName);
    const topics = (hierarchy.topics || [])
      .filter((t) => t.ChapterID === ch.ChapterID)
      .map((t, ti) => {
        const id = topicCodeFromRef(t.TopicRef, t.TopicName, num, ti);
        let titleT = String(t.TopicName || "")
          .replace(/^\d+\.\d+\s*/, "")
          .replace(/^E\.X:\s*/i, "Exercise ")
          .trim();
        if (/REVIEW/i.test(t.TopicName || "")) titleT = `Review Exercise ${num}`;
        if (/^[\x00-\x7F]+$/.test(titleT)) titleT = titleCase(titleT);
        return { id, title: titleT || t.TopicName, _topicId: t.TopicID };
      });
    return { number: num, title, topics, _chapterId: ch.ChapterID };
  });

  const syllabus = {
    board: "Lahore",
    class: "9",
    subject: subjectName,
    slug,
    chapters: chapters.map(({ number, title, topics }) => ({
      number,
      title,
      topics: topics.map(({ id, title: t }) => ({ id, title: t })),
    })),
  };
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(
    path.join(outDir, "syllabus.json"),
    JSON.stringify(syllabus, null, 2),
  );

  const topicIdToCode = new Map();
  for (const ch of chapters) {
    for (const t of ch.topics) {
      topicIdToCode.set(t._topicId, { code: t.id, chapter: ch.number });
    }
  }

  function mapQuestion(raw, bankType, field) {
    collectMedia(raw.EnglishQuestionDetails);
    collectMedia(raw.UrduQuestionDetails);
    for (const o of raw.MultipleOptions || []) {
      collectMedia(o.EmOption);
      collectMedia(o.UmOption);
    }
    const meta = topicIdToCode.get(raw.TopicID) || {
      code: String(raw.TopicRef || "0.0"),
      chapter: 0,
    };
    const en = stripHtmlKeepMedia(raw.EnglishQuestionDetails);
    const ur = stripHtmlKeepMedia(raw.UrduQuestionDetails);
    const sortedOpts = [...(raw.MultipleOptions || [])].sort(
      (a, b) => a.OptionID - b.OptionID,
    );
    const priority = raw.QuestionPeriority || undefined;
    const q = {
      id: raw.QuestionID,
      chapter: meta.chapter,
      topic_id: meta.code,
      type: bankType,
      field,
      source: fieldSource(field, priority),
      priority,
      en: en || ur,
      ur: ur && ur !== en ? ur : undefined,
    };
    if (bankType === "mcq") {
      q.optionA = optionText(sortedOpts[0] || {});
      q.optionB = optionText(sortedOpts[1] || {});
      q.optionC = optionText(sortedOpts[2] || {});
      q.optionD = optionText(sortedOpts[3] || {});
      q.correctAnswer = correctLetter(sortedOpts) || undefined;
    }
    return q;
  }

  const questions = [];
  const counts = { mcq: 0, short: 0, long: 0 };
  const fieldCounts = {};

  const files =
    exportTypes.length > 0
      ? exportTypes.map((t) => ({
          file: `${t.name}-raw.json`,
          bankType: t.bankType,
          field: t.field,
        }))
      : ["mcq", "short", "long"].map((n) => ({
          file: `${n}-raw.json`,
          bankType: n,
          field: n.toUpperCase(),
        }));

  for (const f of files) {
    const p = path.join(rawDir, f.file);
    if (!fs.existsSync(p)) continue;
    const raw = JSON.parse(fs.readFileSync(p, "utf8"));
    for (const q of raw.questions || []) {
      const mapped = mapQuestion(q, f.bankType, f.field);
      questions.push(mapped);
      counts[f.bankType] = (counts[f.bankType] || 0) + 1;
      fieldCounts[f.field] = (fieldCounts[f.field] || 0) + 1;
    }
  }

  const outFile = {
    board: "Lahore",
    class: "9",
    subject: subjectName,
    slug,
    source: `PTS PTB Class 9 ${subjectName} (read-only export)`,
    total_questions: questions.length,
    counts,
    fieldCounts,
    questions,
  };

  fs.writeFileSync(
    path.join(outDir, "all-questions.json"),
    JSON.stringify(outFile, null, 2),
  );
  for (const type of ["mcq", "short", "long"]) {
    fs.writeFileSync(
      path.join(outDir, `${type}-questions.json`),
      JSON.stringify(
        {
          ...outFile,
          type,
          questions: questions.filter((q) => q.type === type),
        },
        null,
        2,
      ),
    );
  }

  console.log(
    `Built ${slug}:`,
    counts,
    fieldCounts,
    "total",
    questions.length,
  );
  return {
    slug,
    subject: subjectName,
    counts,
    fieldCounts,
    total: questions.length,
  };
}

const dirs = fs
  .readdirSync(ROOT, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name)
  .filter((name) =>
    fs.existsSync(path.join(ROOT, name, "pts-raw", "hierarchy.json")),
  );

const targets = ONLY ? [ONLY] : dirs;
const summary = [];
for (const slug of targets) {
  const result = buildOne(slug);
  if (result) summary.push(result);
}

console.log("\nDownloading media assets...");
await downloadMedia();

fs.writeFileSync(
  path.join(ROOT, "_build-summary.json"),
  JSON.stringify(summary, null, 2),
);
console.log("\nBuild summary:", summary.length, "subjects");
