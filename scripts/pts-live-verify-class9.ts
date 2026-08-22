/**
 * Live PTS login + Class 9 subject verify (syllabus + types/counts vs local seed).
 * READ-ONLY: GetSyllabus / ChaptersList / GetQuestions only.
 *
 * Usage:
 *   PTS_USER=... PTS_PASS=... npx tsx scripts/pts-live-verify-class9.ts
 */
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";

const BASE = "https://www.paktestsolution.com";
const USER = process.env.PTS_USER;
const PASS = process.env.PTS_PASS;
if (!USER || !PASS) {
  console.error("Set PTS_USER and PTS_PASS");
  process.exit(1);
}

const PRIORITIES = [1, 2, 3, 4, 5];
const CHUNK = 10;
const ROOT = path.join(process.cwd(), "data", "lahore-board", "9th");

/** Target subjects from user request */
const SUBJECTS: Record<
  number,
  {
    slug: string;
    types: Array<{ id: number; field: string }>;
  }
> = {
  43: {
    slug: "biology",
    types: [
      { id: 1, field: "MCQ" },
      { id: 12, field: "QA" },
      { id: 13, field: "LONG" },
    ],
  },
  45: {
    slug: "chemistry",
    types: [
      { id: 1, field: "MCQ" },
      { id: 12, field: "QA" },
      { id: 13, field: "LONG" },
    ],
  },
  44: {
    slug: "computer",
    types: [
      { id: 1, field: "MCQ" },
      { id: 12, field: "QA" },
      { id: 13, field: "LONG" },
    ],
  },
  48: {
    slug: "english",
    types: [
      { id: 1, field: "COMPREHENSION" },
      { id: 2, field: "SPELLING" },
      { id: 3, field: "MEANING" },
      { id: 6, field: "GRAMMAR" },
      { id: 14, field: "QA" },
      { id: 34, field: "PAIR" },
      { id: 28, field: "SUMMARY" },
      { id: 43, field: "TRANSLATE_UR" },
      { id: 47, field: "POEM_STANZA" },
    ],
  },
  47: {
    slug: "mathematics",
    types: [
      { id: 1, field: "MCQ" },
      { id: 12, field: "QA" },
      { id: 13, field: "LONG" },
    ],
  },
  46: {
    slug: "physics",
    types: [
      { id: 1, field: "MCQ" },
      { id: 12, field: "QA" },
      { id: 13, field: "LONG" },
    ],
  },
  50: {
    slug: "urdu-compulsory",
    types: [
      { id: 1, field: "MCQ" },
      { id: 14, field: "QA" },
      { id: 24, field: "CORRECT" },
      { id: 25, field: "IDIOM" },
      { id: 42, field: "MEANING" },
      { id: 19, field: "POEM" },
      { id: 28, field: "SUMMARY" },
      { id: 48, field: "PASSAGE" },
      { id: 15, field: "LETTER" },
      { id: 16, field: "APPLICATION" },
      { id: 26, field: "STORY" },
      { id: 31, field: "DIALOGUE" },
      { id: 30, field: "CENTRAL" },
    ],
  },
  51: {
    slug: "islamiyat-compulsory",
    types: [
      { id: 1, field: "MCQ" },
      { id: 12, field: "QA" },
      { id: 13, field: "LONG" },
      { id: 18, field: "HADITH" },
      { id: 57, field: "PERSONALITY" },
    ],
  },
  308: {
    slug: "tarjuma-quran",
    types: [
      { id: 1, field: "MCQ" },
      { id: 12, field: "QA" },
      { id: 13, field: "LONG" },
      { id: 17, field: "AYAT" },
      { id: 37, field: "WORD" },
    ],
  },
};

const jar = new Map<string, string>();
function storeCookies(res: Response) {
  const anyRes = res as Response & { headers: Headers & { getSetCookie?: () => string[] } };
  for (const c of anyRes.headers.getSetCookie?.() || []) {
    const [pair] = c.split(";");
    const eq = pair.indexOf("=");
    if (eq > 0) jar.set(pair.slice(0, eq), pair.slice(eq + 1));
  }
}
const cookieHeader = () =>
  [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");

async function req(url: string, opts: RequestInit = {}) {
  const headers: Record<string, string> = {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122 Safari/537.36",
    Accept: "*/*",
    "X-Requested-With": "XMLHttpRequest",
    ...(opts.headers as Record<string, string> | undefined),
  };
  if (jar.size) headers.Cookie = cookieHeader();
  const res = await fetch(url, { ...opts, headers, redirect: "manual" });
  storeCookies(res);
  return res;
}

async function login() {
  const u = new URL(`${BASE}/Home/CheckLogin`);
  u.searchParams.set("emailAddress", USER!);
  u.searchParams.set("password", PASS!);
  const json = (await (await req(u.toString())).json()) as {
    IsValid: boolean;
    html: string;
  };
  if (!json.IsValid) throw new Error(`Login failed: ${json.html}`);
  await req(`${BASE}${json.html}`);
  await req(`${BASE}/GeneratePaper/GetSyllabus`);
  console.log("Logged in to PTS (read-only)");
}

async function getJson(apiPath: string, params: Record<string, string | number>) {
  const u = new URL(BASE + apiPath);
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, String(v));
  const res = await req(u.toString());
  const text = await res.text();
  if (!res.ok) throw new Error(`${apiPath} ${res.status}: ${text.slice(0, 200)}`);
  return JSON.parse(text);
}

