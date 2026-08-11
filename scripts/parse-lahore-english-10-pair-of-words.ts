import fs from "node:fs";
import path from "node:path";

type ShortQuestion = {
  id: number;
  chapter: number;
  topic_id: string;
  source: string;
  type: "short";
  field: "Pair of Words";
  series: "smart-syllabus";
  en: string;
};

const SOURCES = new Set(["Exercise", "Additional", "Past Papers", "Conceptuals"]);
/** English B pair-of-words section uses topic code 1 → 15.1 */
const TOPIC_NUM_TO_ID: Record<string, string> = {
  "1": "15.1",
};
const TOPIC_CODE = /^[1]$/;
const TOPIC_TITLE = /^[1]\s+\S/;
const FIELD_SOURCE = "Pair of Words";

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

export function parsePairOfWordsRaw(raw: string): ShortQuestion[] {
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
      source: FIELD_SOURCE,
      id: Number(idHit.value),
    });
  }

  const questions: ShortQuestion[] = [];

  for (let s = 0; s < starts.length; s++) {
    const meta = starts[s];
    const topicId = TOPIC_NUM_TO_ID[meta.topic_num];
    if (!topicId) continue;

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
      chapter: 15,
      topic_id: topicId,
      source: meta.source,
      type: "short",
      field: "Pair of Words",
      series: "smart-syllabus",
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
  const rawPath = path.join(dataDir, "pair-of-words-raw.txt");
  const outPath = path.join(dataDir, "pair-of-words-questions.json");
  const allPath = path.join(dataDir, "all-questions.json");

  const raw = fs.readFileSync(rawPath, "utf8");
  const pairs = parsePairOfWordsRaw(raw);

  fs.writeFileSync(
    outPath,
    JSON.stringify(
      {
        board: "Lahore",
        class: "10",
        subject: "English",
        type: "short",
        field: "Pair of Words",
        total_questions: pairs.length,
        questions: pairs,
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
    (q) =>
      !(
        q.type === "short" &&
        String(q.source ?? "")
          .toLowerCase()
          .includes("pair of words")
      ),
  );
  all.questions = [...others, ...pairs];
  all.total_questions = all.questions.length;
  fs.writeFileSync(allPath, JSON.stringify(all, null, 2), "utf8");

  const ids = pairs.map((q) => q.id);
  const missingIds: number[] = [];
  if (ids.length) {
    const min = Math.min(...ids);
    const max = Math.max(...ids);
    const set = new Set(ids);
    for (let n = min; n <= max; n++) {
      if (!set.has(n)) missingIds.push(n);
    }
  }

  console.log(
    JSON.stringify(
      {
        parsedPairs: pairs.length,
        mergedTotal: all.total_questions,
        idRange: ids.length ? [Math.min(...ids), Math.max(...ids)] : [],
        missingIds,
        sample: pairs[0],
        last: pairs[pairs.length - 1],
      },
      null,
      2,
    ),
  );
}

main();
