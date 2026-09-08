/**
 * READ-ONLY PTS export for ALL PTB Class 9 subjects.
 * Calls ONLY /AjaxCalling/GetQuestions (GET). NEVER SavePaper.
 *
 * Usage:
 *   PTS_USER=... PTS_PASS=... node scripts/pts-export-class9.mjs
 *   PTS_USER=... PTS_PASS=... node scripts/pts-export-class9.mjs english
 */
import fs from "node:fs";
import path from "node:path";

const BASE = "https://www.paktestsolution.com";
const USER = process.env.PTS_USER;
const PASS = process.env.PTS_PASS;
if (!USER || !PASS) {
  console.error("Set PTS_USER and PTS_PASS env vars");
  process.exit(1);
}

const ONLY_SLUG = process.argv[2] || null;
const PRIORITIES = [1, 2, 3, 4, 5];
const CHUNK = 8;

/** @type {Record<number, { slug: string; types: Array<{ id: number; name: string; bankType: 'mcq'|'short'|'long'; field: string }> }>} */
const SUBJECT_CONFIG = {
  43: {
    slug: "biology",
    types: [
      { id: 1, name: "mcq", bankType: "mcq", field: "MCQ" },
      { id: 12, name: "short", bankType: "short", field: "QA" },
      { id: 13, name: "long", bankType: "long", field: "LONG" },
    ],
  },
  44: {
    slug: "computer",
    types: [
      { id: 1, name: "mcq", bankType: "mcq", field: "MCQ" },
      { id: 12, name: "short", bankType: "short", field: "QA" },
      { id: 13, name: "long", bankType: "long", field: "LONG" },
    ],
  },
  45: {
    slug: "chemistry",
    types: [
      { id: 1, name: "mcq", bankType: "mcq", field: "MCQ" },
      { id: 12, name: "short", bankType: "short", field: "QA" },
      { id: 13, name: "long", bankType: "long", field: "LONG" },
    ],
  },
  46: {
    slug: "physics",
    types: [
      { id: 1, name: "mcq", bankType: "mcq", field: "MCQ" },
      { id: 12, name: "short", bankType: "short", field: "QA" },
      { id: 13, name: "long", bankType: "long", field: "LONG" },
    ],
  },
  47: {
    slug: "mathematics",
    types: [
      { id: 1, name: "mcq", bankType: "mcq", field: "MCQ" },
      { id: 12, name: "short", bankType: "short", field: "QA" },
      { id: 13, name: "long", bankType: "long", field: "LONG" },
    ],
  },
  48: {
    slug: "english",
    types: [
      { id: 1, name: "mcq-comprehension", bankType: "mcq", field: "COMPREHENSION" },
      { id: 2, name: "mcq-spelling", bankType: "mcq", field: "SPELLING" },
      { id: 3, name: "mcq-meaning", bankType: "mcq", field: "MEANING" },
      { id: 5, name: "mcq-verb", bankType: "mcq", field: "VERB" },
      { id: 6, name: "mcq-grammar", bankType: "mcq", field: "GRAMMAR" },
      { id: 14, name: "short-qa", bankType: "short", field: "QA" },
      { id: 15, name: "long-letters", bankType: "long", field: "LETTER" },
      { id: 21, name: "short-translate-en", bankType: "short", field: "TRANSLATE_EN" },
      { id: 22, name: "short-voice", bankType: "short", field: "VOICE" },
      { id: 26, name: "long-stories", bankType: "long", field: "STORY" },
      { id: 28, name: "long-summary", bankType: "long", field: "SUMMARY" },
      { id: 31, name: "long-dialogues", bankType: "long", field: "DIALOGUE" },
      { id: 34, name: "short-word", bankType: "short", field: "WORD" },
      { id: 36, name: "short-idioms", bankType: "short", field: "IDIOM" },
      { id: 43, name: "long-translate-urdu", bankType: "long", field: "TRANSLATE_UR" },
      { id: 45, name: "long-comprehension-para", bankType: "long", field: "PASSAGE" },
      { id: 47, name: "long-poem-stanzas", bankType: "long", field: "POEM_STANZA" },
    ],
  },
  50: {
    slug: "urdu-compulsory",
    types: [
      { id: 1, name: "mcq", bankType: "mcq", field: "MCQ" },
      { id: 14, name: "short-qa", bankType: "short", field: "QA" },
      {
        id: 24,
        name: "short-correct",
        bankType: "short",
        field: "CORRECT",
      },
      { id: 25, name: "short-idiom", bankType: "short", field: "IDIOM" },
      { id: 42, name: "short-meaning", bankType: "short", field: "MEANING" },
      { id: 19, name: "long-poem", bankType: "long", field: "POEM" },
      { id: 28, name: "long-summary", bankType: "long", field: "SUMMARY" },
      { id: 48, name: "long-passage", bankType: "long", field: "PASSAGE" },
      { id: 15, name: "long-letter", bankType: "long", field: "LETTER" },
      {
        id: 16,
        name: "long-application",
        bankType: "long",
        field: "APPLICATION",
      },
      { id: 26, name: "long-story", bankType: "long", field: "STORY" },
      { id: 31, name: "long-dialogue", bankType: "long", field: "DIALOGUE" },
      {
        id: 30,
        name: "long-central",
        bankType: "long",
        field: "CENTRAL",
      },
    ],
  },
  51: {
    slug: "islamiyat-compulsory",
    types: [
      { id: 1, name: "mcq", bankType: "mcq", field: "MCQ" },
      { id: 12, name: "short", bankType: "short", field: "QA" },
      { id: 13, name: "long", bankType: "long", field: "LONG" },
      { id: 18, name: "long-hadith", bankType: "long", field: "HADITH" },
      {
        id: 57,
        name: "long-personality",
        bankType: "long",
        field: "PERSONALITY",
      },
    ],
  },
  52: {
    slug: "general-science",
    types: [
      { id: 1, name: "mcq", bankType: "mcq", field: "MCQ" },
      { id: 12, name: "short", bankType: "short", field: "QA" },
      { id: 13, name: "long", bankType: "long", field: "LONG" },
    ],
  },
  54: {
    slug: "education",
    types: [
      { id: 1, name: "mcq", bankType: "mcq", field: "MCQ" },
      { id: 12, name: "short", bankType: "short", field: "QA" },
      { id: 13, name: "long", bankType: "long", field: "LONG" },
    ],
  },
  55: {
    slug: "punjabi",
    types: [
      { id: 1, name: "mcq", bankType: "mcq", field: "MCQ" },
      { id: 14, name: "short-qa", bankType: "short", field: "QA" },
      { id: 19, name: "long-poem", bankType: "long", field: "POEM" },
      { id: 28, name: "long-summary", bankType: "long", field: "SUMMARY" },
      { id: 34, name: "short-meaning", bankType: "short", field: "MEANING" },
      { id: 37, name: "short-word", bankType: "short", field: "WORD" },
      { id: 38, name: "short-idiom", bankType: "short", field: "IDIOM" },
      { id: 48, name: "long-passage", bankType: "long", field: "PASSAGE" },
    ],
  },
  56: {
    slug: "islamiyat-elective",
    types: [
      { id: 1, name: "mcq", bankType: "mcq", field: "MCQ" },
      { id: 12, name: "short", bankType: "short", field: "QA" },
      { id: 17, name: "long-ayat", bankType: "long", field: "AYAT" },
    ],
  },
  57: {
    slug: "home-economics",
    types: [
      { id: 1, name: "mcq", bankType: "mcq", field: "MCQ" },
      { id: 12, name: "short", bankType: "short", field: "QA" },
      { id: 13, name: "long", bankType: "long", field: "LONG" },
    ],
  },
  58: {
    slug: "civics",
    types: [
      { id: 1, name: "mcq", bankType: "mcq", field: "MCQ" },
      { id: 12, name: "short", bankType: "short", field: "QA" },
      { id: 13, name: "long", bankType: "long", field: "LONG" },
    ],
  },
  257: {
    slug: "economics",
    types: [
      { id: 1, name: "mcq", bankType: "mcq", field: "MCQ" },
      { id: 12, name: "short", bankType: "short", field: "QA" },
      { id: 13, name: "long", bankType: "long", field: "LONG" },
    ],
  },
  308: {
    slug: "tarjuma-quran",
    types: [
      { id: 1, name: "mcq", bankType: "mcq", field: "MCQ" },
      { id: 12, name: "short", bankType: "short", field: "QA" },
      { id: 13, name: "long", bankType: "long", field: "LONG" },
      { id: 17, name: "long-ayat", bankType: "long", field: "AYAT" },
      { id: 37, name: "short-meaning", bankType: "short", field: "WORD" },
    ],
  },
  311: {
    slug: "ethics",
    types: [
      { id: 1, name: "mcq", bankType: "mcq", field: "MCQ" },
      { id: 12, name: "short", bankType: "short", field: "QA" },
      { id: 13, name: "long", bankType: "long", field: "LONG" },
    ],
  },
  335: {
    slug: "physical-education",
    types: [
      { id: 1, name: "mcq", bankType: "mcq", field: "MCQ" },
      { id: 12, name: "short", bankType: "short", field: "QA" },
      { id: 13, name: "long", bankType: "long", field: "LONG" },
    ],
  },
  339: {
    slug: "poultry",
    types: [
      { id: 1, name: "mcq", bankType: "mcq", field: "MCQ" },
      { id: 12, name: "short", bankType: "short", field: "QA" },
      { id: 13, name: "long", bankType: "long", field: "LONG" },
    ],
  },
  1536: {
    slug: "food-nutrition",
    types: [
      { id: 1, name: "mcq", bankType: "mcq", field: "MCQ" },
      { id: 12, name: "short", bankType: "short", field: "QA" },
      { id: 13, name: "long", bankType: "long", field: "LONG" },
    ],
  },
};

