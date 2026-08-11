/**
 * Unify PTS media paths + download all referenced equation/diagram assets.
 *
 * - Merges public/pts-equations → public/pts-media/equations
 * - Rewrites all-questions.json: /pts-equations/ → /pts-media/equations/
 * - Also normalizes bare /Equations/ and /Diagrams/ → /pts-media/...
 * - Downloads any missing files from paktestsolution.com
 *
 * Usage: node scripts/fix-pts-media-everywhere.mjs
 */
import fs from "node:fs";
import path from "node:path";

const BASE = "https://www.paktestsolution.com";
const ROOT = path.join(process.cwd(), "data", "lahore-board");
const MEDIA = path.join(process.cwd(), "public", "pts-media");
const LEGACY = path.join(process.cwd(), "public", "pts-equations");

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

function copyDir(src, dest) {
  if (!fs.existsSync(src)) return { copied: 0 };
  let copied = 0;
  for (const file of walk(src)) {
    const rel = path.relative(src, file).replace(/\\/g, "/");
    const destFile = path.join(dest, rel);
    fs.mkdirSync(path.dirname(destFile), { recursive: true });
    if (!fs.existsSync(destFile) || fs.statSync(destFile).size === 0) {
      fs.copyFileSync(file, destFile);
      copied++;
    }
  }
  return { copied };
}

function normalizeHtmlPaths(html) {
  if (!html || typeof html !== "string") return html;
  let s = html;
  s = s.replace(/\/pts-equations\//gi, "/pts-media/equations/");
  s = s.replace(
    /src=(["'])\/Equations\//gi,
    (_m, q) => `src=${q}/pts-media/equations/`,
  );
  s = s.replace(
    /src=(["'])https?:\/\/[^"']*\/Equations\//gi,
    (_m, q) => `src=${q}/pts-media/equations/`,
  );
  s = s.replace(
    /src=(["'])\/((?:Diagrams|Images|Content|UploadImages)\/)/gi,
    (_m, q, folder) => `src=${q}/pts-media/${folder}`,
  );
  s = s.replace(
    /src=(["'])https?:\/\/[^"']*\/((?:Diagrams|Images|Content|UploadImages)\/)/gi,
    (_m, q, folder) => `src=${q}/pts-media/${folder}`,
  );
  return s;
}

function collectFromText(text, set) {
  if (!text) return;
  for (const m of String(text).matchAll(
    /\/pts-media\/((?:equations|Diagrams|Images|Content|UploadImages)\/[^"'>\s]+)/gi,
  )) {
    set.add(m[1].replace(/\\/g, "/"));
  }
  for (const m of String(text).matchAll(/\/Equations\/([^"'>\s]+)/gi)) {
    set.add(`equations/${m[1]}`.replace(/\\/g, "/"));
  }
  for (const m of String(text).matchAll(
    /\/((?:Diagrams|Images|Content|UploadImages)\/[^"'>\s]+)/gi,
  )) {
    set.add(m[1].replace(/\\/g, "/"));
  }
  for (const m of String(text).matchAll(
    /\/pts-equations\/([^"'>\s]+)/gi,
  )) {
    set.add(`equations/${m[1]}`.replace(/\\/g, "/"));
  }
}

function rewriteAllQuestionsFile(file) {
  const raw = fs.readFileSync(file, "utf8");
  if (
    !raw.includes("pts-equations") &&
    !raw.includes("/Equations/") &&
    !raw.includes("/Diagrams/") &&
    !raw.includes("/Images/")
  ) {
    return { changed: false, text: raw };
  }
  const data = JSON.parse(raw);
  let changed = false;
  const rewriteQ = (q) => {
    for (const key of [
      "en",
      "ur",
      "optionA",
      "optionB",
      "optionC",
      "optionD",
      "text",
      "textUrdu",
    ]) {
      if (typeof q[key] === "string") {
        const next = normalizeHtmlPaths(q[key]);
        if (next !== q[key]) {
          q[key] = next;
          changed = true;
        }
      }
    }
  };
  if (Array.isArray(data.questions)) data.questions.forEach(rewriteQ);
  else if (Array.isArray(data)) data.forEach(rewriteQ);
  if (!changed) return { changed: false, text: raw };
  const text = JSON.stringify(data, null, 2);
  fs.writeFileSync(file, text);
  return { changed: true, text };
}

async function downloadOne(rel) {
  const dest = path.join(MEDIA, rel);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  if (fs.existsSync(dest) && fs.statSync(dest).size > 0) return "skipped";
  const urlPath = rel.toLowerCase().startsWith("equations/")
    ? `/Equations/${rel.slice(rel.indexOf("/") + 1)}`
    : `/${rel}`;
  try {
    const res = await fetch(`${BASE}${urlPath}`);
    if (!res.ok) return "failed";
    fs.writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
    return "downloaded";
  } catch {
    return "failed";
  }
}

async function main() {
  fs.mkdirSync(MEDIA, { recursive: true });
  const merge = copyDir(LEGACY, path.join(MEDIA, "equations"));
  console.log("Merged pts-equations → pts-media/equations:", merge);

  let rewritten = 0;
  const mediaSet = new Set();
  for (const file of walk(ROOT)) {
    if (!file.endsWith(".json")) continue;
    const base = path.basename(file);
    const text = fs.readFileSync(file, "utf8");
    collectFromText(text, mediaSet);
    if (base === "all-questions.json") {
      const r = rewriteAllQuestionsFile(file);
      if (r.changed) rewritten++;
      collectFromText(r.text || text, mediaSet);
    }
  }
  console.log(`Rewrote all-questions.json files: ${rewritten}`);
  console.log(`Unique media refs: ${mediaSet.size}`);

  let downloaded = 0;
  let skipped = 0;
  let failed = 0;
  let i = 0;
  for (const rel of mediaSet) {
    i++;
    if (i % 200 === 0) process.stdout.write(`\rDownload ${i}/${mediaSet.size}`);
    const st = await downloadOne(rel);
    if (st === "downloaded") downloaded++;
    else if (st === "skipped") skipped++;
    else failed++;
  }
  console.log("\nMedia download:", { downloaded, skipped, failed, total: mediaSet.size });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
