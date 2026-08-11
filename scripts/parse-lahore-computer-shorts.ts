import fs from "node:fs";
import path from "node:path";

type ShortQuestion = {
  id: number;
  chapter: number;
  topic_id: string;
  source: string;
  type: "short";
  series: "smart-syllabus";
  en: string;
  ur?: string;
};

const HAS_URDU = /[\u0600-\u06FF]/;
const SOURCES = new Set(["Exercise", "Additional", "Conceptuals"]);

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

function parseShortRaw(raw: string): ShortQuestion[] {
  const lines = raw.replace(/\r\n/g, "\n").split("\n");
  type Start = { line: number; topic_id: string; source: string; id: number };
  const starts: Start[] = [];

  for (let i = 0; i < lines.length; i++) {
    const topic = lines[i].trim();
    // Allow "1.10" style topic ids
    if (!/^\d+\.\d+$/.test(topic)) continue;
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
        /^\d+\.\d+$/.test(stem[stem.length - 1]) ||
        /^\d+\.\d+\s+\S/.test(stem[stem.length - 1]))
    ) {
      stem = stem.slice(0, -1);
    }

    // Drop topic title headers that leaked into stem
    stem = stem.filter(
      (l) =>
        !/^\d+\.\d+\s+[A-Z]/.test(l) &&
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
      type: "short",
      series: "smart-syllabus",
      en,
      ...(ur ? { ur } : {}),
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
    "9th",
    "computer",
  );
  const rawPath = path.join(dataDir, "short-raw.txt");
  const allPath = path.join(dataDir, "all-questions.json");
  const outPath = path.join(dataDir, "short-questions.json");

  const shorts = parseShortRaw(fs.readFileSync(rawPath, "utf8"));
  const payload = {
    board: "Lahore",
    class: "9",
    subject: "Computer",
    type: "short",
    series: "smart-syllabus",
    total_questions: shorts.length,
    questions: shorts,
  };

  fs.writeFileSync(outPath, JSON.stringify(payload, null, 2), "utf8");
  fs.writeFileSync(
    allPath,
    JSON.stringify(
      {
        board: "Lahore",
        class: "9",
        subject: "Computer",
        series: "smart-syllabus",
        total_questions: shorts.length,
        questions: shorts,
      },
      null,
      2,
    ),
    "utf8",
  );

  const byTopic = new Map<string, number>();
  for (const q of shorts) {
    byTopic.set(q.topic_id, (byTopic.get(q.topic_id) ?? 0) + 1);
  }

  const ids = shorts.map((q) => q.id);
  const missing: number[] = [];
  for (let i = 1; i <= Math.max(...ids, 0); i++) {
    if (!ids.includes(i)) missing.push(i);
  }

  console.log(
    JSON.stringify(
      {
        parsedShorts: shorts.length,
        idRange: ids.length ? [ids[0], ids[ids.length - 1]] : null,
        missingIds: missing.slice(0, 20),
        missingCount: missing.length,
        sample: shorts[0],
        last: shorts[shorts.length - 1],
        topics: Object.fromEntries([...byTopic.entries()].sort()),
      },
      null,
      2,
    ),
  );
}

main();
