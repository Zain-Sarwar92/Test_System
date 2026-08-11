import fs from "node:fs";
import path from "node:path";

type LongQuestion = {
  id: number;
  chapter: number;
  topic_id: string;
  source: string;
  type: "long";
  series: "smart-syllabus";
  en: string;
  ur?: string;
};

const HAS_URDU = /[\u0600-\u06FF]/;
const SOURCES = new Set(["Exercise", "Additional", "Conceptuals", "Examples"]);
/** Class 10 Physics topics are chapters 10–21. */
const TOPIC_CODE = /^(1[0-9]|2[01])\.\d+$/;
const TOPIC_TITLE = /^(1[0-9]|2[01])\.\d+\s+\S/;

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

export function parseLongRaw(raw: string): LongQuestion[] {
  const lines = raw.replace(/\r\n/g, "\n").split("\n");
  type Start = { line: number; topic_id: string; source: string; id: number };
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
      topic_id: topic,
      source: sourceHit.value,
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

    const urduLines = stem.filter((l) => HAS_URDU.test(l));
    const enLines = stem.filter((l) => !HAS_URDU.test(l) && !/^\d+$/.test(l));
    const en = clean(enLines.join(" "));
    const ur = urduLines.length ? clean(urduLines.join(" ")) : undefined;
    if (!en) continue;

    questions.push({
      id: meta.id,
      chapter: Number(meta.topic_id.split(".")[0]),
      topic_id: meta.topic_id,
      source: meta.source,
      type: "long",
      series: "smart-syllabus",
      en,
      ...(ur ? { ur } : {}),
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
    "physics",
  );
  const rawPath = path.join(dataDir, "long-raw.txt");
  const longOutPath = path.join(dataDir, "long-questions.json");
  const allPath = path.join(dataDir, "all-questions.json");

  const raw = fs.readFileSync(rawPath, "utf8");
  const longs = parseLongRaw(raw);

  fs.writeFileSync(
    longOutPath,
    JSON.stringify(
      {
        board: "Lahore",
        class: "10",
        subject: "Physics",
        type: "long",
        total_questions: longs.length,
        questions: longs,
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
        subject: "Physics",
        medium: "both",
        total_questions: 0,
        questions: [] as Array<Record<string, unknown>>,
      };

  const nonLong = all.questions.filter((q) => q.type !== "long");
  all.questions = [...nonLong, ...longs];
  all.total_questions = all.questions.length;
  fs.writeFileSync(allPath, JSON.stringify(all, null, 2), "utf8");

  const byTopic = new Map<string, number>();
  for (const q of longs) {
    byTopic.set(q.topic_id, (byTopic.get(q.topic_id) ?? 0) + 1);
  }

  const ids = longs.map((q) => q.id);
  const missingIds: number[] = [];
  if (ids.length) {
    const min = Math.min(...ids);
    const max = Math.max(...ids);
    const set = new Set(ids);
    for (let i = min; i <= max; i++) {
      if (!set.has(i)) missingIds.push(i);
    }
  }

  const syllabus = fs.readFileSync(path.join(dataDir, "syllabus.json"), "utf8");
  const missingTopics = [...byTopic.keys()].filter(
    (id) => !syllabus.includes(`"id": "${id}"`),
  );

  console.log(
    JSON.stringify(
      {
        parsedLongs: longs.length,
        mergedTotal: all.total_questions,
        idRange: ids.length ? [Math.min(...ids), Math.max(...ids)] : [],
        missingIds,
        sample: longs[0],
        last: longs[longs.length - 1],
        topics: Object.fromEntries([...byTopic.entries()].sort()),
        missingTopics,
        withUrdu: longs.filter((q) => q.ur).length,
      },
      null,
      2,
    ),
  );
}

main();
