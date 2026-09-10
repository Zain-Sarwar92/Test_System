/**
 * Class 12 (Inter-II) — PTS live question types + counts vs local seed.
 * READ-ONLY GetQuestions / ChaptersList / SubjectsList.
 *
 * Usage:
 *   PTS_USER=... PTS_PASS=... node scripts/pts-class12-types-report.mjs
 */
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
const CHUNK = 12;
const ROOT = path.join(process.cwd(), "data", "lahore-board", "12th");

const STD = [
  { id: 1, field: "MCQ", bank: "MCQ" },
  { id: 12, field: "QA", bank: "QA" },
  { id: 13, field: "LONG", bank: "LONG" },
];

/** Same map as pts-export-inter2.mjs */
const SUBJECT_CONFIG = {
  116: { slug: "biology", types: STD },
  117: { slug: "chemistry", types: STD },
  118: { slug: "physics", types: STD },
  119: {
    slug: "mathematics",
    types: [
      { id: 1, field: "MCQ", bank: "MCQ" },
      { id: 14, field: "QA", bank: "QA" },
    ],
  },
  120: { slug: "computer", types: STD },
  121: { slug: "statistics", types: STD },
  122: { slug: "economics", types: STD },
  123: {
    slug: "english",
    types: [
      { id: 1, field: "COMPREHENSION", bank: "MCQ" },
      { id: 2, field: "SPELLING", bank: "MCQ" },
      { id: 3, field: "MEANING", bank: "MCQ" },
      { id: 6, field: "GRAMMAR", bank: "MCQ" },
      { id: 14, field: "QA", bank: "QA" },
      { id: 23, field: "DI", bank: "QA" },
      { id: 34, field: "WORD", bank: "QA" },
      { id: 35, field: "PAIR", bank: "QA" },
      { id: 27, field: "ESSAYS", bank: "LONG" },
      { id: 28, field: "SUMMARY", bank: "LONG" },
      { id: 43, field: "TRANSLATE_UR", bank: "LONG" },
      { id: 47, field: "POEM_STANZA", bank: "LONG" },
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
      { id: 1, field: "MCQ", bank: "MCQ" },
      { id: 19, field: "POEM", bank: "LONG" },
      { id: 29, field: "NAAT", bank: "LONG" },
      { id: 49, field: "QA", bank: "QA" },
    ],
  },
  130: { slug: "education", types: STD },
  131: { slug: "civics", types: STD },
  132: {
    slug: "punjabi",
    types: [
      { id: 1, field: "MCQ", bank: "MCQ" },
      { id: 14, field: "QA", bank: "QA" },
      { id: 19, field: "POEM", bank: "LONG" },
      { id: 28, field: "SUMMARY", bank: "LONG" },
      { id: 34, field: "MEANING", bank: "QA" },
      { id: 37, field: "WORD", bank: "QA" },
      { id: 38, field: "IDIOM", bank: "QA" },
      { id: 48, field: "PASSAGE", bank: "LONG" },
    ],
  },
  133: {
    slug: "islamiyat-elective",
    types: [
      { id: 1, field: "MCQ", bank: "MCQ" },
      { id: 12, field: "QA", bank: "QA" },
      { id: 17, field: "AYAT", bank: "LONG" },
    ],
  },
  134: { slug: "physical-education", types: STD },
  135: { slug: "sociology", types: STD },
  136: { slug: "ethics", types: STD },
  137: {
    slug: "tarjuma-quran",
    types: [
      { id: 1, field: "MCQ", bank: "MCQ" },
      { id: 12, field: "QA", bank: "QA" },
      { id: 13, field: "LONG", bank: "LONG" },
      { id: 17, field: "AYAT", bank: "LONG" },
      { id: 37, field: "MEANING", bank: "QA" },
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

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function req(url, opts = {}, attempt = 1) {
  try {
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
  } catch (e) {
    if (attempt >= 4) throw e;
    await sleep(400 * attempt);
    return req(url, opts, attempt + 1);
  }
}

async function login() {
  const u = new URL(`${BASE}/Home/CheckLogin`);
  u.searchParams.set("emailAddress", USER);
  u.searchParams.set("password", PASS);
  const json = await (await req(u)).json();
  if (!json.IsValid) throw new Error(`Login failed: ${json.html}`);
  await req(`${BASE}${json.html}`);
  await req(`${BASE}/GeneratePaper/GetSyllabus`);
  console.log("PTS login OK (read-only)\n");
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

function normalizeLocalField(f) {
  const x = String(f || "MCQ").toUpperCase();
  if (x === "SHORT" || x === "SHORTS") return "QA";
  if (x === "MCQS") return "MCQ";
  return x;
}

function loadLocal(slug) {
  const file = path.join(ROOT, slug, "all-questions.json");
  if (!fs.existsSync(file)) return null;
  const all = JSON.parse(fs.readFileSync(file, "utf8"));
  const totals = {};
  for (const q of all.questions || []) {
    const f = normalizeLocalField(q.field || q.type);
    totals[f] = (totals[f] ?? 0) + 1;
  }
  return totals;
}

function isCollapsedLocal(local) {
  if (!local) return true;
  const keys = Object.keys(local);
  return keys.every((k) => ["MCQ", "QA", "SHORT", "LONG"].includes(k));
}

function rollup(detailed, types) {
  const out = {};
  for (const t of types) {
    const n = detailed[t.field] ?? 0;
    const bank = t.bank || t.field;
    out[bank] = (out[bank] ?? 0) + n;
  }
  return out;
}

async function countLive(topicIds, types) {
  const totals = {};
  const seen = new Set();
  for (const type of types) {
    let n = 0;
    for (const pri of PRIORITIES) {
      for (let i = 0; i < topicIds.length; i += CHUNK) {
        const chunk = topicIds.slice(i, i + CHUNK);
        const list = await getQuestions(chunk.join(","), type.id, pri);
        for (const q of list) {
          if (seen.has(q.QuestionID)) continue;
          seen.add(q.QuestionID);
          n += 1;
        }
        await sleep(20);
      }
    }
    totals[type.field] = n;
  }
  return totals;
}

async function main() {
  await login();

  const subjects =
    (await getJson("/AjaxCalling/SubjectsListByClassID", { ClassID: 12 }))
      .SubjectsList || [];
  console.log(`PTS Class 12 subjects listed: ${subjects.length}\n`);

  const rows = [];

  for (const sub of subjects) {
    const cfg = SUBJECT_CONFIG[sub.SubjectID];
    if (!cfg) {
      console.log(
        `(skip unmapped PTS subject: ${sub.SubjectName} #${sub.SubjectID})`,
      );
      continue;
    }

    process.stdout.write(`→ ${cfg.slug} ... `);
    let liveDetailed = {};
    let err = null;
    try {
      const hierarchy = await getJson("/AjaxCalling/ChaptersListBySubjectID", {
        SubjectID: sub.SubjectID,
      });
      const topicIds = (hierarchy.TopicsList || []).map((t) => t.TopicID);
      if (!topicIds.length) err = "no topics";
      else liveDetailed = await countLive(topicIds, cfg.types);
    } catch (e) {
      err = e instanceof Error ? e.message : String(e);
    }

    const local = loadLocal(cfg.slug);
    const collapsed = isCollapsedLocal(local);
    const liveCompare = collapsed
      ? rollup(liveDetailed, cfg.types)
      : liveDetailed;
    const localCompare = local || {};

    const liveTypes = Object.keys(liveDetailed)
      .filter((f) => (liveDetailed[f] ?? 0) > 0)
      .sort();
    const compareKeys = [
      ...new Set([
        ...Object.keys(liveCompare).filter((k) => (liveCompare[k] ?? 0) > 0),
        ...Object.keys(localCompare).filter((k) => (localCompare[k] ?? 0) > 0),
      ]),
    ].sort();

    const diffs = [];
    for (const f of compareKeys) {
      const lv = liveCompare[f] ?? 0;
      const loc = localCompare[f] ?? 0;
      if (lv !== loc) diffs.push(`${f}: PTS ${lv} / local ${loc}`);
    }

    const liveTotal = Object.values(liveCompare).reduce((a, b) => a + b, 0);
    const localTotal = Object.values(localCompare).reduce((a, b) => a + b, 0);

    const status = err
      ? `ERROR: ${err}`
      : !local
        ? "NO LOCAL FILE"
        : diffs.length === 0
          ? "MATCH"
          : "DIFF";

    console.log(status);
    rows.push({
      subject: sub.SubjectName,
      subjectId: sub.SubjectID,
      slug: cfg.slug,
      mode: collapsed ? "rollup bank fields" : "detailed fields",
      types: liveTypes.join(", ") || "(none)",
      liveTotal,
      localTotal,
      status,
      diffs,
      liveDetailed,
      liveCompare,
      localCompare,
    });
  }

  const seenSlugs = new Set(rows.map((r) => r.slug));
  for (const cfg of Object.values(SUBJECT_CONFIG)) {
    if (seenSlugs.has(cfg.slug)) continue;
    const local = loadLocal(cfg.slug);
    if (!local) continue;
    console.log(`→ ${cfg.slug} ... NO PTS SUBJECT`);
    rows.push({
      subject: cfg.slug,
      subjectId: null,
      slug: cfg.slug,
      mode: "-",
      types: "",
      liveTotal: 0,
      localTotal: Object.values(local).reduce((a, b) => a + b, 0),
      status: "NO PTS SUBJECT",
      diffs: [],
      liveDetailed: {},
      liveCompare: {},
      localCompare: local,
    });
  }

  console.log("\n========== CLASS 12 QUESTION TYPES / COUNTS ==========\n");
  for (const r of rows) {
    console.log(`## ${r.subject} (${r.slug})`);
    console.log(`Compare mode: ${r.mode}`);
    console.log(`PTS subtype keys (>0): ${r.types}`);
    console.log(
      `Totals: PTS=${r.liveTotal}  local=${r.localTotal}  → ${r.status}`,
    );
    if (r.diffs.length) {
      for (const d of r.diffs) console.log(`  - ${d}`);
    } else if (r.status === "MATCH") {
      for (const f of Object.keys(r.liveCompare).sort()) {
        if ((r.liveCompare[f] ?? 0) > 0) {
          console.log(`  - ${f}: ${r.liveCompare[f]}`);
        }
      }
    }
    console.log("");
  }

  const match = rows.filter((r) => r.status === "MATCH").length;
  const diff = rows.filter((r) => r.status === "DIFF").length;
  const other = rows.length - match - diff;
  console.log(
    `SUMMARY: ${match} MATCH · ${diff} DIFF · ${other} other · ${rows.length} subjects`,
  );

  const out = path.join(ROOT, "_pts-types-report.json");
  fs.writeFileSync(
    out,
    JSON.stringify({ generatedAt: new Date().toISOString(), rows }, null, 2),
  );
  console.log(`Wrote ${out}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
