/**
 * READ-ONLY PTS verification vs local seed folders.
 * - Lists subjects for Class 9/10/11/12
 * - Compares with local data/lahore-board
 * - Spot-checks question totals (Exercise+Additional) for selected subjects
 * - Scans sample questions for Diagrams/Equations media
 *
 * Usage:
 *   PTS_USER=... PTS_PASS=... node scripts/pts-verify-coverage.mjs
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

const CLASSES = [
  { classId: 9, folder: "9th", label: "Class 9" },
  { classId: 10, folder: "10th", label: "Class 10" },
  { classId: 11, folder: "11th", label: "Class 11" },
  { classId: 12, folder: "12th", label: "Class 12" },
];

/** Priority IDs used by existing exporters */
const PRIORITIES = [
  { id: 1, name: "Exercise" },
  { id: 2, name: "Past Papers" },
  { id: 3, name: "Additional" },
  { id: 4, name: "Review/Other" },
  { id: 5, name: "Conceptuals/Other" },
];

const STD_TYPES = [
  { id: 1, name: "mcq" },
  { id: 12, name: "short" },
  { id: 13, name: "long" },
];

const CHUNK = 10;
const ROOT = path.join(process.cwd(), "data", "lahore-board");

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
  const json = JSON.parse(await res.text());
  return json.QuestionsList || [];
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function localSlugs(folder) {
  const dir = path.join(ROOT, folder);
  if (!fs.existsSync(dir)) return new Set();
  return new Set(
    fs
      .readdirSync(dir, { withFileTypes: true })
      .filter((d) => d.isDirectory() && !d.name.startsWith("_"))
      .map((d) => d.name),
  );
}

function localQuestionCount(folder, slug) {
  const p = path.join(ROOT, folder, slug, "all-questions.json");
  if (!fs.existsSync(p)) return null;
  try {
    const j = JSON.parse(fs.readFileSync(p, "utf8"));
    return Array.isArray(j.questions) ? j.questions.length : 0;
  } catch {
    return null;
  }
}

