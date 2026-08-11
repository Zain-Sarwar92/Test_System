import fs from "node:fs";
import path from "node:path";

type LongQuestion = {
  id: number;
  chapter: number;
  topic_id: string;
  source: string;
  type: "long";
  field: "Summary";
  series: "smart-syllabus";
  en: string;
};

const HEADER_TO_TOPIC: Record<string, string> = {
  "MY BELOVED PAKISTAN (POEM)": "2.1",
  "TIME (POEM)": "8.1",
  "THE ROAD NOT TAKEN (POEM)": "10.1",
  "THE HAPPY PRINCE": "5.1",
  "THE THREE QUESTIONS": "11.1",
};

const SOURCES = new Set(["Exercise", "Additional", "Past Papers", "Conceptuals"]);
const FIELD_SOURCE = "Summary";

function normalizeHeader(line: string) {
  return line
    .replace(/^\.\s*/, "")
    .replace(/^\.+/, "")
    .replace(/[\u2018\u2019\u201A\u2032]/g, "'")
    .trim()
    .replace(/\s+/g, " ")
    .toUpperCase();
}

function clean(s: string) {
  return s.replace(/\s+/g, " ").trim();
}

function nextNonEmpty(
  lines: string[],
  from: number,
): { idx: number; value: string } | null {
  for (let i = from; i < lines.length; i++) {
    const value = lines[i].trim();
    if (value && value !== ".") return { idx: i, value };
  }
  return null;
}

function resolveTopic(headerLine: string): string | null {
  const key = normalizeHeader(headerLine);
  if (!key || key === ".") return null;
  return HEADER_TO_TOPIC[key] ?? null;
}

export function parseSummaryRaw(raw: string): LongQuestion[] {
  const lines = raw.replace(/\r\n/g, "\n").split("\n");
  type Start = {
    line: number;
    topic_id: string;
    source: string;
    id: number;
  };
  const starts: Start[] = [];
  let currentTopicId: string | null = null;

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (!trimmed || trimmed === ".") continue;

    const topic = resolveTopic(trimmed);
    if (topic && !SOURCES.has(trimmed) && !/^\d+$/.test(trimmed)) {
      currentTopicId = topic;
      continue;
    }

    if (!SOURCES.has(trimmed) || !currentTopicId) continue;

    const idHit = nextNonEmpty(lines, i + 1);
    if (!idHit || !/^\d+$/.test(idHit.value)) continue;

    starts.push({
      line: i,
      topic_id: currentTopicId,
      source: FIELD_SOURCE,
      id: Number(idHit.value),
    });
  }

  const questions: LongQuestion[] = [];

  for (let s = 0; s < starts.length; s++) {
    const meta = starts[s];
    const end = s + 1 < starts.length ? starts[s + 1].line : lines.length;
    const block = lines.slice(meta.line, end).map((l) => l.trim());

    const idLineIdx = block.findIndex(
      (l, idx) => idx > 0 && l === String(meta.id) && /^\d+$/.test(l),
    );
    const stemStart = idLineIdx >= 0 ? idLineIdx + 1 : 2;
    let stem = block.slice(stemStart).filter((l) => l && l !== ".");

    while (
      stem.length &&
      (stem[stem.length - 1] === String(meta.id) ||
        SOURCES.has(stem[stem.length - 1]) ||
        resolveTopic(stem[stem.length - 1]) !== null)
    ) {
      stem = stem.slice(0, -1);
    }

    stem = stem.filter(
      (l) =>
        !SOURCES.has(l) &&
        l !== String(meta.id) &&
        resolveTopic(l) === null,
    );

    const en = clean(stem.join(" "));
    if (!en) continue;

    questions.push({
      id: meta.id,
      chapter: Number(meta.topic_id.split(".")[0]),
      topic_id: meta.topic_id,
      source: meta.source,
      type: "long",
      field: "Summary",
      series: "smart-syllabus",
      en,
    });
  }

  const byId = new Map<number, LongQuestion>();
  for (const q of questions) byId.set(q.id, q);
  return [...byId.values()].sort((a, b) => a.id - b.id);
}

function main() {
  const dataDir = path.join(
    process.cwd(),
    "data",
    "lahore-board",
    "10th",
    "english",
  );
  const rawPath = path.join(dataDir, "summary-raw.txt");
  const outPath = path.join(dataDir, "summary-questions.json");
  const allPath = path.join(dataDir, "all-questions.json");

  const raw = fs.readFileSync(rawPath, "utf8");
  const summaries = parseSummaryRaw(raw);

  fs.writeFileSync(
    outPath,
    JSON.stringify(
      {
        board: "Lahore",
        class: "10",
        subject: "English",
        type: "long",
        field: "Summary",
        total_questions: summaries.length,
        questions: summaries,
      },
      null,
      2,
    ),
    "utf8",
  );

  const all = fs.existsSync(allPath)
    ? (JSON.parse(fs.readFileSync(allPath, "utf8")) as {
        board: string;
        class: string;
        subject: string;
        medium?: string;
        total_questions: number;
        questions: Array<Record<string, unknown>>;
      })
    : {
        board: "Lahore",
        class: "10",
        subject: "English",
        medium: "english",
        total_questions: 0,
        questions: [] as Array<Record<string, unknown>>,
      };

  const others = all.questions.filter(
    (q) => !(q.type === "long" && q.source === FIELD_SOURCE),
  );
  all.questions = [...others, ...summaries];
  all.total_questions = all.questions.length;
  fs.writeFileSync(allPath, JSON.stringify(all, null, 2), "utf8");

  console.log(
    JSON.stringify(
      {
        parsedSummaries: summaries.length,
        mergedTotal: all.total_questions,
        questions: summaries,
      },
      null,
      2,
    ),
  );
}

main();
