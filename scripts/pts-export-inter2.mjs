/**
 * READ-ONLY PTS export for ALL PTB INTER-II (FSc / Intermediate Part 2) subjects.
 * Calls ONLY /AjaxCalling/GetQuestions (GET). NEVER SavePaper / CreatePaper.
 *
 * Usage:
 *   PTS_USER=... PTS_PASS=... node scripts/pts-export-inter2.mjs
 *   PTS_USER=... PTS_PASS=... node scripts/pts-export-inter2.mjs biology
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

const CLASS_ID = 12;
const CLASS_KEY = "12";
const ONLY_SLUG = process.argv[2] || null;
const PRIORITIES = [1, 2, 3, 4, 5];
const CHUNK = 8;

const STD = [
  { id: 1, name: "mcq", bankType: "mcq", field: "MCQ" },
  { id: 12, name: "short", bankType: "short", field: "QA" },
  { id: 13, name: "long", bankType: "long", field: "LONG" },
];

/** @type {Record<number, { slug: string; types: Array<{ id: number; name: string; bankType: 'mcq'|'short'|'long'; field: string }> }>} */
const SUBJECT_CONFIG = {
  116: { slug: "biology", types: STD },
  117: { slug: "chemistry", types: STD },
  118: { slug: "physics", types: STD },
  119: { slug: "mathematics", types: STD },
  120: { slug: "computer", types: STD },
  121: { slug: "statistics", types: STD },
  122: { slug: "economics", types: STD },
  123: {
    slug: "english",
    types: [
      { id: 1, name: "mcq-comprehension", bankType: "mcq", field: "COMPREHENSION" },
      { id: 2, name: "mcq-spelling", bankType: "mcq", field: "SPELLING" },
      { id: 3, name: "mcq-meaning", bankType: "mcq", field: "MEANING" },
      { id: 6, name: "mcq-grammar", bankType: "mcq", field: "GRAMMAR" },
      { id: 14, name: "short-qa", bankType: "short", field: "QA" },
      { id: 23, name: "short-di", bankType: "short", field: "DI" },
      { id: 34, name: "short-word", bankType: "short", field: "WORD" },
      { id: 35, name: "short-pair", bankType: "short", field: "PAIR" },
      { id: 27, name: "long-essays", bankType: "long", field: "ESSAYS" },
      { id: 28, name: "long-summary", bankType: "long", field: "SUMMARY" },
      { id: 43, name: "long-translate-urdu", bankType: "long", field: "TRANSLATE_UR" },
      { id: 47, name: "long-poem-stanzas", bankType: "long", field: "POEM_STANZA" },
    ],
  },
  124: { slug: "principles-of-accounting", types: STD },
  125: { slug: "principles-of-banking", types: STD },
  126: { slug: "commercial-geography", types: STD },
  127: { slug: "business-statistics", types: STD },
  128: { slug: "pakistan-studies", types: STD },
  129: {
    slug: "urdu-compulsory",
    types: [
      { id: 1, name: "mcq", bankType: "mcq", field: "MCQ" },
      { id: 14, name: "short-qa", bankType: "short", field: "QA" },
      { id: 19, name: "long-poem", bankType: "long", field: "POEM" },
      { id: 28, name: "long-summary", bankType: "long", field: "SUMMARY" },
      { id: 48, name: "long-passage", bankType: "long", field: "PASSAGE" },
    ],
  },
  130: { slug: "education", types: STD },
  131: { slug: "civics", types: STD },
  132: {
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
  133: {
    slug: "islamiyat-elective",
    types: [
      { id: 1, name: "mcq", bankType: "mcq", field: "MCQ" },
      { id: 12, name: "short", bankType: "short", field: "QA" },
      { id: 17, name: "long-ayat", bankType: "long", field: "AYAT" },
    ],
  },
  134: { slug: "physical-education", types: STD },
  135: { slug: "sociology", types: STD },
  136: { slug: "ethics", types: STD },
  137: {
    slug: "tarjuma-quran",
    types: [
      { id: 1, name: "mcq", bankType: "mcq", field: "MCQ" },
      { id: 12, name: "short", bankType: "short", field: "QA" },
      { id: 13, name: "long", bankType: "long", field: "LONG" },
      { id: 17, name: "long-ayat", bankType: "long", field: "AYAT" },
      { id: 37, name: "short-meaning", bankType: "short", field: "MEANING" },
    ],
  },
  260: { slug: "psychology", types: STD },
  338: { slug: "persian", types: STD },
  342: { slug: "history-of-islam", types: STD },
  368: { slug: "hadeeqatul-adab", types: STD },
  438: { slug: "human-geography", types: STD },
  453: { slug: "library-science", types: STD },
  492: { slug: "history-of-pakistan", types: STD },
  1535: { slug: "home-economics", types: STD },
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

function slugifyFallback(name, id) {
  const ascii = String(name)
    .normalize("NFKD")
    .replace(/[^\x00-\x7F]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return ascii || `subject-${id}`;
}

async function exportSubject(subject) {
  const cfg = SUBJECT_CONFIG[subject.SubjectID] || {
    slug: slugifyFallback(subject.SubjectName, subject.SubjectID),
    types: STD,
  };
  if (ONLY_SLUG && cfg.slug !== ONLY_SLUG) return null;

  const outDir = path.join(
    process.cwd(),
    "data",
    "lahore-board",
    "12th",
    cfg.slug,
    "pts-raw",
  );
  fs.mkdirSync(outDir, { recursive: true });
  console.log(`\n=== INTER-II ${subject.SubjectName} (${cfg.slug}) ===`);

  const hierarchy = await getJson("/AjaxCalling/ChaptersListBySubjectID", {
    SubjectID: subject.SubjectID,
  });
  fs.writeFileSync(
    path.join(outDir, "hierarchy.json"),
    JSON.stringify(
      {
        course: { CourseID: 1, name: "PTB" },
        class: { ClassID: CLASS_ID, name: "INTER-II" },
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
          class: CLASS_KEY,
          className: "INTER-II",
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
    (await getJson("/AjaxCalling/SubjectsListByClassID", { ClassID: CLASS_ID }))
      .SubjectsList || [];
  console.log(`Found ${subjects.length} INTER-II subjects`);

  const summary = [];
  for (const sub of subjects) {
    const cfg = SUBJECT_CONFIG[sub.SubjectID];
    if (ONLY_SLUG && cfg && cfg.slug !== ONLY_SLUG) continue;
    if (ONLY_SLUG && !cfg) continue;
    const result = await exportSubject(sub);
    if (result) summary.push(result);
  }

  const root = path.join(process.cwd(), "data", "lahore-board", "12th");
  fs.mkdirSync(root, { recursive: true });
  fs.writeFileSync(
    path.join(root, "_export-summary.json"),
    JSON.stringify(summary, null, 2),
  );
  console.log("\nDONE summary:");
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