function guessSlug(name) {
  return String(name || "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/** Known SubjectID → slug maps from exporters */
const KNOWN = {
  // class 9
  43: "biology",
  44: "computer",
  45: "chemistry",
  46: "physics",
  47: "mathematics",
  48: "english",
  50: "urdu-compulsory",
  51: "islamiyat-compulsory",
  52: "general-science",
  54: "education",
  55: "punjabi",
  // class 12 empties we care about
  116: "biology",
  117: "chemistry",
  118: "physics",
  119: "mathematics",
  129: "urdu-compulsory",
};

async function countSubjectQuestions(subjectId, types = STD_TYPES) {
  const hierarchy = await getJson("/AjaxCalling/ChaptersListBySubjectID", {
    SubjectID: subjectId,
  });
  const topics = hierarchy.TopicsList || [];
  const byPriority = Object.fromEntries(PRIORITIES.map((p) => [p.name, 0]));
  let diagrams = 0;
  let equations = 0;
  let withImg = 0;
  const seen = new Set();

  for (const type of types) {
    for (const pri of PRIORITIES) {
      for (let i = 0; i < topics.length; i += CHUNK) {
        const chunk = topics.slice(i, i + CHUNK);
        const ids = chunk.map((t) => t.TopicID).join(",");
        let list = [];
        try {
          list = await getQuestions(ids, type.id, pri.id);
        } catch {
          list = [];
        }
        for (const q of list) {
          if (seen.has(q.QuestionID)) continue;
          seen.add(q.QuestionID);
          byPriority[pri.name] += 1;
          const html = [
            q.Question,
            q.QuestionUrdu,
            q.OptionA,
            q.OptionB,
            q.OptionC,
            q.OptionD,
          ]
            .filter(Boolean)
            .join("\n");
          if (/<img/i.test(html)) withImg += 1;
          if (/Diagrams\//i.test(html)) diagrams += 1;
          if (/Equations\//i.test(html)) equations += 1;
        }
        await sleep(40);
      }
    }
  }

  return {
    topics: topics.length,
    chapters: (hierarchy.ChaptersList || []).length,
    totalUnique: seen.size,
    byPriority,
    withImg,
    diagrams,
    equations,
  };
}

async function main() {
  await login();

  const report = {
    checkedAt: new Date().toISOString(),
    classes: [],
    deepChecks: [],
  };

  console.log("\n========== SUBJECT LIST COMPARE ==========");
  for (const c of CLASSES) {
    const subjects =
      (await getJson("/AjaxCalling/SubjectsListByClassID", { ClassID: c.classId }))
        .SubjectsList || [];
    const local = localSlugs(c.folder);
    const ptsNames = subjects.map((s) => ({
      id: s.SubjectID,
      name: s.SubjectName,
      slugGuess: KNOWN[s.SubjectID] || guessSlug(s.SubjectName),
    }));

    const matched = [];
    const missingLocal = [];
    for (const s of ptsNames) {
      const slug = s.slugGuess;
      const q = localQuestionCount(c.folder, slug);
      const exists = local.has(slug) || [...local].some((x) => x.includes(slug.slice(0, 8)));
      // better: check exact slug from known map or folder match by normalized name
      let foundSlug = null;
      if (local.has(slug)) foundSlug = slug;
      else {
        // try loose contains
        for (const ls of local) {
          if (ls === slug || guessSlug(ls) === slug) {
            foundSlug = ls;
            break;
          }
        }
      }
      const localQ = foundSlug ? localQuestionCount(c.folder, foundSlug) : null;
      const row = {
        ptsId: s.id,
        ptsName: s.name,
        localSlug: foundSlug,
        localQuestions: localQ,
      };
      if (foundSlug) matched.push(row);
      else missingLocal.push(row);
    }

    const extraLocal = [...local].filter(
      (slug) =>
        !ptsNames.some(
          (s) => s.slugGuess === slug || guessSlug(s.name) === slug,
        ),
    );

    console.log(`\n${c.label}: PTS subjects=${subjects.length}, local folders=${local.size}`);
    console.log(`  matched≈${matched.length}, missing locally=${missingLocal.length}, extra local=${extraLocal.length}`);
    if (missingLocal.length) {
      console.log("  MISSING locally:");
      for (const m of missingLocal) console.log(`    - [${m.ptsId}] ${m.ptsName}`);
    }
    if (extraLocal.length) {
      console.log("  EXTRA local (not matched by guess):", extraLocal.join(", "));
    }

    report.classes.push({
      ...c,
      ptsSubjectCount: subjects.length,
      localFolderCount: local.size,
      matched: matched.length,
      missingLocal,
      extraLocal,
      ptsSubjects: ptsNames,
    });
  }

  // Deep check: Class 12 empty subjects + one healthy subject per class for media
  const deepTargets = [
    { classId: 12, folder: "12th", subjectId: 117, slug: "chemistry", label: "Class12 Chemistry" },
    { classId: 12, folder: "12th", subjectId: 118, slug: "physics", label: "Class12 Physics" },
    { classId: 12, folder: "12th", subjectId: 119, slug: "mathematics", label: "Class12 Mathematics" },
    { classId: 12, folder: "12th", subjectId: 129, slug: "urdu-compulsory", label: "Class12 Urdu", types: [
      { id: 1, name: "mcq" },
      { id: 14, name: "short-qa" },
      { id: 19, name: "long-poem" },
      { id: 28, name: "long-summary" },
      { id: 48, name: "long-passage" },
    ] },
    { classId: 9, folder: "9th", subjectId: 43, slug: "biology", label: "Class9 Biology" },
    { classId: 10, folder: "10th", subjectId: null, slug: "biology", label: "Class10 Biology" },
    { classId: 11, folder: "11th", subjectId: 94, slug: "biology", label: "Class11 Biology" },
    { classId: 12, folder: "12th", subjectId: 116, slug: "biology", label: "Class12 Biology" },
  ];

  console.log("\n========== DEEP QUESTION / MEDIA CHECK ==========");
  for (const t of deepTargets) {
    let subjectId = t.subjectId;
    if (!subjectId) {
      const subjects =
        (await getJson("/AjaxCalling/SubjectsListByClassID", { ClassID: t.classId }))
          .SubjectsList || [];
      const hit = subjects.find((s) => /biology/i.test(s.SubjectName));
      subjectId = hit?.SubjectID;
    }
    if (!subjectId) {
      console.log(`SKIP ${t.label}: subjectId not found`);
      continue;
    }
    console.log(`\nCounting live PTS: ${t.label} (SubjectID=${subjectId}) ...`);
    const stats = await countSubjectQuestions(subjectId, t.types || STD_TYPES);
    const localQ = localQuestionCount(t.folder, t.slug);
    const row = {
      ...t,
      subjectId,
      localQuestions: localQ,
      pts: stats,
      delta: (stats.totalUnique || 0) - (localQ ?? 0),
    };
    report.deepChecks.push(row);
    console.log(
      JSON.stringify(
        {
          label: t.label,
          localQuestions: localQ,
          ptsTotal: stats.totalUnique,
          delta: row.delta,
          byPriority: stats.byPriority,
          withImg: stats.withImg,
          diagrams: stats.diagrams,
          equations: stats.equations,
          topics: stats.topics,
        },
        null,
        2,
      ),
    );
  }

  const out = path.join(ROOT, "_pts-verify-report.json");
  fs.writeFileSync(out, JSON.stringify(report, null, 2));
  console.log(`\nWrote ${out}`);

  // Final verdict lines
  console.log("\n========== VERDICT ==========");
  for (const c of report.classes) {
    const ok = c.missingLocal.length === 0;
    console.log(
      `${c.label}: PTS=${c.ptsSubjectCount} local=${c.localFolderCount} missingLocal=${c.missingLocal.length} => ${ok ? "SUBJECTS OK" : "SUBJECT GAPS"}`,
    );
  }
  for (const d of report.deepChecks) {
    console.log(
      `${d.label}: local=${d.localQuestions} pts=${d.pts.totalUnique} delta=${d.delta} diagrams=${d.pts.diagrams} equations=${d.pts.equations}`,
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
