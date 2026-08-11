/**
 * Build Class 10 Pakistan Studies seed JSON from PTS raw export.
 * Does NOT call PTS SavePaper.
 */
import fs from "node:fs";
import path from "node:path";

const RAW = path.join(
  process.cwd(),
  "data",
  "lahore-board",
  "10th",
  "pakistan-studies",
  "pts-raw",
);
const OUT = path.join(
  process.cwd(),
  "data",
  "lahore-board",
  "10th",
  "pakistan-studies",
);

const hierarchy = JSON.parse(
  fs.readFileSync(path.join(RAW, "hierarchy.json"), "utf8"),
);

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
    .replace(/\bWith\b/g, "with")
    .replace(/\bThe\b/g, "the")
    .replace(/\bTo\b/g, "to")
    .replace(/\bA\b/g, "a");
}

function chapterNumber(chapterName, index) {
  const m = String(chapterName || "").match(/CHAP(?:TER)?\s*(\d+)/i);
  return m ? Number(m[1]) : index + 1;
}

function chapterTitle(chapterName) {
  return titleCase(
    String(chapterName || "")
      .replace(/^CHAP(?:TER)?\s*\d+\s*:\s*/i, "")
      .trim(),
  );
}

function topicCodeFromRef(ref, topicName, chapterNum) {
  if (ref && /^\d+\.\d+$/.test(String(ref).trim())) return String(ref).trim();
  const m = String(topicName || "").match(/(\d+)\.(\d+)/);
  if (m) return `${m[1]}.${m[2]}`;
  return `${chapterNum}.0`;
}

const chapters = (hierarchy.chapters || []).map((ch, i) => {
  const num = chapterNumber(ch.ChapterName, i);
  const title = chapterTitle(ch.ChapterName);
  const topics = (hierarchy.topics || [])
    .filter((t) => t.ChapterID === ch.ChapterID)
    .map((t, ti) => {
      let id = topicCodeFromRef(t.TopicRef, t.TopicName, num);
      if (!id || id.endsWith(".0")) {
        id = `${num}.${ti + 1}`;
      }
      const titleT = titleCase(
        String(t.TopicName || "")
          .replace(/^\d+\.\d+\s*/, "")
          .trim(),
      );
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
  subject: "Pakistan Studies",
  chapters: chapters.map(({ number, title, topics }) => ({
    number,
    title,
    topics: topics.map(({ id, title: t }) => ({ id, title: t })),
  })),
};
fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, "syllabus.json"), JSON.stringify(syllabus, null, 2));

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
    source: raw.QuestionPeriority || undefined,
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

const outFile = {
  board: "Lahore",
  class: "10",
  subject: "Pakistan Studies",
  source: "PTS PTB Class 10 Pakistan Studies (read-only export)",
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

console.log("Built seeders:", outFile.counts, "total", questions.length);
console.log(
  "sample mcq",
  questions.find((q) => q.type === "mcq"),
);
