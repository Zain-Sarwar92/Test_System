/**
 * Build Class 10 English seed JSON from PTS raw export.
 * Maps PTS subtypes → bank QuestionType (MCQ|SHORT|LONG) + English field sources.
 * Does NOT call PTS SavePaper.
 */
import fs from "node:fs";
import path from "node:path";

const RAW = path.join(
  process.cwd(),
  "data",
  "lahore-board",
  "10th",
  "english",
  "pts-raw",
);
const OUT = path.join(process.cwd(), "data", "lahore-board", "10th", "english");

const hierarchy = JSON.parse(
  fs.readFileSync(path.join(RAW, "hierarchy.json"), "utf8"),
);

const RAW_FILES = [
  { file: "mcq-comprehension-raw.json", bankType: "mcq", field: "COMPREHENSION" },
  { file: "mcq-spelling-raw.json", bankType: "mcq", field: "SPELLING" },
  { file: "mcq-meaning-raw.json", bankType: "mcq", field: "MEANING" },
  { file: "mcq-verb-raw.json", bankType: "mcq", field: "VERB" },
  { file: "mcq-grammar-raw.json", bankType: "mcq", field: "GRAMMAR" },
  { file: "short-qa-raw.json", bankType: "short", field: "QA" },
  { file: "short-di-raw.json", bankType: "short", field: "DI" },
  { file: "short-pair-raw.json", bankType: "short", field: "PAIR" },
  { file: "long-essays-raw.json", bankType: "long", field: "ESSAYS" },
  { file: "long-summary-raw.json", bankType: "long", field: "SUMMARY" },
  { file: "long-translate-urdu-raw.json", bankType: "long", field: "TRANSLATE_UR" },
  { file: "long-translate-english-raw.json", bankType: "long", field: "TRANSLATE_EN" },
  { file: "long-poem-stanzas-raw.json", bankType: "long", field: "POEM_STANZA" },
];

function stripHtml(html, { keepNewlines = false } = {}) {
  if (!html) return "";
  let s = String(html);
  if (keepNewlines) {
    s = s.replace(/<\/p>/gi, "\n");
    s = s.replace(/<br\s*\/?>/gi, "\n");
  } else {
    s = s.replace(/<\/?p[^>]*>/gi, "");
    s = s.replace(/<br\s*\/?>/gi, " ");
  }
  s = s.replace(/<[^>]+>/g, "");
  s = s.replace(/&nbsp;/g, " ");
  if (keepNewlines) {
    s = s.replace(/\r\n/g, "\n").replace(/[ \t]+/g, " ");
    s = s
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .join("\n");
  } else {
    s = s.replace(/\r\n/g, " ").replace(/\s+/g, " ").trim();
  }
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
    .replace(/\bWith\b/g, "with");
}

/**
 * Map PTS chapters → bank chapter numbers used by existing English syllabus:
 * Units 1–5, Review 1 (6), Units 6–10 → 7–11, Review 2 (12), Tenses (13),
 * Direct & Indirect (14), English B (15).
 */
function chapterNumberFor(ch) {
  const name = String(ch.ChapterName || "").trim();
  const upper = name.toUpperCase();
  if (/^REVIEW\s*1\b/i.test(name)) return 6;
  if (/^REVIEW\s*2\b/i.test(name)) return 12;
  if (/^TENSES?\b/i.test(upper)) return 13;
  if (/^DIRECT/i.test(upper)) return 14;
  if (/^ENGLISH\s*B\b/i.test(upper)) return 15;

  const unit = name.match(/UNIT\s*(\d+)/i);
  if (unit) {
    const n = Number(unit[1]);
    // PTS units 6–10 sit after Review 1 → bank chapters 7–11
    if (n >= 6 && n <= 10) return n + 1;
    return n;
  }
  return 0;
}

function topicCode(chNum, topic, topicIndex) {
  const ref = String(topic.TopicRef || "").trim();
  if (/^\d+(\.\d+)?$/.test(ref) && ref !== ".") {
    if (ref.includes(".")) return ref;
    return `${chNum}.${ref}`;
  }
  // Unit chapters usually have a single content topic
  if (chNum <= 12) return `${chNum}.1`;
  return `${chNum}.${topicIndex + 1}`;
}

function topicTitle(topic) {
  return String(topic.TopicName || "")
    .replace(/^\.\s*/, "")
    .replace(/^\d+(\.\d+)?\s*/, "")
    .trim();
}

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
      if (/past\s*papers/i.test(priorityName || "")) return "Past Papers";
      return "Direct & Indirect";
    case "ESSAYS":
      return "Exercise";
    case "COMPREHENSION":
      return priorityName || "Exercise";
    case "QA":
      return priorityName || "Exercise";
    case "GRAMMAR":
      return "Tick correct according to grammar";
    case "TRANSLATE_UR":
      return "Translate into Urdu";
    case "TRANSLATE_EN":
      return "Translate into English";
    case "POEM_STANZA":
      return "Poem Stanzas";
    default:
      return priorityName || "Exercise";
  }
}

