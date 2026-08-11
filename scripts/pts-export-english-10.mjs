/**
 * READ-ONLY PTS export for PTB Class 10 English.
 * Calls ONLY /AjaxCalling/GetQuestions (GET). NEVER SavePaper / CreatePaper.
 *
 * Usage:
 *   PTS_USER=... PTS_PASS=... node scripts/pts-export-english-10.mjs
 *
 * QuestionSubTypeID map (English-specific):
 *   1  = MCQ comprehension
 *   2  = MCQ spelling
 *   3  = MCQ meaning
 *   5  = MCQ verb forms
 *   6  = MCQ grammar (figures of speech etc.) — exported, type MCQ
 *  14  = SHORT Q&A
 *  23  = SHORT Direct & Indirect
 *  27  = LONG Essays
 *  28  = LONG Summary
 *  35  = SHORT Pair of Words
 *  43  = LONG Translate into Urdu
 *  44  = LONG Translate into English
 *  47  = LONG Poem stanzas
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

const OUT_DIR = path.join(
  process.cwd(),
  "data",
  "lahore-board",
  "10th",
  "english",
  "pts-raw",
);

/** @type {Array<{ id: number; name: string; bankType: 'mcq'|'short'|'long'; field: string; priorities: number[] }>} */
const EXPORT_TYPES = [
  { id: 1, name: "mcq-comprehension", bankType: "mcq", field: "COMPREHENSION", priorities: [1, 2, 3, 4, 5] },
  { id: 2, name: "mcq-spelling", bankType: "mcq", field: "SPELLING", priorities: [1, 2, 3, 4, 5] },
  { id: 3, name: "mcq-meaning", bankType: "mcq", field: "MEANING", priorities: [1, 2, 3, 4, 5] },
  { id: 5, name: "mcq-verb", bankType: "mcq", field: "VERB", priorities: [1, 2, 3, 4, 5] },
  { id: 6, name: "mcq-grammar", bankType: "mcq", field: "GRAMMAR", priorities: [1, 2, 3, 4, 5] },
  { id: 14, name: "short-qa", bankType: "short", field: "QA", priorities: [1, 2, 3, 4, 5] },
  { id: 23, name: "short-di", bankType: "short", field: "DI", priorities: [1, 2, 3, 4, 5, 6, 7, 8] },
  { id: 35, name: "short-pair", bankType: "short", field: "PAIR", priorities: [1, 2, 3, 4, 5] },
  { id: 27, name: "long-essays", bankType: "long", field: "ESSAYS", priorities: [1, 2, 3, 4, 5] },
  { id: 28, name: "long-summary", bankType: "long", field: "SUMMARY", priorities: [1, 2, 3, 4, 5] },
  { id: 43, name: "long-translate-urdu", bankType: "long", field: "TRANSLATE_UR", priorities: [1, 2, 3, 4, 5] },
  { id: 44, name: "long-translate-english", bankType: "long", field: "TRANSLATE_EN", priorities: [1, 2, 3, 4, 5] },
  { id: 47, name: "long-poem-stanzas", bankType: "long", field: "POEM_STANZA", priorities: [1, 2, 3, 4, 5] },
];

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

async function getQuestions(topicIds, subTypeId, priorityId, syllabusType) {
  const u = new URL(`${BASE}/AjaxCalling/GetQuestions`);
  u.searchParams.set("TopicIDs", topicIds);
  u.searchParams.set("QuestionSubTypeID", String(subTypeId));
  u.searchParams.set("QuestionPeriorityID", String(priorityId));
  u.searchParams.set("SyllabusType", String(syllabusType));
  const res = await req(u.toString());
  const text = await res.text();
  if (!res.ok) {
    console.warn(
      `GetQuestions fail type=${subTypeId} pri=${priorityId}: ${res.status}`,
    );
    return [];
  }
  const json = JSON.parse(text);
  return json.QuestionsList || [];
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  await login();

  const classes = await getJson("/AjaxCalling/ClassesListByCourseID", {
    CourseID: 1,
  });
  const class10 = (classes.ClassesList || []).find((c) => c.ClassID === 10);
  if (!class10) throw new Error("Class 10 not found");

  const subjects = await getJson("/AjaxCalling/SubjectsListByClassID", {
    ClassID: 10,
  });
  const english = (subjects.SubjectsList || []).find((s) =>
    /^english$/i.test(String(s.SubjectName).trim()),
  );
  if (!english) throw new Error("English subject not found");

  const hierarchy = await getJson("/AjaxCalling/ChaptersListBySubjectID", {
    SubjectID: english.SubjectID,
  });
  fs.writeFileSync(
    path.join(OUT_DIR, "hierarchy.json"),
    JSON.stringify(
      {
        course: { CourseID: 1, name: "PTB" },
        class: class10,
        subject: english,
        chapters: hierarchy.ChaptersList,
        topics: hierarchy.TopicsList,
        exportTypes: EXPORT_TYPES,
      },
      null,
      2,
    ),
  );

  const topics = hierarchy.TopicsList || [];
  /** @type {Record<string, any[]>} */
  const buckets = {};
  /** @type {Record<string, Set<number>>} */
  const seen = {};
  for (const t of EXPORT_TYPES) {
    buckets[t.name] = [];
    seen[t.name] = new Set();
  }

  const CHUNK = 8;
  for (const type of EXPORT_TYPES) {
    for (const pri of type.priorities) {
      for (let i = 0; i < topics.length; i += CHUNK) {
        const chunk = topics.slice(i, i + CHUNK);
        const ids = chunk.map((t) => t.TopicID).join(",");
        process.stdout.write(
          `\rFetch ${type.name} pri=${pri} topics ${i + 1}-${Math.min(i + CHUNK, topics.length)}/${topics.length}   `,
        );
        let list = [];
        try {
          list = await getQuestions(ids, type.id, pri, 0);
        } catch (e) {
          console.warn("\n", e.message);
        }
        for (const q of list) {
          const key = q.QuestionID;
          if (seen[type.name].has(key)) continue;
          seen[type.name].add(key);
          buckets[type.name].push({
            ...q,
            _exportMeta: {
              subTypeId: type.id,
              bankType: type.bankType,
              field: type.field,
              exportName: type.name,
            },
          });
        }
        await sleep(100);
      }
    }
  }
  console.log("");

  const totals = {};
  for (const type of EXPORT_TYPES) {
    const file = path.join(OUT_DIR, `${type.name}-raw.json`);
    fs.writeFileSync(
      file,
      JSON.stringify(
        {
          board: "Lahore",
          course: "PTB",
          class: "10",
          subject: "English",
          type: type.bankType,
          field: type.field,
          subTypeId: type.id,
          total: buckets[type.name].length,
          exportedAt: new Date().toISOString(),
          source: "paktestsolution.com AjaxCalling/GetQuestions (read-only)",
          questions: buckets[type.name],
        },
        null,
        2,
      ),
    );
    totals[type.name] = buckets[type.name].length;
    console.log(`Wrote ${type.name}: ${buckets[type.name].length}`);
  }

  console.log("DONE totals", totals);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
