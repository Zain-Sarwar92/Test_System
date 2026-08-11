/**
 * Export Class 10 core science subjects that previously lacked PTS raw/media:
 * Biology(59), Computer(60), Chemistry(61), Physics(62).
 *
 * Usage:
 *   PTS_USER=... PTS_PASS=... node scripts/pts-export-class10-core.mjs
 *   PTS_USER=... PTS_PASS=... node scripts/pts-export-class10-core.mjs biology
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

const ONLY = process.argv[2] || null;
const PRIORITIES = [1, 2, 3, 4, 5];
const CHUNK = 8;
const STD = [
  { id: 1, name: "mcq", bankType: "mcq", field: "MCQ" },
  { id: 12, name: "short", bankType: "short", field: "QA" },
  { id: 13, name: "long", bankType: "long", field: "LONG" },
];

const SUBJECT_CONFIG = {
  59: { slug: "biology", types: STD },
  60: { slug: "computer", types: STD },
  61: { slug: "chemistry", types: STD },
  62: { slug: "physics", types: STD },
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
  console.log("Logged in (read-only)");
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

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function exportSubject(subject, cfg) {
  const outDir = path.join(
    process.cwd(),
    "data",
    "lahore-board",
    "10th",
    cfg.slug,
    "pts-raw",
  );
  fs.mkdirSync(outDir, { recursive: true });
  console.log(`\n=== Class 10 ${subject.SubjectName} (${cfg.slug}) ===`);

  const hierarchy = await getJson("/AjaxCalling/ChaptersListBySubjectID", {
    SubjectID: subject.SubjectID,
  });
  fs.writeFileSync(
    path.join(outDir, "hierarchy.json"),
    JSON.stringify(
      {
        course: { CourseID: 1, name: "PTB" },
        class: { ClassID: 10 },
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
        await sleep(60);
      }
    }
    console.log("");
    fs.writeFileSync(
      path.join(outDir, `${type.name}-raw.json`),
      JSON.stringify(
        {
          board: "Lahore",
          course: "PTB",
          class: "10",
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
    (await getJson("/AjaxCalling/SubjectsListByClassID", { ClassID: 10 }))
      .SubjectsList || [];
  const summary = [];
  for (const sub of subjects) {
    const cfg = SUBJECT_CONFIG[sub.SubjectID];
    if (!cfg) continue;
    if (ONLY && cfg.slug !== ONLY) continue;
    summary.push(await exportSubject(sub, cfg));
  }
  console.log("\nDONE Class 10 core summary:");
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
