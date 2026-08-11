import fs from "node:fs";
import path from "node:path";

type McqQuestion = {
  id: number;
  chapter: number;
  topic_id: string;
  source: string;
  type: "mcq";
  en: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
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

const DEFAULT_STEM = "Tick the correct spelling.";
const SOURCE = "Tick correct spelling";

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
    if (value) return { idx: i, value };
  }
  return null;
}

function isOptionMarker(value: string) {
  return /^\([A-Da-d]\)$/.test(value);
}

function resolveTopic(headerLine: string): string | null {
  const key = normalizeHeader(headerLine);
  return HEADER_TO_TOPIC[key] ?? null;
}

/** Spelling MCQs: id → (A)(B)(C)(D) with no stem. */
export function parseEnglishSpellingRaw(raw: string): McqQuestion[] {
  const lines = raw.replace(/\r\n/g, "\n").split("\n");
  const questions: McqQuestion[] = [];

  let currentTopicId: string | null = null;
  let i = 0;

  while (i < lines.length) {
    const trimmed = lines[i].trim();
    if (!trimmed) {
      i += 1;
      continue;
    }

    const topicFromHeader = resolveTopic(trimmed);
    if (topicFromHeader && !/^\d+$/.test(trimmed)) {
      currentTopicId = topicFromHeader;
      i += 1;
      continue;
    }

    if (!/^\d+$/.test(trimmed) || !currentTopicId) {
      i += 1;
      continue;
    }

    const id = Number(trimmed);
    i += 1;

    // Optional stem (usually empty for spelling)
    const stemParts: string[] = [];
    while (i < lines.length) {
      const hit = nextNonEmpty(lines, i);
      if (!hit) {
        i = lines.length;
        break;
      }
      if (isOptionMarker(hit.value)) break;
      if (/^\d+$/.test(hit.value)) break;
      if (resolveTopic(hit.value)) break;
      stemParts.push(hit.value);
      i = hit.idx + 1;
    }

    const options: Record<"A" | "B" | "C" | "D", string> = {
      A: "",
      B: "",
      C: "",
      D: "",
    };

    for (const letter of ["A", "B", "C", "D"] as const) {
      const marker = nextNonEmpty(lines, i);
      if (!marker || marker.value.toUpperCase() !== `(${letter})`) break;
      i = marker.idx + 1;

      const textParts: string[] = [];
      while (i < lines.length) {
        const hit = nextNonEmpty(lines, i);
        if (!hit) {
          i = lines.length;
          break;
        }
        if (isOptionMarker(hit.value)) break;
        if (/^\d+$/.test(hit.value)) break;
        if (resolveTopic(hit.value)) break;
        textParts.push(hit.value);
        i = hit.idx + 1;
      }
      options[letter] = clean(textParts.join(" "));
    }

    if (!options.A || !options.B || !options.C || !options.D) continue;

    const en = clean(stemParts.join(" ")) || DEFAULT_STEM;

    questions.push({
      id,
      chapter: Number(currentTopicId.split(".")[0]),
      topic_id: currentTopicId,
      source: SOURCE,
      type: "mcq",
      en,
      optionA: options.A,
      optionB: options.B,
      optionC: options.C,
      optionD: options.D,
    });
  }

  const byId = new Map<number, McqQuestion>();
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
  const rawPath = path.join(dataDir, "spelling-raw.txt");
  const spellingOutPath = path.join(dataDir, "spelling-questions.json");
  const allPath = path.join(dataDir, "all-questions.json");

  const raw = fs.readFileSync(rawPath, "utf8");
  const spelling = parseEnglishSpellingRaw(raw);

  fs.writeFileSync(
    spellingOutPath,
    JSON.stringify(
      {
        board: "Lahore",
        class: "10",
        subject: "English",
        type: "mcq",
        source: SOURCE,
        total_questions: spelling.length,
        questions: spelling,
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

  // Keep non-spelling questions; replace spelling set
  const nonSpelling = all.questions.filter(
    (q) => q.source !== SOURCE,
  );
  all.questions = [...nonSpelling, ...spelling];
  all.total_questions = all.questions.length;
  fs.writeFileSync(allPath, JSON.stringify(all, null, 2), "utf8");

  const byTopic = new Map<string, number>();
  for (const q of spelling) {
    byTopic.set(q.topic_id, (byTopic.get(q.topic_id) ?? 0) + 1);
  }

  const ids = spelling.map((q) => q.id);
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
        parsedSpelling: spelling.length,
        mergedTotal: all.total_questions,
        idRange: ids.length ? [Math.min(...ids), Math.max(...ids)] : [],
        missingIds,
        sample: spelling[0],
        last: spelling[spelling.length - 1],
        topics: Object.fromEntries([...byTopic.entries()].sort()),
        missingTopics,
      },
      null,
      2,
    ),
  );
}

main();
