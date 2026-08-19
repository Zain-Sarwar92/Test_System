import { mkdir, readFile, unlink, writeFile } from "fs/promises";
import path from "path";

const DATA_PREFIX = "private/result-sheets/";

function storageRoot() {
  if (process.env.VERCEL) {
    return path.join("/tmp", "private-uploads");
  }
  return path.join(process.cwd(), "data", "private-uploads");
}

export function isDataImagePath(imagePath: string) {
  return imagePath.startsWith("data:image/");
}

export function isPrivateSheetPath(imagePath: string) {
  return imagePath.startsWith(DATA_PREFIX);
}

function assertSafeRelative(relative: string) {
  const normalized = path.posix.normalize(relative).replace(/^\/+/, "");
  if (normalized.includes("..") || !normalized.startsWith(DATA_PREFIX)) {
    throw new Error("Invalid sheet path");
  }
  return normalized;
}

export async function saveAssessmentSheetFile(input: {
  organizationId: string;
  assessmentId: string;
  ext: string;
  mimeType: string;
  bytes: Buffer;
}): Promise<string> {
  if (process.env.VERCEL) {
    return `data:${input.mimeType};base64,${input.bytes.toString("base64")}`;
  }

  const fileName = `${crypto.randomUUID()}.${input.ext}`;
  const relative = path.posix.join(
    "private/result-sheets",
    input.organizationId,
    input.assessmentId,
    fileName,
  );
  const diskPath = path.join(storageRoot(), relative);
  await mkdir(path.dirname(diskPath), { recursive: true });
  await writeFile(diskPath, input.bytes);
  return relative;
}

export async function readAssessmentSheetBytes(imagePath: string): Promise<{
  bytes: Buffer;
  mimeType: string;
}> {
  if (isDataImagePath(imagePath)) {
    const match = imagePath.match(/^data:(image\/(?:jpeg|png|webp));base64,(.+)$/i);
    if (!match) throw new Error("Sheet image file is missing on the server. Upload it again.");
    return {
      mimeType: match[1].toLowerCase(),
      bytes: Buffer.from(match[2], "base64"),
    };
  }

  const relative = assertSafeRelative(imagePath);
  const diskPath = path.join(storageRoot(), relative);
  const bytes = await readFile(diskPath);
  const ext = path.extname(diskPath).toLowerCase();
  const mimeType =
    ext === ".png" ? "image/png" : ext === ".webp" ? "image/webp" : "image/jpeg";
  return { bytes, mimeType };
}

export async function deleteAssessmentSheetFile(imagePath: string) {
  if (isDataImagePath(imagePath) || !isPrivateSheetPath(imagePath)) return;
  try {
    const relative = assertSafeRelative(imagePath);
    await unlink(path.join(storageRoot(), relative));
  } catch {
    // Missing file is fine — the DB row is the source of truth.
  }
}
