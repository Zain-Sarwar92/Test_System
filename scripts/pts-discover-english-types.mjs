/**
 * Discover PTS QuestionSubTypeIDs for English SYNONYM and PUNCTUATION
 * by probing /AjaxCalling/GetQuestions with different SubTypeIDs.
 * 
 * Usage: PTS_USER=AlhadiSchlAc7860 PTS_PASS=03334404102 node scripts/pts-discover-english-types.mjs
 */
const BASE = "https://www.paktestsolution.com";
const USER = process.env.PTS_USER;
const PASS = process.env.PTS_PASS;

if (!USER || !PASS) {
  console.error("Set PTS_USER and PTS_PASS");
  process.exit(1);
}

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

async function getQuestions(topicIds, subTypeId, priorityId = 1) {
  const u = new URL(`${BASE}/AjaxCalling/GetQuestions`);
  u.searchParams.set("TopicIDs", topicIds);
  u.searchParams.set("QuestionSubTypeID", String(subTypeId));
  u.searchParams.set("QuestionPeriorityID", String(priorityId));
  u.searchParams.set("SyllabusType", "0");
  const res = await req(u.toString());
  if (!res.ok) return [];
  const data = JSON.parse(await res.text());
  return data.QuestionsList || [];
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  await login();

  // First check what the GetGenerate page returns for English Ch8
  console.log("\n=== Checking GetGenerate API for English Chapter ===");
  const hierGen = await (await req(`${BASE}/AjaxCalling/ChaptersListBySubjectID?SubjectID=101`)).json();
  const topicsAll = hierGen.TopicsList || [];
  const ch8Topics = topicsAll.filter(t => t.ChapterID === 6385);
  const ch8TopicIds = ch8Topics.map(t => t.TopicID).join(",");
  console.log("Ch8 topic IDs:", ch8TopicIds);

  // Try GetQuestionSubTypes endpoint
  const subtypes = await req(`${BASE}/AjaxCalling/GetQuestionSubTypes?SubjectID=101`);
  if (subtypes.ok) {
    const st = await subtypes.text();
    console.log("\nGetQuestionSubTypes response:", st.slice(0, 500));
  }

  // Try different endpoints PTS uses
  for (const ep of [
    `/AjaxCalling/GetQuestionTypes?SubjectID=101&ClassID=11`,
    `/AjaxCalling/GetSubTypes?SubjectID=101`,
    `/GeneratePaper/GetQuestionSubTypes?SubjectID=101`,
    `/GeneratePaper/GetTypes?SubjectID=101&ClassID=11`,
  ]) {
    const r = await req(`${BASE}${ep}`);
    if (r.ok) {
      const t = await r.text();
      if (t.length > 2) console.log(`\n${ep}:`, t.slice(0, 300));
    }
    await sleep(200);
  }


  // Get Chapter 8 topics for Class 11 English (SubjectID=101)
  const hier = await (await req(`${BASE}/AjaxCalling/ChaptersListBySubjectID?SubjectID=101`)).json();
  const chapters = hier.ChaptersList || [];
  const topics = hier.TopicsList || [];
  
  // Find Chapter 8 "Clean Water"
  const ch8 = chapters.find(c => c.ChapterNo === 8 || c.ChapterName?.toLowerCase().includes("clean water"));
  console.log("Chapter 8:", ch8?.ChapterName, "ID:", ch8?.ChapterID);
  
  const ch8Topics = topics.filter(t => t.ChapterID === ch8?.ChapterID);
  const topicIds = ch8Topics.map(t => t.TopicID).join(",");
  console.log("Chapter 8 topic IDs:", topicIds);
  console.log("Topics:", ch8Topics.map(t => t.TopicName));

  // Also get ALL topics to see full list
  console.log("\nAll topics count:", topics.length);
  const allTopicIds = topics.map(t => t.TopicID).join(",");

  // Probe type IDs 1-100 to find SYNONYM and PUNCTUATION
  console.log("\n=== Probing type IDs (all topics) for non-zero results ===");
  
  for (let id = 1; id <= 100; id++) {
    await sleep(80);
    const qs = await getQuestions(allTopicIds.split(",").slice(0,5).join(","), id);
    if (qs.length > 0) {
      const sample = qs[0];
      const text = (sample.QuestionText || sample.Question || "")
        .replace(/<[^>]+>/g, "").trim().slice(0, 80);
      console.log(`  TypeID=${id}: ${qs.length} questions | sample: "${text}"`);
    }
  }

  // Also try with SyllabusType=1 (Full Syllabus)
  console.log("\n=== Probing with SyllabusType=1 ===");
  for (let id = 1; id <= 100; id++) {
    await sleep(80);
    const u = new URL(`${BASE}/AjaxCalling/GetQuestions`);
    u.searchParams.set("TopicIDs", allTopicIds.split(",").slice(0,5).join(","));
    u.searchParams.set("QuestionSubTypeID", String(id));
    u.searchParams.set("QuestionPeriorityID", "1");
    u.searchParams.set("SyllabusType", "1");
    const res = await req(u.toString());
    if (!res.ok) continue;
    const data = JSON.parse(await res.text());
    const qs = data.QuestionsList || [];
    if (qs.length > 0) {
      const sample = qs[0];
      const text = (sample.QuestionText || sample.Question || "")
        .replace(/<[^>]+>/g, "").trim().slice(0, 80);
      console.log(`  TypeID=${id}: ${qs.length} questions | sample: "${text}"`);
    }
  }
}

main().catch(console.error);
