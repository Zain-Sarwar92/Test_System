/**
 * Probe PTS QuestionSubTypeIDs for Class 12 subjects (with retries).
 * Usage: PTS_USER=... PTS_PASS=... node scripts/pts-probe-c12-types.mjs [subjectId]
 */
import process from "node:process";

const BASE = "https://www.paktestsolution.com";
const USER = process.env.PTS_USER;
const PASS = process.env.PTS_PASS;
if (!USER || !PASS) {
  console.error("Set PTS_USER and PTS_PASS");
  process.exit(1);
}

const SUBJECTS = process.argv[2]
  ? [{ id: Number(process.argv[2]), label: String(process.argv[2]) }]
  : [
      { id: 119, label: "mathematics" },
      { id: 129, label: "urdu-compulsory" },
      { id: 123, label: "english" },
      { id: 120, label: "computer" },
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

async function req(url, attempt = 1) {
  try {
    const headers = {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122 Safari/537.36",
      Accept: "*/*",
      "X-Requested-With": "XMLHttpRequest",
    };
    if (jar.size) headers.Cookie = cookieHeader();
    const res = await fetch(url, { headers, redirect: "manual" });
    storeCookies(res);
    return res;
  } catch (e) {
    if (attempt >= 4) throw e;
    await new Promise((r) => setTimeout(r, 500 * attempt));
    return req(url, attempt + 1);
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
  console.log("Logged in");
}

async function probe(subjectId, label) {
  const hier = JSON.parse(
    await (
      await req(
        `${BASE}/AjaxCalling/ChaptersListBySubjectID?SubjectID=${subjectId}`,
      )
    ).text(),
  );
  const all = (hier.TopicsList || []).map((t) => t.TopicID);
  const topics = all.slice(0, 12).join(",");
  console.log(`\n== ${label} (#${subjectId}) topics=${all.length} ==`);
  for (let id = 1; id <= 55; id++) {
    const u = new URL(`${BASE}/AjaxCalling/GetQuestions`);
    u.searchParams.set("TopicIDs", topics);
    u.searchParams.set("QuestionSubTypeID", String(id));
    u.searchParams.set("QuestionPeriorityID", "1");
    u.searchParams.set("SyllabusType", "0");
    let qs = [];
    try {
      const res = await req(u.toString());
      if (res.ok) qs = JSON.parse(await res.text()).QuestionsList || [];
    } catch {
      continue;
    }
    if (qs.length) {
      const text = (qs[0].EnglishQuestionDetails || qs[0].UrduQuestionDetails || "")
        .replace(/<[^>]+>/g, " ")
        .trim()
        .slice(0, 55);
      console.log(`  TypeID=${id}: ${qs.length} | ${text}`);
    }
    await new Promise((r) => setTimeout(r, 60));
  }
}

await login();
for (const s of SUBJECTS) await probe(s.id, s.label);
console.log("\nDone");
