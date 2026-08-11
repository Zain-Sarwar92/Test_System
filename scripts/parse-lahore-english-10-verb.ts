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
  "PRESENT INDEFINITE TENSE": "13.1",
  "PRESENT CONTINUOUS TENSE": "13.2",
  "PRESENT PERFECT TENSE": "13.3",
  "PRESENT PERFECT CONTINUOUS TENSE": "13.4",
  "PAST INDEFINITE TENSE": "13.5",
  "PAST CONTINUOUS TENSE": "13.6",
  "PAST PERFECT TENSE": "13.7",
  "PAST PERFECT CONTINUOUS TENSE": "13.8",
  "FUTURE INDEFINITE TENSE": "13.9",
  "FUTURE CONTINUOUS TENSE": "13.10",
};

const SOURCE = "Correct form of verb";

function normalizeHeader(line: string) {
  return line
    .replace(/^\.\s*/, "")
    .replace(/^\d+\s+/, "")
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

export function parseEnglishVerbRaw(raw: string): McqQuestion[] {
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
    // Headers like "1 Present Indefinite Tense" or "Present Indefinite Tense"
    if (
      topicFromHeader &&
      !/^\d+$/.test(trimmed) &&
      /tense/i.test(trimmed)
    ) {
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

    const stemParts: string[] = [];
    while (i < lines.length) {
      const hit = nextNonEmpty(lines, i);
      if (!hit) {
        i = lines.length;
        break;
      }
      if (isOptionMarker(hit.value)) break;
      if (/^\d+$/.test(hit.value) && stemParts.length) break;
      if (resolveTopic(hit.value) && /tense/i.test(hit.value)) break;
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
        if (resolveTopic(hit.value) && /tense/i.test(hit.value)) break;
        textParts.push(hit.value);
        i = hit.idx + 1;
      }
      options[letter] = clean(textParts.join(" "));
    }

    const en = clean(stemParts.join(" "));
    if (
      !en ||
      !options.A ||
      !options.B ||
      !options.C ||
      !options.D
    ) {
      continue;
    }

    questions.push({
      id,
      chapter: 13,
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
  const rawPath = path.join(dataDir, "verb-raw.txt");
  const verbOutPath = path.join(dataDir, "verb-questions.json");
  const allPath = path.join(dataDir, "all-questions.json");

  const raw = fs.readFileSync(rawPath, "utf8");
  const verbs = parseEnglishVerbRaw(raw);

  fs.writeFileSync(
    verbOutPath,
    JSON.stringify(
      {
        board: "Lahore",
        class: "10",
        subject: "English",
        type: "mcq",
        source: SOURCE,
        total_questions: verbs.length,
        questions: verbs,
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

  const others = all.questions.filter((q) => q.source !== SOURCE);
  all.questions = [...others, ...verbs];
  all.total_questions = all.questions.length;
  fs.writeFileSync(allPath, JSON.stringify(all, null, 2), "utf8");

  const byTopic = new Map<string, number>();
  for (const q of verbs) {
    byTopic.set(q.topic_id, (byTopic.get(q.topic_id) ?? 0) + 1);
  }

  const ids = verbs.map((q) => q.id);
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
        parsedVerbs: verbs.length,
        mergedTotal: all.total_questions,
        idRange: ids.length ? [Math.min(...ids), Math.max(...ids)] : [],
        missingIds,
        sample: verbs[0],
        last: verbs[verbs.length - 1],
        topics: Object.fromEntries([...byTopic.entries()].sort()),
        missingTopics,
      },
      null,
      2,
    ),
  );
}

main();
