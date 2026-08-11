/**
 * READ-ONLY PTS export for ALL remaining PTB Class 10 subjects
 * (everything except Biology, Computer, Chemistry, Physics,
 *  Mathematics, English, Pakistan Studies).
 *
 * Calls ONLY /AjaxCalling/GetQuestions (GET). NEVER SavePaper.
 *
 * Usage:
 *   PTS_USER=... PTS_PASS=... node scripts/pts-export-remaining-10.mjs
 *   PTS_USER=... PTS_PASS=... node scripts/pts-export-remaining-10.mjs urdu-compulsory
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

/** Already imported — skip */
const DONE_IDS = new Set([59, 60, 61, 62, 63, 64, 65]);

/**
 * Per-subject subtype lists from PTS probe.
 * bankType: mcq | short | long
 */
const SUBJECT_CONFIG = {
  66: {
    slug: "urdu-compulsory",
    types: [
      { id: 1, name: "mcq", bankType: "mcq" },
      { id: 14, name: "short-qa", bankType: "short" },
      { id: 19, name: "long-poem", bankType: "long" },
      { id: 28, name: "long-summary", bankType: "long" },
      { id: 48, name: "long-passage", bankType: "long" },
    ],
  },
  67: {
    slug: "islamiyat-compulsory",
    types: [
      { id: 1, name: "mcq", bankType: "mcq" },
      { id: 12, name: "short", bankType: "short" },
      { id: 13, name: "long", bankType: "long" },
      { id: 18, name: "long-ayat", bankType: "long" },
    ],
  },
  68: {
    slug: "general-science",
    types: [
      { id: 1, name: "mcq", bankType: "mcq" },
      { id: 12, name: "short", bankType: "short" },
      { id: 13, name: "long", bankType: "long" },
    ],
  },
  69: {
    slug: "general-math",
    types: [
      { id: 1, name: "mcq", bankType: "mcq" },
      { id: 12, name: "short", bankType: "short" },
      { id: 13, name: "long", bankType: "long" },
    ],
  },
  70: {
    slug: "education",
    types: [
      { id: 1, name: "mcq", bankType: "mcq" },
      { id: 12, name: "short", bankType: "short" },
      { id: 13, name: "long", bankType: "long" },
    ],
  },
  71: {
    slug: "punjabi",
    types: [
      { id: 1, name: "mcq", bankType: "mcq" },
      { id: 14, name: "short-qa", bankType: "short" },
      { id: 19, name: "long-poem", bankType: "long" },
      { id: 34, name: "short-meaning", bankType: "short" },
      { id: 38, name: "short-idiom", bankType: "short" },
      { id: 48, name: "long-passage", bankType: "long" },
    ],
  },
  72: {
    slug: "islamiyat-elective",
    types: [
      { id: 1, name: "mcq", bankType: "mcq" },
      { id: 12, name: "short", bankType: "short" },
      { id: 17, name: "long-ayat", bankType: "long" },
    ],
  },
  73: {
    slug: "home-economics",
    types: [
      { id: 1, name: "mcq", bankType: "mcq" },
      { id: 12, name: "short", bankType: "short" },
      { id: 13, name: "long", bankType: "long" },
    ],
  },
  74: {
    slug: "civics",
    types: [
      { id: 1, name: "mcq", bankType: "mcq" },
      { id: 12, name: "short", bankType: "short" },
      { id: 13, name: "long", bankType: "long" },
    ],
  },
  258: {
    slug: "economics",
    types: [
      { id: 1, name: "mcq", bankType: "mcq" },
      { id: 12, name: "short", bankType: "short" },
      { id: 13, name: "long", bankType: "long" },
    ],
  },
  312: {
    slug: "tarjuma-quran",
    types: [
      { id: 1, name: "mcq", bankType: "mcq" },
      { id: 12, name: "short", bankType: "short" },
      { id: 13, name: "long", bankType: "long" },
      { id: 17, name: "long-ayat", bankType: "long" },
      { id: 37, name: "short-meaning", bankType: "short" },
    ],
  },
  313: {
    slug: "ethics",
    types: [
      { id: 1, name: "mcq", bankType: "mcq" },
      { id: 12, name: "short", bankType: "short" },
      { id: 13, name: "long", bankType: "long" },
    ],
  },
  336: {
    slug: "physical-education",
    types: [
      { id: 1, name: "mcq", bankType: "mcq" },
      { id: 12, name: "short", bankType: "short" },
      { id: 13, name: "long", bankType: "long" },
    ],
  },
  340: {
    slug: "poultry",
    types: [
      { id: 1, name: "mcq", bankType: "mcq" },
      { id: 12, name: "short", bankType: "short" },
      { id: 13, name: "long", bankType: "long" },
    ],
  },
  1537: {
    slug: "food-nutrition",
    types: [
      { id: 1, name: "mcq", bankType: "mcq" },
      { id: 12, name: "short", bankType: "short" },
      { id: 13, name: "long", bankType: "long" },
    ],
  },
};

const DEFAULT_TYPES = [
  { id: 1, name: "mcq", bankType: "mcq" },
  { id: 12, name: "short", bankType: "short" },
  { id: 13, name: "long", bankType: "long" },
];

const PRIORITIES = [1, 2, 3, 4, 5];
const CHUNK = 8;
const ONLY_SLUG = process.argv[2] || null;

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
  const text = await res.text();
  if (!res.ok) return [];
  return JSON.parse(text).QuestionsList || [];
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
    types: DEFAULT_TYPES,
  };
  if (ONLY_SLUG && cfg.slug !== ONLY_SLUG) return null;

  const outDir = path.join(
    process.cwd(),
    "data",
    "lahore-board",
    "10th",
    cfg.slug,
    "pts-raw",
  );
  fs.mkdirSync(outDir, { recursive: true });

  console.log(`\n=== ${subject.SubjectName} (${cfg.slug}) ===`);

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
          class: "10",
          subject: subject.SubjectName,
          slug: cfg.slug,
          type: type.bankType,
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
  const subjects = (
    await getJson("/AjaxCalling/SubjectsListByClassID", { ClassID: 10 })
  ).SubjectsList || [];
  const remaining = subjects.filter((s) => !DONE_IDS.has(s.SubjectID));
  const summary = [];
  for (const sub of remaining) {
    const cfg = SUBJECT_CONFIG[sub.SubjectID];
    if (ONLY_SLUG && cfg && cfg.slug !== ONLY_SLUG) continue;
    if (ONLY_SLUG && !cfg) continue;
    const result = await exportSubject(sub);
    if (result) summary.push(result);
  }
  console.log("\nDONE summary:");
  console.log(JSON.stringify(summary, null, 2));
  fs.mkdirSync(path.join(process.cwd(), "data", "lahore-board", "10th"), {
    recursive: true,
  });
  fs.writeFileSync(
    path.join(
      process.cwd(),
      "data",
      "lahore-board",
      "10th",
      "_remaining-export-summary.json",
    ),
    JSON.stringify(summary, null, 2),
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
