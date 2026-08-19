import { mkdir, writeFile } from "fs/promises";
import path from "path";

const LOGO_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

const MAX_LOGO_BYTES = 2 * 1024 * 1024;
const DATA_IMAGE_RE =
  /^data:image\/(jpeg|jpg|png|webp|gif)(;charset=[\w-]+)?;base64,[a-z0-9+/_-]+={0,2}$/i;
const LOCAL_LOGO_RE = /^\/(uploads\/org-logos\/|brand\/)[a-z0-9._-]+\.(jpe?g|png|webp|gif)$/i;

export function isSafeLogoUrl(value: string | null | undefined): boolean {
  const url = value?.trim() ?? "";
  if (!url) return true;
  if (url.startsWith("//")) return false;
  const lower = url.toLowerCase();
  if (LOCAL_LOGO_RE.test(url)) return true;
  if (lower.startsWith("data:image/")) {
    if (lower.startsWith("data:image/svg")) return false;
    return DATA_IMAGE_RE.test(url.replace(/\s+/g, ""));
  }
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") return false;
    if (parsed.username || parsed.password) return false;
    if (/\.svg$/i.test(parsed.pathname)) return false;
    return /\.(jpe?g|png|webp|gif)$/i.test(parsed.pathname);
  } catch {
    return false;
  }
}

export async function resolveLogoUrlFromForm(formData: FormData): Promise<string | null> {
  const file = formData.get("logoFile");
  if (file instanceof File && file.size > 0) {
    if (file.size > MAX_LOGO_BYTES) {
      throw new Error("Logo must be 2 MB or smaller");
    }
    const ext = LOGO_TYPES[file.type];
    if (!ext) {
      throw new Error("Upload a JPG, PNG, WEBP, or GIF logo");
    }
    const bytes = Buffer.from(await file.arrayBuffer());

    // Vercel serverless disk is read-only except /tmp — persist the image in the URL.
    if (process.env.VERCEL) {
      return `data:${file.type};base64,${bytes.toString("base64")}`;
    }

    const fileName = `${crypto.randomUUID()}.${ext}`;
    const relativeDir = path.posix.join("uploads", "org-logos");
    const diskDir = path.join(process.cwd(), "public", relativeDir);
    await mkdir(diskDir, { recursive: true });
    await writeFile(path.join(diskDir, fileName), bytes);
    return `/${relativeDir}/${fileName}`;
  }

  const url = String(formData.get("logoUrl") ?? "").trim();
  if (!url) return null;
  if (!isSafeLogoUrl(url)) {
    throw new Error("Upload a JPG, PNG, WEBP, or GIF logo, or use a https image URL");
  }
  return url;
}

/** On update: empty URL + no new file means keep the logo already saved. */
export async function resolveLogoUpdateFromForm(
  formData: FormData,
): Promise<{ keep: true } | { next: string | null }> {
  const file = formData.get("logoFile");
  if (file instanceof File && file.size > 0) {
    const next = await resolveLogoUrlFromForm(formData);
    return { next };
  }
  const url = String(formData.get("logoUrl") ?? "").trim();
  if (!url) return { keep: true };
  if (!isSafeLogoUrl(url)) {
    throw new Error("Upload a JPG, PNG, WEBP, or GIF logo, or use a https image URL");
  }
  return { next: url };
}
