import fs from "node:fs";
import path from "node:path";

type McqQuestion = {
  id: number;
  chapter: number;
  topic_id: string;
  source: string;
  type: "mcq";
  en: string;
  ur?: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
};

const HAS_URDU = /[\u0600-\u06FF]/;
const SOURCES = new Set(["Exercise", "Additional", "Conceptuals"]);

function clean(s: string) {
  return s.replace(/\s+/g, " ").trim();
}

function parseOptionBlock(lines: string[]): { ur?: string; en: string } {
  const nonEmpty = lines.map((l) => l.trim()).filter(Boolean);
  if (nonEmpty.length === 0) return { en: "" };
  if (nonEmpty.length === 1) {
    const only = nonEmpty[0];
    if (HAS_URDU.test(only)) return { ur: only, en: only };
    return { en: only };
  }
  // Prefer last Latin-ish line as English, first Urdu as Urdu
  const urduLines = nonEmpty.filter((l) => HAS_URDU.test(l));
  const enLines = nonEmpty.filter((l) => !HAS_URDU.test(l));
  const en = clean(enLines.join(" ") || nonEmpty[nonEmpty.length - 1]);
  const ur = urduLines.length ? clean(urduLines.join(" ")) : undefined;
  return ur ? { ur, en } : { en };
}

function formatOption(parsed: { ur?: string; en: string }) {
  if (parsed.ur && parsed.en && parsed.ur !== parsed.en) {
    return `${parsed.en} / ${parsed.ur}`;
  }
  return parsed.en || parsed.ur || "";
}

function nextNonEmpty(lines: string[], from: number): { idx: number; value: string } | null {
  for (let i = from; i < lines.length; i++) {
    const value = lines[i].trim();
    if (value) return { idx: i, value };
  }
  return null;
}

function parseMcqRaw(raw: string): McqQuestion[] {
  const lines = raw.replace(/\r\n/g, "\n").split("\n");
  const questions: McqQuestion[] = [];

  // Find blocks: topic_id → source → id (blank lines allowed between)
  type Start = { line: number; topic_id: string; source: string; id: number };
  const starts: Start[] = [];

  for (let i = 0; i < lines.length; i++) {
    const topic = lines[i].trim();
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

  for (let s = 0; s < starts.length; s++) {
    const meta = starts[s];
    const end = s + 1 < starts.length ? starts[s + 1].line : lines.length;
    const block = lines.slice(meta.line, end).map((l) => l.trim());

    const topic_id = meta.topic_id;
    const source = meta.source;
    const id = meta.id;
    const chapter = Number(topic_id.split(".")[0]);

    const optIdx: Record<string, number> = {};
    for (let i = 0; i < block.length; i++) {
      const m = block[i].match(/^\(([A-D])\)$/);
      if (m) optIdx[m[1]] = i;
    }

    if (
      optIdx.A == null ||
      optIdx.B == null ||
      optIdx.C == null ||
      optIdx.D == null
    ) {
      continue;
    }

    // Stem = after id line until (A)
    const idLineIdx = block.findIndex(
      (l, idx) => idx > 0 && l === String(id) && /^\d+$/.test(l),
    );
    const stemStart = idLineIdx >= 0 ? idLineIdx + 1 : 3;
    const stemLines = block.slice(stemStart, optIdx.A).filter(Boolean);
    const stemUrdu = stemLines.filter((l) => HAS_URDU.test(l));
    const stemEn = stemLines.filter((l) => !HAS_URDU.test(l) && !/^\d+$/.test(l));

    const en = clean(stemEn.join(" "));
    const ur = stemUrdu.length ? clean(stemUrdu.join(" ")) : undefined;

    const a = parseOptionBlock(block.slice(optIdx.A + 1, optIdx.B));
    const b = parseOptionBlock(block.slice(optIdx.B + 1, optIdx.C));
    const c = parseOptionBlock(block.slice(optIdx.C + 1, optIdx.D));
    let afterD = block.slice(optIdx.D + 1);
    while (
      afterD.length &&
      (afterD[afterD.length - 1] === "" ||
        afterD[afterD.length - 1] === String(id) ||
        SOURCES.has(afterD[afterD.length - 1]) ||
        /^([1-9]|1[01])\.\d+$/.test(afterD[afterD.length - 1]))
    ) {
      afterD = afterD.slice(0, -1);
    }
    const d = parseOptionBlock(afterD);

    if (!en) continue;

    questions.push({
      id,
      chapter,
      topic_id,
      source,
      type: "mcq",
      en,
      ...(ur ? { ur } : {}),
      optionA: formatOption(a),
      optionB: formatOption(b),
      optionC: formatOption(c),
      optionD: formatOption(d),
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
    "9th",
    "biology",
  );
  const rawPath = path.join(dataDir, "mcq-raw.txt");
  const allPath = path.join(dataDir, "all-questions.json");
  const mcqOutPath = path.join(dataDir, "mcq-questions.json");

  const raw = fs.readFileSync(rawPath, "utf8");
  const parsed = parseMcqRaw(raw);
  const mcqs = parsed.filter(
    (q) => q.optionA && q.optionB && q.optionC && q.optionD,
  );
  const skippedIncomplete = parsed.length - mcqs.length;

  fs.writeFileSync(
    mcqOutPath,
    JSON.stringify(
      {
        board: "Lahore",
        class: "9",
        subject: "Biology",
        type: "mcq",
        total_questions: mcqs.length,
        questions: mcqs,
      },
      null,
      2,
    ),
    "utf8",
  );

  const all = JSON.parse(fs.readFileSync(allPath, "utf8")) as {
    board: string;
    class: string;
    subject: string;
    medium?: string;
    total_questions: number;
    questions: Array<Record<string, unknown>>;
  };

  // Remove any previous mcq entries (by type), keep short/long
  const nonMcq = all.questions.filter((q) => q.type !== "mcq");
  const merged = [...nonMcq, ...mcqs];
  all.questions = merged;
  all.total_questions = merged.length;

  fs.writeFileSync(allPath, JSON.stringify(all, null, 2), "utf8");

  const byTopic = new Map<string, number>();
  for (const q of mcqs) {
    byTopic.set(q.topic_id, (byTopic.get(q.topic_id) ?? 0) + 1);
  }

  console.log(
    JSON.stringify(
      {
        parsedMcqs: mcqs.length,
        skippedIncomplete,
        mergedTotal: merged.length,
        sample: mcqs[0],
        last: mcqs[mcqs.length - 1],
        topics: Object.fromEntries([...byTopic.entries()].sort()),
        missingOptions: mcqs.filter(
          (q) => !q.optionA || !q.optionB || !q.optionC || !q.optionD,
        ).length,
      },
      null,
      2,
    ),
  );
}

main();
