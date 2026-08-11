import fs from "node:fs";
import path from "node:path";

type ShortQuestion = {
  id: number;
  chapter: number;
  topic_id: string;
  source: string;
  type: "short";
  en: string;
};

const HEADER_TO_TOPIC: Record<string, string> = {
  "HAZRAT MUHAMMAD'S (ﷺ) SOCIAL REFORMS FOR THE RIGHTS OF WOMEN, ORPHANS AND SLAVES":
    "1.1",
  "MY BELOVED PAKISTAN (POEM)": "2.1",
  "DIGITAL GLOBALISATION TRANSFORMING THE ENGLISH LANGUAGE": "3.1",
  "THE EARTH: ACT NOW FOR TOMORROW": "4.1",
  "THE HAPPY PRINCE": "5.1",
  "REVIEW 1": "6.1",
  "DRUG ABUSE": "7.1",
  "TIME (POEM)": "8.1",
  "POLLUTION-FREE PAKISTAN WITH GREENERY ALL AROUND": "9.1",
  "THE ROAD NOT TAKEN (POEM)": "10.1",
  "THE THREE QUESTIONS": "11.1",
  "REVIEW 2": "12.1",
  TENSES: "13.1",
  "DIRECT & INDIRECT": "14.1",
  "ENGLISH B": "15.1",
};

const SOURCES = new Set(["Exercise", "Additional", "Conceptuals", "Examples"]);

function normalizeHeader(line: string) {
  return line
    .replace(/^\.\s*/, "")
    .replace(/^\.+/, "")
    .replace(/^UNIT\s+\d+\s*:\s*/i, "")
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

/**
 * Format:
 *   UNIT HEADER
 *   .
 *   Exercise|Additional
 *   <id>
 *   <stem...>
 */
export function parseEnglishShortRaw(raw: string): ShortQuestion[] {
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
      source: trimmed,
      id: Number(idHit.value),
    });
  }

  const questions: ShortQuestion[] = [];

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
      type: "short",
      en,
    });
  }

  const byId = new Map<number, ShortQuestion>();
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
  const rawPath = path.join(dataDir, "short-raw.txt");
  const shortOutPath = path.join(dataDir, "short-questions.json");
  const allPath = path.join(dataDir, "all-questions.json");

  const raw = fs.readFileSync(rawPath, "utf8");
  const shorts = parseEnglishShortRaw(raw);

  fs.writeFileSync(
    shortOutPath,
    JSON.stringify(
      {
        board: "Lahore",
        class: "10",
        subject: "English",
        type: "short",
        field: "Question Answer",
        total_questions: shorts.length,
        questions: shorts,
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

  const nonShort = all.questions.filter((q) => q.type !== "short");
  all.questions = [...nonShort, ...shorts];
  all.total_questions = all.questions.length;
  fs.writeFileSync(allPath, JSON.stringify(all, null, 2), "utf8");

  const byTopic = new Map<string, number>();
  for (const q of shorts) {
    byTopic.set(q.topic_id, (byTopic.get(q.topic_id) ?? 0) + 1);
  }

  const ids = shorts.map((q) => q.id);
  const missingIds: number[] = [];
  if (ids.length) {
    const min = Math.min(...ids);
    const max = Math.max(...ids);
    const set = new Set(ids);
    for (let n = min; n <= max; n++) {
      if (!set.has(n)) missingIds.push(n);
    }
  }

  const syllabus = fs.readFileSync(path.join(dataDir, "syllabus.json"), "utf8");
  const missingTopics = [...byTopic.keys()].filter(
    (id) => !syllabus.includes(`"id": "${id}"`),
  );

  console.log(
    JSON.stringify(
      {
        parsedShorts: shorts.length,
        mergedTotal: all.total_questions,
        idRange: ids.length ? [Math.min(...ids), Math.max(...ids)] : [],
        missingIds,
        sample: shorts[0],
        last: shorts[shorts.length - 1],
        topics: Object.fromEntries([...byTopic.entries()].sort()),
        missingTopics,
      },
      null,
      2,
    ),
  );
}

main();