const jar = new Map();
function storeCookies(res) {
  for (const c of res.headers.getSetCookie?.() || []) {
    const [pair] = c.split(";");
    const eq = pair.indexOf("=");
    if (eq > 0) jar.set(pair.slice(0, eq), pair.slice(eq + 1));
  }
}
const cookieHeader = () =>
  [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");

async function req(url, opts = {}) {
  const headers = {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122 Safari/537.36",
    Accept: "*/*",
    "X-Requested-With": "XMLHttpRequest",
    ...(opts.headers || {}),
  };
  if (jar.size) headers.Cookie = cookieHeader();
  const res = await fetch(url, { ...opts, headers, redirect: "manual" });
  storeCookies(res);
  return res;
}

async function login() {
  const u = new URL(`${BASE}/Home/CheckLogin`);
  u.searchParams.set("emailAddress", USER);
  u.searchParams.set("password", PASS);
  const json = await (await req(u)).json();
  if (!json.IsValid) throw new Error(`Login failed: ${json.html}`);
  await req(`${BASE}${json.html}`);
  await req(`${BASE}/GeneratePaper/GetSyllabus`);
  console.log("Logged in (read-only session)");
}

async function getJson(apiPath, params) {
  const u = new URL(BASE + apiPath);
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, String(v));
  const res = await req(u.toString());
  const text = await res.text();
  if (!res.ok) throw new Error(`${apiPath} ${res.status}: ${text.slice(0, 200)}`);
  return JSON.parse(text);
}

