/**
 * Audit all Class 12 subjects: compare PTS seed data vs local DB
 * (question types per chapter + counts).
 * Subjects with no PTS questions are skipped.
 *
 * Usage: npx tsx scripts/audit-pts-vs-local-class12-all.ts [slug]
 */
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { prisma } from "../src/lib/prisma";

const ROOT = path.join(process.cwd(), "data", "lahore-board", "12th");
const ONLY = process.argv[2] || null;

type PtsQuestion = {
  id?: number;
  chapter: number;
  field?: string;
  type?: string;
};

type SyllabusChapter = { number: number; title: string };

function normalizeField(field: string | undefined, type?: string): string {
  const raw = (field || type || "MCQ").toUpperCase();
  if (raw === "WORD") return "PAIR";
  if (raw === "SHORT" || raw === "SHORTS") return "QA";
  if (raw === "MCQS") return "MCQ";
  return raw;
}

function fieldFromRawFilename(name: string): string | null {
  const n = name.replace(/\.json$/i, "").toLowerCase();
  if (n === "hierarchy" || n.includes("probe")) return null;
  const match = n.match(/^(mcq|short|long)(?:-([a-z0-9-]+))?-raw$/);
  if (!match) return null;
  const spec = match[2];
  if (!spec) {
    if (match[1] === "mcq") return "MCQ";
    if (match[1] === "short") return "QA";
    return "LONG";
  }
  const specMap: Record<string, string> = {
    qa: "QA",
    poem: "POEM",
    "poem-stanzas": "POEM_STANZA",
    summary: "SUMMARY",
    passage: "PASSAGE",
    ayat: "AYAT",
    idiom: "IDIOM",
    meaning: "MEANING",
    pair: "PAIR",
    word: "PAIR",
    di: "DI",
    essays: "ESSAYS",
    spelling: "SPELLING",
    grammar: "GRAMMAR",
    verb: "VERB",
    comprehension: "COMPREHENSION",
    synonym: "SYNONYM",
    punctuation: "PUNCTUATION",
    "translate-urdu": "TRANSLATE_UR",
    "translate-english": "TRANSLATE_EN",
  };
  return specMap[spec] ?? spec.replace(/-/g, "_").toUpperCase();
}

function typeToField(type?: string): string {
  const t = (type || "").toLowerCase();
  if (t === "mcq") return "MCQ";
  if (t === "short") return "QA";
  if (t === "long") return "LONG";
  return normalizeField(type);
}

function chapterByPtsTopicId(dataDir: string, syllabusChapters: SyllabusChapter[]) {
  const hierarchyPath = path.join(dataDir, "pts-raw", "hierarchy.json");
  const out = new Map<number, number>();
  if (!fs.existsSync(hierarchyPath)) return out;
  const hierarchy = JSON.parse(fs.readFileSync(hierarchyPath, "utf8")) as {
    chapters?: Array<{ ChapterID: number }>;
    topics?: Array<{ TopicID: number; ChapterID: number }>;
  };
  const chapterNoById = new Map<number, number>();
  (hierarchy.chapters || []).forEach((chapter, idx) => {
    chapterNoById.set(
      chapter.ChapterID,
      syllabusChapters[idx]?.number ?? idx + 1,
    );
  });
  for (const topic of hierarchy.topics || []) {
    const chapterNo = chapterNoById.get(topic.ChapterID);
    if (chapterNo != null) out.set(topic.TopicID, chapterNo);
  }
  return out;
}

