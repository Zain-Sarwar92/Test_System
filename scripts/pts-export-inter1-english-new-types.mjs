/**
 * Export SYNONYM (TypeID=4) and PUNCTUATION (TypeID=46) questions
 * for Class 11 & 12 English from PTS.
 *
 * Usage:
 *   PTS_USER=03334404102 PTS_PASS=AlhadiSchlAc7860 node scripts/pts-export-inter1-english-new-types.mjs
 */
import fs from "node:fs";
import path from "node:path";

const BASE = "https://www.paktestsolution.com";
const USER = process.env.PTS_USER;
const PASS = process.env.PTS_PASS;
if (!USER || !PASS) { console.error("Set PTS_USER and PTS_PASS"); process.exit(1); }

const TYPES = [
  { id: 4,  name: "mcq-synonym",     bankType: "mcq",  field: "SYNONYM",      subType: "SYNONYM" },
  { id: 46, name: "long-punctuation", bankType: "long", field: "PUNCTUATION",   subType: "PUNCTUATION" },
];
const CLASSES = [
  { classId: 11, subjectId: 101, slug: "english", outDir: "11th" },
  { classId: 12, subjectId: 123, slug: "english", outDir: "12th" },
];
const PRIORITIES = [1, 2, 3, 4, 5];

const jar = new Map();
function storeCookies(res) {
  for (const c of res.headers.getSetCookie?.() || []) {
    const [pair] = c.split(";");
    const eq = pair.indexOf("=");
    if (eq > 0) jar.set(pair.slice(0, eq), pair.slice(eq + 1));
  }
}
const cookieHeader = () => [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");

async function req(url, opts = {}) {
  const headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122 Safari/537.36",
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
  console.log("Logged in");
}

async function getQuestions(topicIds, subTypeId, priorityId) {
  const u = new URL(`${BASE}/AjaxCalling/GetQuestions`);
  u.searchParams.set("TopicIDs", topicIds);
  u.searchParams.set("QuestionSubTypeID", String(subTypeId));
  u.searchParams.set("QuestionPeriorityID", String(priorityId));
  u.searchParams.set("SyllabusType", "1"); // Full syllabus
  const res = await req(u.toString());
  if (!res.ok) return [];
  const data = JSON.parse(await res.text());
  return data.QuestionsList || [];
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function exportForClass({ classId, subjectId, slug, outDir }) {
  console.log(`\n=== Class ${classId} English (SubjectID=${subjectId}) ===`);

  const hier = await (await req(`${BASE}/AjaxCalling/ChaptersListBySubjectID?SubjectID=${subjectId}`)).json();
  const chapters = hier.ChaptersList || [];
  const topics = hier.TopicsList || [];
  console.log(`  ${chapters.length} chapters, ${topics.length} topics`);

  const CHUNK = 8;
  const results = {};

  for (const type of TYPES) {
    console.log(`\n  Fetching ${type.name} (TypeID=${type.id})...`);
    const bucket = [];
    const seen = new Set();

    for (const pri of PRIORITIES) {
      for (let i = 0; i < topics.length; i += CHUNK) {
        const chunk = topics.slice(i, i + CHUNK);
        const ids = chunk.map(t => t.TopicID).join(",");
        process.stdout.write(`\r    pri=${pri} topics ${i+1}-${Math.min(i+CHUNK, topics.length)}/${topics.length}   `);
        try {
          const qs = await getQuestions(ids, type.id, pri);
          for (const q of qs) {
            if (seen.has(q.QuestionID)) continue;
            seen.add(q.QuestionID);
            // Find which chapter this topic belongs to
            const topic = topics.find(t => t.TopicID === q.TopicID);
            const chapter = chapters.find(c => c.ChapterID === topic?.ChapterID);
            bucket.push({ ...q, _meta: { field: type.field, subType: type.subType, bankType: type.bankType, chapterNo: chapter?.ChapterNo, chapterName: chapter?.ChapterName, topicName: topic?.TopicName } });
          }
        } catch (e) { console.warn("\n  ", e.message); }
        await sleep(80);
      }
    }
    console.log(`\n  ${type.name}: ${bucket.length} questions`);
    results[type.name] = bucket;
  }

  // Save raw export
  const outPath = path.join(process.cwd(), "data", "lahore-board", outDir, slug, "pts-raw");
  fs.mkdirSync(outPath, { recursive: true });
  
  for (const [name, qs] of Object.entries(results)) {
    const file = path.join(outPath, `${name}-raw.json`);
    fs.writeFileSync(file, JSON.stringify({ classId, subjectId, slug, questions: qs }, null, 2));
    console.log(`  Saved: ${file} (${qs.length} questions)`);
  }

  return results;
}

async function main() {
  await login();
  
  for (const cls of CLASSES) {
    await exportForClass(cls);
  }

  console.log("\nExport complete. Now run: node scripts/pts-import-inter-english-new-types.mjs");
}

main().catch(console.error);
