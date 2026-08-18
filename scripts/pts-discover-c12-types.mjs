const BASE = "https://www.paktestsolution.com";
const USER = process.env.PTS_USER;
const PASS = process.env.PTS_PASS;

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

async function main() {
  const u = new URL(`${BASE}/Home/CheckLogin`);
  u.searchParams.set("emailAddress", USER);
  u.searchParams.set("password", PASS);
  const j = await (await req(u.toString())).json();
  await req(`${BASE}${j.html}`);
  await req(`${BASE}/GeneratePaper/GetSyllabus`);

  const hier = JSON.parse(
    await (await req(`${BASE}/AjaxCalling/ChaptersListBySubjectID?SubjectID=123`)).text(),
  );
  const ch1 = hier.TopicsList?.[0];
  const topicIds = String(ch1?.TopicID ?? "");
  console.log("Ch1 topic:", ch1?.TopicName, topicIds);

  console.log("\nProbing type IDs 1-60 on topic", topicIds);
  for (let id = 1; id <= 60; id++) {
    const u2 = new URL(`${BASE}/AjaxCalling/GetQuestions`);
    u2.searchParams.set("TopicIDs", topicIds);
    u2.searchParams.set("QuestionSubTypeID", String(id));
    u2.searchParams.set("QuestionPeriorityID", "1");
    u2.searchParams.set("SyllabusType", "1");
    const res = await req(u2.toString());
    if (!res.ok) continue;
    const qs = (JSON.parse(await res.text()).QuestionsList) || [];
    if (qs.length > 0) {
      const text = (qs[0].EnglishQuestionDetails || qs[0].QuestionText || "")
        .replace(/<[^>]+>/g, " ")
        .trim()
        .slice(0, 60);
      console.log(`  TypeID=${id}: ${qs.length} | ${text}`);
    }
    await new Promise((r) => setTimeout(r, 80));
  }
}

main().catch(console.error);