async function getQuestions(topicIds, subTypeId, priorityId) {
  const u = new URL(`${BASE}/AjaxCalling/GetQuestions`);
  u.searchParams.set("TopicIDs", topicIds);
  u.searchParams.set("QuestionSubTypeID", String(subTypeId));
  u.searchParams.set("QuestionPeriorityID", String(priorityId));
  u.searchParams.set("SyllabusType", "0");
  const res = await req(u.toString());
  if (!res.ok) return [];
  return JSON.parse(await res.text()).QuestionsList || [];
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function exportSubject(subject, cfg) {
  if (ONLY_SLUG && cfg.slug !== ONLY_SLUG) return null;

  const outDir = path.join(
    process.cwd(),
    "data",
    "lahore-board",
    "9th",
    cfg.slug,
    "pts-raw",
  );
  fs.mkdirSync(outDir, { recursive: true });
  console.log(`\n=== Class 9 ${subject.SubjectName} (${cfg.slug}) ===`);

  const hierarchy = await getJson("/AjaxCalling/ChaptersListBySubjectID", {
    SubjectID: subject.SubjectID,
  });
  fs.writeFileSync(
    path.join(outDir, "hierarchy.json"),
    JSON.stringify(
      {
        course: { CourseID: 1, name: "PTB" },
        class: { ClassID: 9 },
        subject,
        slug: cfg.slug,
        exportTypes: cfg.types,
        chapters: hierarchy.ChaptersList,
        topics: hierarchy.TopicsList,
      },
      null,
      2,
    ),
  );

  const topics = hierarchy.TopicsList || [];
  const totals = {};

  for (const type of cfg.types) {
    const bucket = [];
    const seen = new Set();
    for (const pri of PRIORITIES) {
      for (let i = 0; i < topics.length; i += CHUNK) {
        const chunk = topics.slice(i, i + CHUNK);
        const ids = chunk.map((t) => t.TopicID).join(",");
        process.stdout.write(
          `\r  ${type.name} pri=${pri} topics ${i + 1}-${Math.min(i + CHUNK, topics.length)}/${topics.length}   `,
        );
        let list = [];
        try {
          list = await getQuestions(ids, type.id, pri);
        } catch (e) {
          console.warn("\n", e.message);
        }
        for (const q of list) {
          if (seen.has(q.QuestionID)) continue;
          seen.add(q.QuestionID);
          bucket.push({
            ...q,
            _exportMeta: {
              subTypeId: type.id,
              bankType: type.bankType,
              field: type.field,
              exportName: type.name,
            },
          });
        }
        await sleep(80);
      }
    }
    console.log("");
    fs.writeFileSync(
      path.join(outDir, `${type.name}-raw.json`),
      JSON.stringify(
        {
          board: "Lahore",
          course: "PTB",
          class: "9",
          subject: subject.SubjectName,
          slug: cfg.slug,
          type: type.bankType,
          field: type.field,
          exportName: type.name,
          subTypeId: type.id,
          total: bucket.length,
          exportedAt: new Date().toISOString(),
          source: "paktestsolution.com AjaxCalling/GetQuestions (read-only)",
          questions: bucket,
        },
        null,
        2,
      ),
    );
    totals[type.name] = bucket.length;
    console.log(`  Wrote ${type.name}: ${bucket.length}`);
  }

  return { slug: cfg.slug, name: subject.SubjectName, totals };
}

async function main() {
  await login();
  const subjects =
    (await getJson("/AjaxCalling/SubjectsListByClassID", { ClassID: 9 }))
      .SubjectsList || [];
  const summary = [];
  for (const sub of subjects) {
    const cfg = SUBJECT_CONFIG[sub.SubjectID];
    if (!cfg) {
      console.warn(`No config for subject ${sub.SubjectID} ${sub.SubjectName}`);
      continue;
    }
    const result = await exportSubject(sub, cfg);
    if (result) summary.push(result);
  }
  console.log("\nDONE Class 9 summary:");
  console.log(JSON.stringify(summary, null, 2));
  fs.mkdirSync(path.join(process.cwd(), "data", "lahore-board", "9th"), {
    recursive: true,
  });
  fs.writeFileSync(
    path.join(process.cwd(), "data", "lahore-board", "9th", "_export-summary.json"),
    JSON.stringify(summary, null, 2),
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
