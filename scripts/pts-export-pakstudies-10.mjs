/**
 * READ-ONLY PTS export for PTB Class 10 Pakistan Studies.
 * Calls ONLY /AjaxCalling/GetQuestions (GET). NEVER SavePaper / CreatePaper.
 *
 * Usage:
 *   PTS_USER=... PTS_PASS=... node scripts/pts-export-pakstudies-10.mjs
 *
 * QuestionSubTypeID map:
 *   1  = MCQ
 *  12  = SHORT
 *  13  = LONG
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
  "pakistan-studies",
  "pts-raw",
);

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
  const pak = (subjects.SubjectsList || []).find((s) =>
    /pakistan\s*studies/i.test(String(s.SubjectName).trim()),
  );
  if (!pak) throw new Error("Pakistan Studies subject not found");

  const hierarchy = await getJson("/AjaxCalling/ChaptersListBySubjectID", {
    SubjectID: pak.SubjectID,
  });
  fs.writeFileSync(
    path.join(OUT_DIR, "hierarchy.json"),
    JSON.stringify(
      {
        course: { CourseID: 1, name: "PTB" },
        class: class10,
        subject: pak,
        chapters: hierarchy.ChaptersList,
        topics: hierarchy.TopicsList,
      },
      null,
      2,
    ),
  );

  const topics = hierarchy.TopicsList || [];
  const types = [
    { id: 1, name: "mcq" },
    { id: 12, name: "short" },
    { id: 13, name: "long" },
  ];
  const priorities = [1, 2, 3, 4, 5];

  const all = { mcq: [], short: [], long: [] };
  const seen = { mcq: new Set(), short: new Set(), long: new Set() };

  const CHUNK = 8;
  for (const type of types) {
    for (const pri of priorities) {
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
          all[type.name].push(q);
        }
        await sleep(120);
      }
    }
  }
  console.log("");

  for (const type of types) {
    const file = path.join(OUT_DIR, `${type.name}-raw.json`);
    fs.writeFileSync(
      file,
      JSON.stringify(
        {
          board: "Lahore",
          course: "PTB",
          class: "10",
          subject: "Pakistan Studies",
          type: type.name,
          total: all[type.name].length,
          exportedAt: new Date().toISOString(),
          source: "paktestsolution.com AjaxCalling/GetQuestions (read-only)",
          questions: all[type.name],
        },
        null,
        2,
      ),
    );
    console.log(`Wrote ${type.name}: ${all[type.name].length}`);
  }

  console.log("DONE totals", {
    mcq: all.mcq.length,
    short: all.short.length,
    long: all.long.length,
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