function getPtsData(dataDir: string) {
  const all = JSON.parse(
    fs.readFileSync(path.join(dataDir, "all-questions.json"), "utf8"),
  ) as { questions: PtsQuestion[] };
  const syllabus = JSON.parse(
    fs.readFileSync(path.join(dataDir, "syllabus.json"), "utf8"),
  ) as { subject: string; chapters: SyllabusChapter[] };

  const fields = new Set<string>();
  const counts = new Map<number, Record<string, number>>();
  for (const ch of syllabus.chapters) counts.set(ch.number, {});
  const seenIds = new Set<number>();

  const bump = (chapter: number, field: string) => {
    fields.add(field);
    const rec = counts.get(chapter) ?? {};
    rec[field] = (rec[field] ?? 0) + 1;
    counts.set(chapter, rec);
  };

  for (const q of all.questions || []) {
    if (typeof q.id === "number") seenIds.add(q.id);
    bump(q.chapter, normalizeField(q.field, typeToField(q.type)));
  }

  const rawDir = path.join(dataDir, "pts-raw");
  if (fs.existsSync(rawDir)) {
    const topicChapter = chapterByPtsTopicId(dataDir, syllabus.chapters);
    for (const name of fs.readdirSync(rawDir)) {
      const field = fieldFromRawFilename(name);
      if (!field) continue;
      const raw = JSON.parse(fs.readFileSync(path.join(rawDir, name), "utf8")) as {
        questions?: Array<{
          id?: number;
          QuestionID?: number;
          TopicID?: number;
        }>;
      };
      for (const q of raw.questions || []) {
        const id = q.id ?? q.QuestionID;
        if (typeof id === "number" && seenIds.has(id)) continue;
        const chapter =
          typeof q.TopicID === "number" ? topicChapter.get(q.TopicID) : undefined;
        if (chapter == null) continue;
        if (typeof id === "number") seenIds.add(id);
        bump(chapter, field);
      }
    }
  }

  return { syllabus, fieldList: [...fields].sort(), counts };
}

async function getLocalData(subjectName: string) {
  const subject = await prisma.subject.findFirst({
    where: {
      name: subjectName,
      class: {
        name: "Class 12",
        board: { name: "Punjab Textbook" },
      },
    },
    select: { id: true },
  });
  if (!subject) return null;

  const chapters = await prisma.chapter.findMany({
    where: { subjectId: subject.id },
    include: { topics: { select: { id: true } } },
    orderBy: { order: "asc" },
  });

  const counts = new Map<number, Record<string, number>>();
  const fields = new Set<string>();

  for (const chapter of chapters) {
    const topicIds = chapter.topics.map((t) => t.id);
    const rows = await prisma.question.groupBy({
      by: ["type", "subType"],
      where: { topicId: { in: topicIds }, isActive: true },
      _count: { _all: true },
    });
    const rec = counts.get(chapter.order) ?? {};
    for (const row of rows) {
      const key = normalizeField(row.subType ?? undefined, typeToField(row.type));
      fields.add(key);
      rec[key] = (rec[key] ?? 0) + row._count._all;
    }
    counts.set(chapter.order, rec);
  }

  return {
    chapters: chapters.map((c) => ({ number: c.order, title: c.name })),
    fieldList: [...fields].sort(),
    counts,
  };
}

function visibleTypes(rec: Record<string, number>, fields: string[]) {
  return fields.filter((f) => (rec[f] ?? 0) > 0);
}

async function runAudit(slug: string, dataDir: string) {
  const pts = getPtsData(dataDir);
  const local = await getLocalData(pts.syllabus.subject);

  const result = {
    slug,
    subject: pts.syllabus.subject,
    status: "ok" as "ok" | "missing_local" | "issues",
    perfect: 0,
    typeMismatch: [] as string[],
    countMismatch: [] as string[],
    missingChapters: [] as string[],
    extraLocalFields: [] as string[],
    missingLocalFields: [] as string[],
    totalPts: 0,
    totalLocal: 0,
  };

  if (!local) {
    result.status = "missing_local";
    return result;
  }

  const allFields = [...new Set([...pts.fieldList, ...local.fieldList])].sort();
  result.extraLocalFields = local.fieldList.filter((f) => !pts.fieldList.includes(f));
  result.missingLocalFields = pts.fieldList.filter((f) => !local.fieldList.includes(f));

  for (const ch of pts.syllabus.chapters) {
    const p = pts.counts.get(ch.number) ?? {};
    const l = local.counts.get(ch.number);
    result.totalPts += Object.values(p).reduce((a, b) => a + b, 0);

    if (!l) {
      result.missingChapters.push(`Ch ${ch.number} ${ch.title}`);
      continue;
    }
    result.totalLocal += Object.values(l).reduce((a, b) => a + b, 0);

    const pTypes = visibleTypes(p, allFields);
    const lTypes = visibleTypes(l, allFields);
    const typesOk =
      pTypes.length === lTypes.length && pTypes.every((v, i) => v === lTypes[i]);

    const diffs = allFields
      .filter((f) => (p[f] ?? 0) !== (l[f] ?? 0))
      .map((f) => `${f}: PTS ${p[f] ?? 0} vs local ${l[f] ?? 0}`);

    if (typesOk && diffs.length === 0) {
      result.perfect += 1;
    } else {
      if (!typesOk) {
        result.typeMismatch.push(
          `Ch ${ch.number} ${ch.title}\n  PTS: ${pTypes.join(", ") || "none"}\n  Local: ${lTypes.join(", ") || "none"}`,
        );
      }
      if (diffs.length) {
        result.countMismatch.push(`Ch ${ch.number} ${ch.title}\n  ${diffs.join("\n  ")}`);
      }
    }
  }

  if (
    result.typeMismatch.length ||
    result.countMismatch.length ||
    result.missingChapters.length ||
    result.extraLocalFields.length ||
    result.missingLocalFields.length
  ) {
    result.status = "issues";
  }

  return result;
}

