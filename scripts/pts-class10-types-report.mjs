/**
 * Class 10 — PTS live question types + counts vs local seed.
 * READ-ONLY GetQuestions / ChaptersList / SubjectsList.
 *
 * Usage:
 *   PTS_USER=... PTS_PASS=... node scripts/pts-class10-types-report.mjs
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
/** English DI uses extra priorities in export */
const DI_PRIORITIES = [1, 2, 3, 4, 5, 6, 7, 8];
const CHUNK = 12;
const ROOT = path.join(process.cwd(), "data", "lahore-board", "10th");

const STD = [
  { id: 1, field: "MCQ", bank: "MCQ" },
  { id: 12, field: "QA", bank: "SHORT" },
  { id: 13, field: "LONG", bank: "LONG" },
];

/** slug → type probes (ids from export scripts) */
const SUBJECT_CONFIG = {
  biology: { types: STD },
  computer: { types: STD },
  chemistry: { types: STD },
  physics: { types: STD },
  mathematics: { types: STD },
  "pakistan-studies": { types: STD },
  "general-science": { types: STD },
  "general-math": { types: STD },
  education: { types: STD },
  "home-economics": { types: STD },
  civics: { types: STD },
  economics: { types: STD },
  ethics: { types: STD },
  "physical-education": { types: STD },
  poultry: { types: STD },
  "food-nutrition": { types: STD },
  english: {
    types: [
      { id: 1, field: "COMPREHENSION", bank: "MCQ" },
      { id: 2, field: "SPELLING", bank: "MCQ" },
      { id: 3, field: "MEANING", bank: "MCQ" },
      { id: 5, field: "VERB", bank: "MCQ" },
      { id: 6, field: "GRAMMAR", bank: "MCQ" },
      { id: 14, field: "QA", bank: "SHORT" },
      { id: 23, field: "DI", bank: "SHORT", priorities: DI_PRIORITIES },
      { id: 35, field: "PAIR", bank: "SHORT" },
      { id: 27, field: "ESSAYS", bank: "LONG" },
      { id: 28, field: "SUMMARY", bank: "LONG" },
      { id: 43, field: "TRANSLATE_UR", bank: "LONG" },
      { id: 44, field: "TRANSLATE_EN", bank: "LONG" },
      { id: 47, field: "POEM_STANZA", bank: "LONG" },
    ],
  },
  "urdu-compulsory": {
    types: [
      { id: 1, field: "MCQ", bank: "MCQ" },
      { id: 14, field: "QA", bank: "SHORT" },
      { id: 19, field: "POEM", bank: "LONG" },
      { id: 27, field: "ESSAYS", bank: "LONG" },
      { id: 28, field: "SUMMARY", bank: "LONG" },
      { id: 30, field: "CENTRAL", bank: "LONG" },
      { id: 45, field: "TAFHEEM", bank: "LONG" },
      { id: 48, field: "PASSAGE", bank: "LONG" },
    ],
  },
  "islamiyat-compulsory": {
    types: [
      { id: 1, field: "MCQ", bank: "MCQ" },
      { id: 12, field: "QA", bank: "SHORT" },
      { id: 13, field: "LONG", bank: "LONG" },
      { id: 18, field: "HADITH", bank: "LONG" },
    ],
  },
  punjabi: {
    types: [
      { id: 1, field: "MCQ", bank: "MCQ" },
      { id: 14, field: "QA", bank: "SHORT" },
      { id: 19, field: "POEM", bank: "LONG" },
      { id: 34, field: "MEANING", bank: "SHORT" },
      { id: 38, field: "IDIOM", bank: "SHORT" },
      { id: 48, field: "PASSAGE", bank: "LONG" },
    ],
  },
  "islamiyat-elective": {
    types: [
      { id: 1, field: "MCQ", bank: "MCQ" },
      { id: 12, field: "QA", bank: "SHORT" },
      { id: 17, field: "AYAT", bank: "LONG" },
    ],
  },
  "tarjuma-quran": {
    types: [
      { id: 1, field: "MCQ", bank: "MCQ" },
      { id: 12, field: "QA", bank: "SHORT" },
      { id: 13, field: "LONG", bank: "LONG" },
      { id: 17, field: "AYAT", bank: "LONG" },
      { id: 37, field: "WORD", bank: "SHORT" },
    ],
  },
};

