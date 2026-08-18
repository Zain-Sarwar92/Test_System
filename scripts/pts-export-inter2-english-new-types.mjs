/**
 * Export SYNONYM (4) and PUNCTUATION (46) for Class 12 English (SubjectID=123)
 * Usage: PTS_USER=03334404102 PTS_PASS=AlhadiSchlAc7860 node scripts/pts-export-inter2-english-new-types.mjs
 */
import fs from "node:fs";
import path from "node:path";

const BASE = "https://www.paktestsolution.com";
const USER = process.env.PTS_USER;
const PASS = process.env.PTS_PASS;
if (!USER || !PASS) { console.error("Set PTS_USER and PTS_PASS"); process.exit(1); }

const SUBJECT_ID = 123;
const TYPES = [
  { id: 4,  name: "mcq-synonym",      field: "SYNONYM",     bankType: "mcq" },
  { id: 46, name: "long-punctuation", field: "PUNCTUATION", bankType: "long" },
  { id: 43, name: "long-translate-urdu", field: "TRANSLATE_UR", bankType: "long" },
];
const PRIORITIES = [1, 2, 3, 4, 5];
const CHUNK = 8;

const jar = new Map();
function sc(res) {
  for (const c of res.headers.getSetCookie?.() || []) {
    const [pair] = c.split(";");
    const eq = pair.indexOf("=");
    if (eq > 0) jar.set(pair.slice(0, eq), pair.slice(eq + 1));
  }
}
const ch = () => [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
async function req(url) {
  const h = { "User-Agent": "Mozilla/5.0", "X-Requested-With": "XMLHttpRequest" };
  if (jar.size) h.Cookie = ch();
  const res = await fetch(url, { headers: h, redirect: "manual" });
  sc(res);
  return res;
}

async function login() {
  const u = new URL(`${BASE}/Home/CheckLogin`);
  u.searchParams.set("emailAddress", USER);
  u.searchParams.set("password", PASS);
  const json = await (await req(u.toString())).json();
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
  u.searchParams.set("SyllabusType", "1");
  const res = await req(u.toString());
  if (!res.ok) return [];
  return (JSON.parse(await res.text()).QuestionsList) || [];
}

async function main() {
  await login();
  const hier = JSON.parse(
    await (await req(`${BASE}/AjaxCalling/ChaptersListBySubjectID?SubjectID=${SUBJECT_ID}`)).text(),
  );
  const chapters = hier.ChaptersList || [];
  const topics = hier.TopicsList || [];
  console.log(`${chapters.length} chapters, ${topics.length} topics`);

  const outDir = path.join(process.cwd(), "data", "lahore-board", "12th", "english", "pts-raw");
  fs.mkdirSync(outDir, { recursive: true });

  // Save hierarchy if missing or refresh
  fs.writeFileSync(
    path.join(outDir, "hierarchy.json"),
    JSON.stringify({ chapters, topics, subjectId: SUBJECT_ID }, null, 2),
  );

  for (const type of TYPES) {
    const bucket = [];
    const seen = new Set();
    for (const pri of PRIORITIES) {
      for (let i = 0; i < topics.length; i += CHUNK) {
        const chunk = topics.slice(i, i + CHUNK);
        const ids = chunk.map((t) => t.TopicID).join(",");
        process.stdout.write(`\r  ${type.name} pri=${pri} ${i + 1}-${Math.min(i + CHUNK, topics.length)}/${topics.length}   `);
        const list = await getQuestions(ids, type.id, pri);
        for (const q of list) {
          if (seen.has(q.QuestionID)) continue;
          seen.add(q.QuestionID);
          const topic = topics.find((t) => t.TopicID === q.TopicID);
          const chapter = chapters.find((c) => c.ChapterID === topic?.ChapterID);
          bucket.push({
            ...q,
            _meta: {
              field: type.field,
              subType: type.field,
              bankType: type.bankType,
              chapterName: chapter?.ChapterName,
              topicName: topic?.TopicName,
            },
          });
        }
        await new Promise((r) => setTimeout(r, 80));
      }
    }
    console.log(`\n  ${type.name}: ${bucket.length}`);
    fs.writeFileSync(
      path.join(outDir, `${type.name}-raw.json`),
      JSON.stringify({ classId: 12, subjectId: SUBJECT_ID, questions: bucket }, null, 2),
    );
  }
}

main().catch(console.error);
