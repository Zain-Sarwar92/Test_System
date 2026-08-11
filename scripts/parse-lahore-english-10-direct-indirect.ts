import fs from "node:fs";
import path from "node:path";

type ShortQuestion = {
  id: number;
  chapter: number;
  topic_id: string;
  source: string;
  type: "short";
  field: "Direct & Indirect";
  en: string;
};

const SOURCES = new Set(["Past Papers", "Exercise", "Additional", "Conceptuals"]);
/** Subtopics under chapter 14: codes 1–5 in raw paste. */
const TOPIC_CODE = /^[1-5]$/;
const TOPIC_TITLE = /^[1-5]\s+\S/;

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

export function parseDirectIndirectRaw(raw: string): ShortQuestion[] {
  const lines = raw.replace(/\r\n/g, "\n").split("\n");
  type Start = { line: number; topic_num: string; source: string; id: number };
  const starts: Start[] = [];

  for (let i = 0; i < lines.length; i++) {
    const topic = lines[i].trim();
    if (!TOPIC_CODE.test(topic)) continue;
    const sourceHit = nextNonEmpty(lines, i + 1);
    if (!sourceHit || !SOURCES.has(sourceHit.value)) continue;
    const idHit = nextNonEmpty(lines, sourceHit.idx + 1);
    if (!idHit || !/^\d+$/.test(idHit.value)) continue;
    starts.push({
      line: i,
      topic_num: topic,
      source: sourceHit.value,
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
    const stemStart = idLineIdx >= 0 ? idLineIdx + 1 : 3;
    let stem = block.slice(stemStart).filter(Boolean);

    while (
      stem.length &&
      (stem[stem.length - 1] === String(meta.id) ||
        SOURCES.has(stem[stem.length - 1]) ||
        TOPIC_CODE.test(stem[stem.length - 1]) ||
        TOPIC_TITLE.test(stem[stem.length - 1]))
    ) {
      stem = stem.slice(0, -1);
    }

    stem = stem.filter(
      (l) =>
        !TOPIC_TITLE.test(l) &&
        !TOPIC_CODE.test(l) &&
        !SOURCES.has(l) &&
        l !== String(meta.id),
    );

    const en = clean(stem.join(" "));
    if (!en) continue;

    questions.push({
      id: meta.id,
      chapter: 14,
      topic_id: `14.${meta.topic_num}`,
      source: meta.source,
      type: "short",
      field: "Direct & Indirect",
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
  const rawPath = path.join(dataDir, "direct-indirect-raw.txt");
  const outPath = path.join(dataDir, "direct-indirect-questions.json");
  const allPath = path.join(dataDir, "all-questions.json");

  const raw = fs.readFileSync(rawPath, "utf8");
  const di = parseDirectIndirectRaw(raw);

  fs.writeFileSync(
    outPath,
    JSON.stringify(
      {
        board: "Lahore",
        class: "10",
        subject: "English",
        type: "short",
        field: "Direct & Indirect",
        total_questions: di.length,
        questions: di,
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

  // Replace previous Direct & Indirect shorts only (topic 14.*)
  const others = all.questions.filter(
    (q) => !(q.type === "short" && String(q.topic_id ?? "").startsWith("14.")),
  );
  all.questions = [...others, ...di];
  all.total_questions = all.questions.length;
  fs.writeFileSync(allPath, JSON.stringify(all, null, 2), "utf8");

  const byTopic = new Map<string, number>();
  for (const q of di) {
    byTopic.set(q.topic_id, (byTopic.get(q.topic_id) ?? 0) + 1);
  }

  const ids = di.map((q) => q.id);
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
        parsedDirectIndirect: di.length,
        mergedTotal: all.total_questions,
        idRange: ids.length ? [Math.min(...ids), Math.max(...ids)] : [],
        missingIds,
        sample: di[0],
        last: di[di.length - 1],
        topics: Object.fromEntries([...byTopic.entries()].sort()),
        missingTopics,
      },
      null,
      2,
    ),
  );
}

main();