/** Match PTS subject name → local slug */
function matchSlug(subjectName) {
  const n = String(subjectName).trim().toLowerCase();
  if (/^biology$/i.test(n) || n.includes("حیاتیات")) return "biology";
  if (/^computer/i.test(n) || n.includes("کمپیوٹر")) return "computer";
  if (/^chemistry$/i.test(n) || n.includes("کیمistri")) return "chemistry";
  if (/^physics$/i.test(n) || n.includes("طبیعیات")) return "physics";
  if (/^mathematics$/i.test(n) || n.includes("ریاضی")) return "mathematics";
  if (/^english$/i.test(n)) return "english";
  if (/pakistan\s*stud/i.test(n) || n.includes("پاکستان")) return "pakistan-studies";
  if (/general\s*science/i.test(n)) return "general-science";
  if (/general\s*math/i.test(n)) return "general-math";
  if (/education|ایجوکیشن/i.test(n) && !/physical|فزیکل/i.test(n))
    return "education";
  if (/punjabi|پنجابی/i.test(n)) return "punjabi";
  if (/home\s*eco|ہوم/i.test(n)) return "home-economics";
  if (/civics|سوکس/i.test(n)) return "civics";
  if (/economics|معاشیات/i.test(n)) return "economics";
  if (/ethics|اخلاقیات/i.test(n)) return "ethics";
  if (/physical|فزیکل/i.test(n)) return "physical-education";
  if (/poultry|مرغ/i.test(n)) return "poultry";
  if (/food|غذا/i.test(n)) return "food-nutrition";
  if (/tarjuma|ترجم/i.test(n)) return "tarjuma-quran";
  if (/urdu/i.test(n) || n.includes("اردو") || n.includes("اُردو"))
    return "urdu-compulsory";
  if (/islamiyat|اسلامیات/i.test(n) && /elect|اختیار/i.test(n))
    return "islamiyat-elective";
  if (/islamiyat|اسلامیات/i.test(n)) return "islamiyat-compulsory";
  return null;
}

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

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function normalizeLocalField(f) {
  const x = String(f || "MCQ").toUpperCase();
  if (x === "WORD") return "PAIR";
  if (x === "SHORT") return "SHORT";
  if (x === "QA") return "QA";
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
  return keys.every((k) => ["MCQ", "SHORT", "LONG"].includes(k));
}

function rollup(detailed, types) {
  const out = { MCQ: 0, SHORT: 0, LONG: 0 };
  for (const t of types) {
    const n = detailed[t.field] ?? detailed[normalizeLocalField(t.field)] ?? 0;
    const bank = t.bank || "MCQ";
    out[bank] = (out[bank] ?? 0) + n;
  }
  // Also map QA key if present as SHORT
  if (detailed.QA && !types.some((t) => t.field === "QA" && t.bank === "SHORT")) {
    /* already via types */
  }
  return out;
}

async function countLive(topicIds, types) {
  const totals = {};
  const seen = new Set();
  for (const type of types) {
    let n = 0;
    const pris = type.priorities || PRIORITIES;
    for (const pri of pris) {
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
    totals[normalizeLocalField(type.field)] = n;
  }
  return totals;
}

async function main() {
  await login();

  const subjects =
    (await getJson("/AjaxCalling/SubjectsListByClassID", { ClassID: 10 }))
      .SubjectsList || [];
  console.log(`PTS Class 10 subjects listed: ${subjects.length}\n`);

  const planned = new Map();
  for (const s of subjects) {
    const slug = matchSlug(s.SubjectName);
    if (!slug || !SUBJECT_CONFIG[slug]) {
      console.log(`(skip unmatched PTS subject: ${s.SubjectName} #${s.SubjectID})`);
      continue;
    }
    if (planned.has(slug)) continue;
    planned.set(slug, { ...SUBJECT_CONFIG[slug], ptsName: s.SubjectName, subjectId: s.SubjectID });
  }

  // Ensure we attempt every local slug even if name match failed
  for (const slug of Object.keys(SUBJECT_CONFIG)) {
    if (planned.has(slug)) continue;
    const guess = subjects.find((s) => matchSlug(s.SubjectName) === slug);
    if (guess) {
      planned.set(slug, {
        ...SUBJECT_CONFIG[slug],
        ptsName: guess.SubjectName,
        subjectId: guess.SubjectID,
      });
    } else {
      console.log(`(no PTS match for local slug: ${slug})`);
    }
  }

  const rows = [];

  for (const [slug, cfg] of planned) {
    process.stdout.write(`→ ${slug} ... `);
    let liveDetailed = {};
    let err = null;
    try {
      const hierarchy = await getJson("/AjaxCalling/ChaptersListBySubjectID", {
        SubjectID: cfg.subjectId,
      });
      const topicIds = (hierarchy.TopicsList || []).map((t) => t.TopicID);
      if (!topicIds.length) err = "no topics";
      else liveDetailed = await countLive(topicIds, cfg.types);
    } catch (e) {
      err = e instanceof Error ? e.message : String(e);
    }

    const local = loadLocal(slug);
    const collapsed = isCollapsedLocal(local);
    const liveCompare = collapsed
      ? rollup(liveDetailed, cfg.types)
      : liveDetailed;
    const localCompare = local || {};

    // For detailed English: also show QA as-is
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
      subject: cfg.ptsName,
      slug,
      mode: collapsed ? "rollup MCQ/SHORT/LONG" : "detailed fields",
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

  console.log("\n========== CLASS 10 QUESTION TYPES / COUNTS ==========\n");
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
