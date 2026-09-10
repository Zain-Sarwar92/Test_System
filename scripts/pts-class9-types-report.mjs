/**
 * Class 9 — PTS live question types + counts vs local seed.
 * READ-ONLY GetQuestions / ChaptersList / SubjectsList.
 *
 * Usage:
 *   PTS_USER=... PTS_PASS=... node scripts/pts-class9-types-report.mjs
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
const ROOT = path.join(process.cwd(), "data", "lahore-board", "9th");

/** Same map as pts-export-class9.mjs */
const SUBJECT_CONFIG = {
  43: {
    slug: "biology",
    types: [
      { id: 1, field: "MCQ" },
      { id: 12, field: "QA" },
      { id: 13, field: "LONG" },
    ],
  },
  44: {
    slug: "computer",
    types: [
      { id: 1, field: "MCQ" },
      { id: 12, field: "QA" },
      { id: 13, field: "LONG" },
    ],
  },
  45: {
    slug: "chemistry",
    types: [
      { id: 1, field: "MCQ" },
      { id: 12, field: "QA" },
      { id: 13, field: "LONG" },
    ],
  },
  46: {
    slug: "physics",
    types: [
      { id: 1, field: "MCQ" },
      { id: 12, field: "QA" },
      { id: 13, field: "LONG" },
    ],
  },
  47: {
    slug: "mathematics",
    types: [
      { id: 1, field: "MCQ" },
      { id: 12, field: "QA" },
      { id: 13, field: "LONG" },
    ],
  },
  48: {
    slug: "english",
    types: [
      { id: 1, field: "COMPREHENSION" },
      { id: 2, field: "SPELLING" },
      { id: 3, field: "MEANING" },
      { id: 5, field: "VERB" },
      { id: 6, field: "GRAMMAR" },
      { id: 14, field: "QA" },
      { id: 15, field: "LETTER" },
      { id: 21, field: "TRANSLATE_EN" },
      { id: 22, field: "VOICE" },
      { id: 26, field: "STORY" },
      { id: 28, field: "SUMMARY" },
      { id: 31, field: "DIALOGUE" },
      { id: 34, field: "WORD" },
      { id: 36, field: "IDIOM" },
      { id: 43, field: "TRANSLATE_UR" },
      { id: 45, field: "PASSAGE" },
      { id: 47, field: "POEM_STANZA" },
    ],
  },
  50: {
    slug: "urdu-compulsory",
    types: [
      { id: 1, field: "MCQ" },
      { id: 14, field: "QA" },
      { id: 24, field: "CORRECT" },
      { id: 25, field: "IDIOM" },
      { id: 42, field: "MEANING" },
      { id: 19, field: "POEM" },
      { id: 28, field: "SUMMARY" },
      { id: 48, field: "PASSAGE" },
      { id: 15, field: "LETTER" },
      { id: 16, field: "APPLICATION" },
      { id: 26, field: "STORY" },
      { id: 31, field: "DIALOGUE" },
      { id: 30, field: "CENTRAL" },
    ],
  },
  51: {
    slug: "islamiyat-compulsory",
    types: [
      { id: 1, field: "MCQ" },
      { id: 12, field: "QA" },
      { id: 13, field: "LONG" },
      { id: 18, field: "HADITH" },
      { id: 57, field: "PERSONALITY" },
    ],
  },
  52: {
    slug: "general-science",
    types: [
      { id: 1, field: "MCQ" },
      { id: 12, field: "QA" },
      { id: 13, field: "LONG" },
    ],
  },
  54: {
    slug: "education",
    types: [
      { id: 1, field: "MCQ" },
      { id: 12, field: "QA" },
      { id: 13, field: "LONG" },
    ],
  },
  55: {
    slug: "punjabi",
    types: [
      { id: 1, field: "MCQ" },
      { id: 14, field: "QA" },
      { id: 19, field: "POEM" },
      { id: 28, field: "SUMMARY" },
      { id: 34, field: "MEANING" },
      { id: 37, field: "WORD" },
      { id: 38, field: "IDIOM" },
      { id: 48, field: "PASSAGE" },
    ],
  },
  56: {
    slug: "islamiyat-elective",
    types: [
      { id: 1, field: "MCQ" },
      { id: 12, field: "QA" },
      { id: 17, field: "AYAT" },
    ],
  },
  57: {
    slug: "home-economics",
    types: [
      { id: 1, field: "MCQ" },
      { id: 12, field: "QA" },
      { id: 13, field: "LONG" },
    ],
  },
  58: {
    slug: "civics",
    types: [
      { id: 1, field: "MCQ" },
      { id: 12, field: "QA" },
      { id: 13, field: "LONG" },
    ],
  },
  257: {
    slug: "economics",
    types: [
      { id: 1, field: "MCQ" },
      { id: 12, field: "QA" },
      { id: 13, field: "LONG" },
    ],
  },
  308: {
    slug: "tarjuma-quran",
    types: [
      { id: 1, field: "MCQ" },
      { id: 12, field: "QA" },
      { id: 13, field: "LONG" },
      { id: 17, field: "AYAT" },
      { id: 37, field: "WORD" },
    ],
  },
  311: {
    slug: "ethics",
    types: [
      { id: 1, field: "MCQ" },
      { id: 12, field: "QA" },
      { id: 13, field: "LONG" },
    ],
  },
  335: {
    slug: "physical-education",
    types: [
      { id: 1, field: "MCQ" },
      { id: 12, field: "QA" },
      { id: 13, field: "LONG" },
    ],
  },
  339: {
    slug: "poultry",
    types: [
      { id: 1, field: "MCQ" },
      { id: 12, field: "QA" },
      { id: 13, field: "LONG" },
    ],
  },
  1536: {
    slug: "food-nutrition",
    types: [
      { id: 1, field: "MCQ" },
      { id: 12, field: "QA" },
      { id: 13, field: "LONG" },
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
  const json = JSON.parse(await res.text());
  return json.QuestionsList || [];
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function normalizeField(f) {
  const x = String(f || "MCQ").toUpperCase();
  if (x === "WORD") return "PAIR"; // English local often stores WORD as PAIR
  return x;
}

function loadLocal(slug) {
  const file = path.join(ROOT, slug, "all-questions.json");
  if (!fs.existsSync(file)) return null;
  const all = JSON.parse(fs.readFileSync(file, "utf8"));
  const totals = {};
  for (const q of all.questions || []) {
    const f = normalizeField(q.field || q.type);
    totals[f] = (totals[f] ?? 0) + 1;
  }
  return totals;
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
    totals[normalizeField(type.field)] = n;
  }
  return totals;
}

async function main() {
  await login();

  const subjects =
    (
      await getJson("/AjaxCalling/SubjectsListByClassID", { ClassID: 9 })
    ).SubjectsList || [];
  console.log(`PTS Class 9 subjects listed: ${subjects.length}\n`);

  const rows = [];

  for (const [idStr, cfg] of Object.entries(SUBJECT_CONFIG)) {
    const subjectId = Number(idStr);
    const ptsName =
      subjects.find((s) => s.SubjectID === subjectId)?.SubjectName || cfg.slug;
    process.stdout.write(`→ ${cfg.slug} ... `);

    let live = {};
    let err = null;
    try {
      const hierarchy = await getJson("/AjaxCalling/ChaptersListBySubjectID", {
        SubjectID: subjectId,
      });
      const topicIds = (hierarchy.TopicsList || []).map((t) => t.TopicID);
      if (topicIds.length === 0) {
        err = "no topics";
      } else {
        live = await countLive(topicIds, cfg.types);
      }
    } catch (e) {
      err = e instanceof Error ? e.message : String(e);
    }

    const local = loadLocal(cfg.slug);
    const liveTypes = Object.keys(live)
      .filter((f) => (live[f] ?? 0) > 0)
      .sort();
    const localTypes = local
      ? Object.keys(local)
          .filter((f) => (local[f] ?? 0) > 0)
          .sort()
      : [];

    const fields = [...new Set([...liveTypes, ...localTypes])].sort();
    const diffs = [];
    for (const f of fields) {
      const lv = live[f] ?? 0;
      const loc = local?.[f] ?? 0;
      if (lv !== loc) diffs.push(`${f}: PTS ${lv} / local ${loc}`);
    }

    const status = err
      ? `ERROR: ${err}`
      : !local
        ? "NO LOCAL FILE"
        : diffs.length === 0
          ? "MATCH"
          : "DIFF";

    console.log(status);
    rows.push({
      subject: ptsName,
      slug: cfg.slug,
      types: liveTypes.length ? liveTypes.join(", ") : "(none)",
      liveTotal: Object.values(live).reduce((a, b) => a + b, 0),
      localTotal: local
        ? Object.values(local).reduce((a, b) => a + b, 0)
        : null,
      status,
      diffs,
      live,
      local,
    });
  }

  console.log("\n========== CLASS 9 QUESTION TYPES / COUNTS ==========\n");
  for (const r of rows) {
    console.log(`## ${r.subject} (${r.slug})`);
    console.log(`Types on PTS (>0): ${r.types}`);
    console.log(
      `Totals: PTS=${r.liveTotal}  local=${r.localTotal ?? "n/a"}  → ${r.status}`,
    );
    if (r.diffs.length) {
      for (const d of r.diffs) console.log(`  - ${d}`);
    } else if (r.status === "MATCH" && r.local) {
      for (const f of Object.keys(r.live).sort()) {
        if ((r.live[f] ?? 0) > 0) {
          console.log(`  - ${f}: ${r.live[f]}`);
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
  fs.writeFileSync(out, JSON.stringify({ generatedAt: new Date().toISOString(), rows }, null, 2));
  console.log(`Wrote ${out}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
