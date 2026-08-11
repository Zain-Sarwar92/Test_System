/**
 * Build seed JSON for all remaining Class 10 subjects exported from PTS.
 * Usage: node scripts/pts-build-remaining-10-seed.mjs [slug]
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = path.join(process.cwd(), "data", "lahore-board", "10th");
const ONLY = process.argv[2] || null;

function stripHtml(html) {
  if (!html) return "";
  let s = String(html);
  // keep equation imgs as local public paths when present
  s = s.replace(
    /src=["'](\/Equations\/[^"']+)["']/gi,
    (_m, p1) => `src="/pts-equations${p1.replace(/^\/Equations/, "")}"`,
  );
  s = s.replace(
    /src=["'](https?:\/\/[^"']*\/Equations\/([^"']+))["']/gi,
    (_m, _full, rest) => `src="/pts-equations/${rest}"`,
  );
  s = s.replace(/<\/?p[^>]*>/gi, "");
  s = s.replace(/<br\s*\/?>/gi, " ");
  // strip remaining tags except img
  s = s.replace(/<(?!img\b)[^>]+>/gi, "");
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
  const en = stripHtml(opt?.EmOption || "");
  const ur = stripHtml(opt?.UmOption || "");
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
  // Keep Urdu/Punjabi titles as-is; title-case ASCII-heavy titles
  if (/^[\x00-\x7F]+$/.test(t)) return titleCase(t);
  return t;
}

function topicCodeFromRef(ref, topicName, chapterNum, ti) {
  if (ref && /^\d+\.\d+$/.test(String(ref).trim())) return String(ref).trim();
  const m = String(topicName || "").match(/(\d+)\.(\d+)/);
  if (m) return `${m[1]}.${m[2]}`;
  return `${chapterNum}.${ti + 1}`;
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
          .trim();
        if (/^[\x00-\x7F]+$/.test(titleT)) titleT = titleCase(titleT);
        return { id, title: titleT || t.TopicName, _topicId: t.TopicID };
      });
    return { number: num, title, topics, _chapterId: ch.ChapterID };
  });

  const syllabus = {
    board: "Lahore",
    class: "10",
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

  function mapQuestion(raw, type) {
    const meta = topicIdToCode.get(raw.TopicID) || {
      code: String(raw.TopicRef || "0.0"),
      chapter: 0,
    };
    const en = stripHtml(raw.EnglishQuestionDetails);
    const ur = stripHtml(raw.UrduQuestionDetails);
    const sortedOpts = [...(raw.MultipleOptions || [])].sort(
      (a, b) => a.OptionID - b.OptionID,
    );
    const q = {
      id: raw.QuestionID,
      chapter: meta.chapter,
      topic_id: meta.code,
      source: raw.QuestionPeriority || raw._exportMeta?.exportName || undefined,
      type,
      en: en || ur,
      ur: ur && ur !== en ? ur : undefined,
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

  const questions = [];
  const counts = { mcq: 0, short: 0, long: 0 };
  const files =
    exportTypes.length > 0
      ? exportTypes.map((t) => ({
          file: `${t.name}-raw.json`,
          bankType: t.bankType,
        }))
      : ["mcq", "short", "long"].map((n) => ({
          file: `${n}-raw.json`,
          bankType: n,
        }));

  for (const f of files) {
    const p = path.join(rawDir, f.file);
    if (!fs.existsSync(p)) continue;
    const raw = JSON.parse(fs.readFileSync(p, "utf8"));
    for (const q of raw.questions || []) {
      const type = f.bankType;
      questions.push(mapQuestion(q, type));
      counts[type] = (counts[type] || 0) + 1;
    }
  }

  const outFile = {
    board: "Lahore",
    class: "10",
    subject: subjectName,
    slug,
    source: `PTS PTB Class 10 ${subjectName} (read-only export)`,
    total_questions: questions.length,
    counts,
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
    "total",
    questions.length,
    `(${chapters.length} ch / ${topicIdToCode.size} topics)`,
  );
  return { slug, subject: subjectName, counts, total: questions.length };
}

const dirs = fs
  .readdirSync(ROOT, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name)
  .filter((name) => fs.existsSync(path.join(ROOT, name, "pts-raw", "hierarchy.json")));

const targets = ONLY ? [ONLY] : dirs;
const summary = [];
for (const slug of targets) {
  // skip already-handled primary subjects that use their own pipelines
  if (
    [
      "biology",
      "computer",
      "chemistry",
      "physics",
      "mathematics",
      "english",
      "pakistan-studies",
    ].includes(slug) &&
    !ONLY
  ) {
    continue;
  }
  const result = buildOne(slug);
  if (result) summary.push(result);
}

fs.writeFileSync(
  path.join(ROOT, "_remaining-build-summary.json"),
  JSON.stringify(summary, null, 2),
);
console.log("\nBuild summary:", summary.length, "subjects");