async function getQuestions(topicIds: string, subTypeId: number, priorityId: number) {
  const u = new URL(`${BASE}/AjaxCalling/GetQuestions`);
  u.searchParams.set("TopicIDs", topicIds);
  u.searchParams.set("QuestionSubTypeID", String(subTypeId));
  u.searchParams.set("QuestionPeriorityID", String(priorityId));
  u.searchParams.set("SyllabusType", "0");
  const res = await req(u.toString());
  if (!res.ok) return [] as Array<{ QuestionID: number }>;
  const json = JSON.parse(await res.text()) as {
    QuestionsList?: Array<{ QuestionID: number }>;
  };
  return json.QuestionsList || [];
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function loadLocal(slug: string) {
  const dir = path.join(ROOT, slug);
  const syllabus = JSON.parse(
    fs.readFileSync(path.join(dir, "syllabus.json"), "utf8"),
  ) as {
    subject: string;
    chapters: Array<{ number: number; title: string }>;
  };
  const all = JSON.parse(
    fs.readFileSync(path.join(dir, "all-questions.json"), "utf8"),
  ) as {
    questions: Array<{ chapter: number; field?: string; type?: string }>;
  };
  const byCh = new Map<number, Record<string, number>>();
  const subjectTotals: Record<string, number> = {};
  for (const ch of syllabus.chapters) byCh.set(ch.number, {});
  for (const q of all.questions || []) {
    let f = (q.field || q.type || "MCQ").toUpperCase();
    if (f === "WORD") f = "PAIR";
    subjectTotals[f] = (subjectTotals[f] ?? 0) + 1;
    const rec = byCh.get(q.chapter) ?? {};
    rec[f] = (rec[f] ?? 0) + 1;
    byCh.set(q.chapter, rec);
  }
  return { syllabus, byCh, subjectTotals };
}

async function countLiveForTopics(
  topicIds: number[],
  types: Array<{ id: number; field: string }>,
) {
  const totals: Record<string, number> = {};
  const seen = new Set<number>();
  for (const type of types) {
    let fieldCount = 0;
    for (const pri of PRIORITIES) {
      for (let i = 0; i < topicIds.length; i += CHUNK) {
        const chunk = topicIds.slice(i, i + CHUNK);
        const list = await getQuestions(chunk.join(","), type.id, pri);
        for (const q of list) {
          if (seen.has(q.QuestionID)) continue;
          seen.add(q.QuestionID);
          fieldCount += 1;
        }
        await sleep(25);
      }
    }
    totals[type.field] = fieldCount;
  }
  return totals;
}

async function main() {
  await login();

  // Confirm syllabus page loads subjects for Class 9
  const subjects =
    (
      (await getJson("/AjaxCalling/SubjectsListByClassID", {
        ClassID: 9,
      })) as { SubjectsList?: Array<{ SubjectID: number; SubjectName: string }> }
    ).SubjectsList || [];

  console.log(`\nSyllabus page OK — Class 9 subjects on PTS: ${subjects.length}`);

  const targetIds = Object.keys(SUBJECTS).map(Number);
  const found = subjects.filter((s) => targetIds.includes(s.SubjectID));
  console.log(
    `Target subjects found: ${found.length}/${targetIds.length} → ${found
      .map((s) => s.SubjectName)
      .join(", ")}`,
  );

  const missing = targetIds.filter((id) => !subjects.some((s) => s.SubjectID === id));
  if (missing.length) {
    console.log(`MISSING on PTS subject list: ${missing.join(", ")}`);
  }

  let issues = 0;

  for (const [idStr, cfg] of Object.entries(SUBJECTS)) {
    const subjectId = Number(idStr);
    const ptsSubject = subjects.find((s) => s.SubjectID === subjectId);
    const local = loadLocal(cfg.slug);
    console.log(`\n=== ${cfg.slug} (${ptsSubject?.SubjectName ?? "?"}) ===`);

    const hierarchy = (await getJson("/AjaxCalling/ChaptersListBySubjectID", {
      SubjectID: subjectId,
    })) as {
      ChaptersList?: Array<{ ChapterID: number; ChapterName: string; ChapterNo?: number }>;
      TopicsList?: Array<{ TopicID: number; ChapterID: number; TopicName: string }>;
    };

    const liveChapters = hierarchy.ChaptersList || [];
    const liveTopics = hierarchy.TopicsList || [];
    const localChapters = local.syllabus.chapters;

    const syllabusSame = liveChapters.length === localChapters.length;
    console.log(
      `Syllabus chapters: live=${liveChapters.length} local=${localChapters.length} → ${
        syllabusSame ? "SAME" : "DIFF"
      }`,
    );
    if (!syllabusSame) issues += 1;

    // Map live chapter order: prefer ChapterNo, else index+1
    const chapterTopicMap = new Map<number, number[]>();
    for (let i = 0; i < liveChapters.length; i++) {
      const ch = liveChapters[i]!;
      const num = ch.ChapterNo ?? i + 1;
      chapterTopicMap.set(
        num,
        liveTopics.filter((t) => t.ChapterID === ch.ChapterID).map((t) => t.TopicID),
      );
    }

    // All-chapters live totals
    const allTopicIds = liveTopics.map((t) => t.TopicID);
    const liveAll = await countLiveForTopics(allTopicIds, cfg.types);
    const liveFields = Object.keys(liveAll)
      .filter((f) => (liveAll[f] ?? 0) > 0)
      .sort();
    const localFields = Object.keys(local.subjectTotals)
      .filter((f) => (local.subjectTotals[f] ?? 0) > 0)
      .sort();

    const typesSame =
      liveFields.length === localFields.length &&
      liveFields.every((f, i) => f === localFields[i]);
    console.log(`All-chapters types live: ${liveFields.join(", ") || "none"}`);
    console.log(`All-chapters types local: ${localFields.join(", ") || "none"}`);
    console.log(`Types same? ${typesSame ? "YES" : "NO"}`);
    if (!typesSame) issues += 1;

    const countDiffs: string[] = [];
    for (const f of new Set([...liveFields, ...localFields])) {
      const lv = liveAll[f] ?? 0;
      const loc = local.subjectTotals[f] ?? 0;
      if (lv !== loc) countDiffs.push(`${f}: live ${lv} vs local ${loc}`);
    }
    if (countDiffs.length) {
      issues += 1;
      console.log("All-chapters count diffs:");
      for (const d of countDiffs) console.log(`  ${d}`);
    } else {
      console.log("All-chapters counts: MATCH");
    }

    // Per-chapter: type presence + counts (sample all chapters)
    let chapterTypeMismatch = 0;
    let chapterCountMismatch = 0;
    for (const ch of localChapters) {
      const topicIds = chapterTopicMap.get(ch.number) ?? [];
      if (topicIds.length === 0) {
        chapterTypeMismatch += 1;
        console.log(`  Ch ${ch.number}: no live topics`);
        continue;
      }
      const liveCh = await countLiveForTopics(topicIds, cfg.types);
      const localCh = local.byCh.get(ch.number) ?? {};
      const liveVis = cfg.types
        .map((t) => t.field)
        .filter((f) => (liveCh[f] ?? 0) > 0);
      const localVis = cfg.types
        .map((t) => t.field)
        .filter((f) => (localCh[f] ?? 0) > 0);
      const typeOk =
        liveVis.length === localVis.length &&
        liveVis.every((f, i) => f === localVis[i]);
      if (!typeOk) {
        chapterTypeMismatch += 1;
        if (chapterTypeMismatch <= 3) {
          console.log(
            `  Ch ${ch.number} type mismatch — live: ${liveVis.join(", ") || "none"} | local: ${localVis.join(", ") || "none"}`,
          );
        }
      }
      for (const t of cfg.types) {
        if ((liveCh[t.field] ?? 0) !== (localCh[t.field] ?? 0)) {
          chapterCountMismatch += 1;
          if (chapterCountMismatch <= 5) {
            console.log(
              `  Ch ${ch.number} ${t.field}: live ${liveCh[t.field] ?? 0} vs local ${localCh[t.field] ?? 0}`,
            );
          }
          break;
        }
      }
    }
    console.log(
      `Per-chapter: typeMismatches=${chapterTypeMismatch}, countMismatches=${chapterCountMismatch} / ${localChapters.length}`,
    );
    if (chapterTypeMismatch || chapterCountMismatch) issues += 1;
  }

  console.log(`\n=== DONE === issues=${issues}`);
  if (issues > 0) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