async function main() {
  const skippedNoData: string[] = [];
  const slugs = fs
    .readdirSync(ROOT, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .filter((name) => {
      if (ONLY && name !== ONLY) return false;
      const dataDir = path.join(ROOT, name);
      if (
        !fs.existsSync(path.join(dataDir, "syllabus.json")) ||
        !fs.existsSync(path.join(dataDir, "all-questions.json"))
      ) {
        return false;
      }
      const all = JSON.parse(
        fs.readFileSync(path.join(dataDir, "all-questions.json"), "utf8"),
      ) as { subject?: string; questions?: unknown[] };
      if (!all.questions?.length) {
        skippedNoData.push(`${all.subject || name} (${name})`);
        return false;
      }
      return true;
    })
    .sort();

  const results = [];
  for (const slug of slugs) {
    results.push(await runAudit(slug, path.join(ROOT, slug)));
  }

  const ok = results.filter((r) => r.status === "ok");
  const missing = results.filter((r) => r.status === "missing_local");
  const issues = results.filter((r) => r.status === "issues");

  console.log("=== SUMMARY ===");
  console.log(`Audited subjects: ${results.length}`);
  console.log(`Perfect match: ${ok.length}`);
  console.log(`Issues: ${issues.length}`);
  console.log(`Missing in DB: ${missing.length}`);
  console.log(`Skipped (no PTS data): ${skippedNoData.length}`);

  if (skippedNoData.length) {
    console.log("\n=== SKIPPED — NO PTS DATA ===");
    for (const x of skippedNoData) console.log(`– ${x}`);
  }

  if (ok.length) {
    console.log("\n=== PERFECT SUBJECTS ===");
    for (const r of ok) {
      console.log(`✓ ${r.subject} (${r.slug}) — ${r.perfect} chapters, ${r.totalPts} questions`);
    }
  }

  if (missing.length) {
    console.log("\n=== MISSING IN DB ===");
    for (const r of missing) console.log(`✗ ${r.subject} (${r.slug})`);
  }

  if (issues.length) {
    console.log("\n=== SUBJECTS WITH ISSUES ===");
    for (const r of issues) {
      console.log(`\n--- ${r.subject} (${r.slug}) ---`);
      console.log(
        `PTS total: ${r.totalPts}, Local total: ${r.totalLocal}, Perfect chapters: ${r.perfect}/${r.perfect + r.typeMismatch.length + r.countMismatch.length + r.missingChapters.length}`,
      );
      if (r.missingLocalFields.length) {
        console.log(`Missing local fields: ${r.missingLocalFields.join(", ")}`);
      }
      if (r.extraLocalFields.length) {
        console.log(`Extra local fields: ${r.extraLocalFields.join(", ")}`);
      }
      if (r.missingChapters.length) {
        console.log("Missing chapters:");
        for (const x of r.missingChapters) console.log(`  ${x}`);
      }
      if (r.typeMismatch.length) {
        console.log("Type mismatches:");
        for (const x of r.typeMismatch.slice(0, 5)) console.log(x);
        if (r.typeMismatch.length > 5) console.log(`  ... +${r.typeMismatch.length - 5} more`);
      }
      if (r.countMismatch.length) {
        console.log("Count mismatches:");
        for (const x of r.countMismatch.slice(0, 5)) console.log(x);
        if (r.countMismatch.length > 5) console.log(`  ... +${r.countMismatch.length - 5} more`);
      }
    }
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
