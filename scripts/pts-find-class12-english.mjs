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
  const j = await (await req(u)).json();
  await req(BASE + j.html);
  await req(`${BASE}/GeneratePaper/GetSyllabus`);
  console.log("Logged in");

  // PTS Class 12 English — try subject IDs
  for (const id of [101, 112, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 125, 126, 127, 128, 129, 130]) {
    const r = await req(`${BASE}/AjaxCalling/ChaptersListBySubjectID?SubjectID=${id}`);
    const t = await r.text();
    if (t.includes('"ClassID":12') || t.includes('"ClassID": 12')) {
      const m = t.match(/"ChapterName":"([^"]+)"/);
      console.log(`SubjectID=${id} has ClassID=12 | first chapter: ${m?.[1]?.slice(0, 50)}`);
    }
    await new Promise(r => setTimeout(r, 150));
  }
}

main().catch(console.error);