// --- syllabus ---
const chapters = (hierarchy.chapters || []).map((ch) => {
  const number = chapterNumberFor(ch);
  let title = String(ch.ChapterName || "")
    .replace(/^UNIT\s*\d+\s*:\s*/i, "")
    .trim();
  if (number === 6) title = "Review 1";
  else if (number === 12) title = "Review 2";
  else if (number === 13) title = "Tenses";
  else if (number === 14) title = "Direct & Indirect";
  else if (number === 15) title = "English B";
  else title = titleCase(title);

  const topics = (hierarchy.topics || [])
    .filter((t) => t.ChapterID === ch.ChapterID)
    .map((t, ti) => ({
      id: topicCode(number, t, ti),
      title: titleCase(topicTitle(t) || t.TopicName),
      _topicId: t.TopicID,
    }));

  // Deduplicate topic codes within chapter
  const used = new Map();
  for (const t of topics) {
    if (!used.has(t.id)) {
      used.set(t.id, t);
      continue;
    }
    // collision → append sequential index
    let i = 2;
    let alt = `${number}.${String(t.id).split(".")[1] || ti}_${i}`;
    while (used.has(alt)) {
      i += 1;
      alt = `${number}.${String(t.id).split(".")[1] || ti}_${i}`;
    }
    t.id = alt;
    used.set(t.id, t);
  }

  return {
    number,
    title,
    topics: [...used.values()],
    _chapterId: ch.ChapterID,
  };
}).filter((ch) => ch.number > 0);

// Sort by chapter number
chapters.sort((a, b) => a.number - b.number);

const syllabus = {
  board: "Lahore",
  class: "10",
  subject: "English",
  chapters: chapters.map(({ number, title, topics }) => ({
    number,
    title,
    topics: topics.map(({ id, title: t }) => ({ id, title: t })),
  })),
};
fs.writeFileSync(path.join(OUT, "syllabus.json"), JSON.stringify(syllabus, null, 2));

const topicIdToMeta = new Map();
for (const ch of chapters) {
  for (const t of ch.topics) {
    topicIdToMeta.set(t._topicId, { code: t.id, chapter: ch.number });
  }
}

function mapQuestion(raw, bankType, field) {
  const meta = topicIdToMeta.get(raw.TopicID) || {
    code: "0.0",
    chapter: 0,
  };
  const keepNewlines = field === "POEM_STANZA";
  const en = stripHtml(raw.EnglishQuestionDetails, { keepNewlines });
  const ur = stripHtml(raw.UrduQuestionDetails, { keepNewlines });
  const sortedOpts = [...(raw.MultipleOptions || [])].sort(
    (a, b) => a.OptionID - b.OptionID,
  );
  const priorityName = raw.QuestionPeriority || "";

  // Translate-into-English stems are Urdu-only in PTS.
  let textEn = en;
  let textUr = ur || undefined;
  if (!textEn && field === "TRANSLATE_EN" && ur) {
    textEn = ur;
    textUr = ur;
  }
  if (!textEn && field === "SPELLING") {
    textEn = "Tick the correct spelling.";
  }

  const q = {
    id: raw.QuestionID,
    chapter: meta.chapter,
    topic_id: meta.code,
    source: fieldSource(field, priorityName),
    type: bankType,
    field,
    en: textEn,
    ur: textUr,
  };
  if (bankType === "mcq") {
    q.optionA = optionText(sortedOpts[0] || {});
    q.optionB = optionText(sortedOpts[1] || {});
    q.optionC = optionText(sortedOpts[2] || {});
    q.optionD = optionText(sortedOpts[3] || {});
    const ans = correctLetter(sortedOpts);
    if (ans) q.correctAnswer = ans;
  }
  return q;
}

const questions = [];
const counts = {
  mcq: 0,
  short: 0,
  long: 0,
  byField: {},
};

for (const spec of RAW_FILES) {
  const p = path.join(RAW, spec.file);
  if (!fs.existsSync(p)) {
    console.warn("Missing", spec.file);
    continue;
  }
  const data = JSON.parse(fs.readFileSync(p, "utf8"));
  let n = 0;
  for (const raw of data.questions || []) {
    const q = mapQuestion(raw, spec.bankType, spec.field);
    if (!q.en) continue;
    // MCQs must have options + correct answer
    if (spec.bankType === "mcq") {
      if (!q.optionA || !q.optionB || !q.optionC || !q.optionD) continue;
      if (!q.correctAnswer) {
        console.warn("MCQ without answer skipped", q.id, spec.field);
        continue;
      }
    }
    questions.push(q);
    counts[spec.bankType] += 1;
    counts.byField[spec.field] = (counts.byField[spec.field] || 0) + 1;
    n += 1;
  }
  console.log(`${spec.file}: ${n} → type=${spec.bankType} field=${spec.field}`);
}

const outFile = {
  board: "Lahore",
  class: "10",
  subject: "English",
  source: "PTS PTB Class 10 English (read-only export)",
  total_questions: questions.length,
  counts,
  questions,
};

fs.writeFileSync(path.join(OUT, "all-questions.json"), JSON.stringify(outFile, null, 2));
fs.writeFileSync(
  path.join(OUT, "mcq-questions.json"),
  JSON.stringify(
    {
      ...outFile,
      type: "mcq",
      questions: questions.filter((q) => q.type === "mcq"),
    },
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

console.log("Built English seeders:", counts, "total", questions.length);
const sampleMcq = questions.find((q) => q.type === "mcq" && q.correctAnswer);
console.log("sample mcq", sampleMcq);
