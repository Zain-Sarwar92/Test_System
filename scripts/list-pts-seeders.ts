/**
 * Inventory which Class/Subject PTS seed folders exist locally.
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = path.join(process.cwd(), "data", "lahore-board");

const CLASSES: Array<{ folder: string; label: string }> = [
  { folder: "9th", label: "Class 9" },
  { folder: "10th", label: "Class 10" },
  { folder: "11th", label: "Class 11 (Inter-I)" },
  { folder: "12th", label: "Class 12 (Inter-II)" },
];

type Row = {
  classLabel: string;
  slug: string;
  subject: string;
  hasSyllabus: boolean;
  hasAllQuestions: boolean;
  questionCount: number;
  hasPtsRaw: boolean;
  status: "ready" | "empty" | "partial";
};

function readSubjectName(dir: string, slug: string) {
  const syllabusPath = path.join(dir, "syllabus.json");
  if (fs.existsSync(syllabusPath)) {
    try {
      const j = JSON.parse(fs.readFileSync(syllabusPath, "utf8")) as {
        subject?: string;
      };
      if (j.subject) return j.subject;
    } catch {
      /* ignore */
    }
  }
  return slug;
}

function questionCount(dir: string) {
  const p = path.join(dir, "all-questions.json");
  if (!fs.existsSync(p)) return null;
  try {
    const j = JSON.parse(fs.readFileSync(p, "utf8")) as {
      questions?: unknown[];
    };
    return Array.isArray(j.questions) ? j.questions.length : 0;
  } catch {
    return null;
  }
}

const rows: Row[] = [];

for (const { folder, label } of CLASSES) {
  const classDir = path.join(ROOT, folder);
  if (!fs.existsSync(classDir)) continue;
  const slugs = fs
    .readdirSync(classDir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && !d.name.startsWith("_"))
    .map((d) => d.name)
    .sort();

  for (const slug of slugs) {
    const dir = path.join(classDir, slug);
    const hasSyllabus = fs.existsSync(path.join(dir, "syllabus.json"));
    const q = questionCount(dir);
    const hasAllQuestions = q !== null;
    const hasPtsRaw = fs.existsSync(path.join(dir, "pts-raw"));
    let status: Row["status"] = "partial";
    if (hasSyllabus && hasAllQuestions && (q ?? 0) > 0) status = "ready";
    else if (hasAllQuestions && (q ?? 0) === 0) status = "empty";
    rows.push({
      classLabel: label,
      slug,
      subject: readSubjectName(dir, slug),
      hasSyllabus,
      hasAllQuestions,
      questionCount: q ?? 0,
      hasPtsRaw,
      status,
    });
  }
}

for (const { label } of CLASSES) {
  const classRows = rows.filter((r) => r.classLabel === label);
  const ready = classRows.filter((r) => r.status === "ready");
  const empty = classRows.filter((r) => r.status === "empty");
  const partial = classRows.filter((r) => r.status === "partial");
  const qSum = classRows.reduce((a, r) => a + r.questionCount, 0);

  console.log(`\n==============================`);
  console.log(`${label}`);
  console.log(
    `subjects=${classRows.length} | ready=${ready.length} | empty=${empty.length} | partial=${partial.length} | questions_in_seed=${qSum}`,
  );
  console.log(`------------------------------`);
  for (const r of classRows) {
    const mark =
      r.status === "ready" ? "OK" : r.status === "empty" ? "EMPTY" : "PARTIAL";
    console.log(
      `${mark.padEnd(7)} ${r.slug.padEnd(28)} ${String(r.questionCount).padStart(5)}  ${r.subject}`,
    );
  }
}

console.log(`\n==============================`);
console.log(
  `TOTAL subjects: ${rows.length} | ready: ${rows.filter((r) => r.status === "ready").length} | empty: ${rows.filter((r) => r.status === "empty").length} | seed questions: ${rows.reduce((a, r) => a + r.questionCount, 0)}`,
);
