import { mkdir, writeFile } from "fs/promises";
import path from "path";

const LOGO_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

const MAX_LOGO_BYTES = 2 * 1024 * 1024;

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
    const fileName = `${crypto.randomUUID()}.${ext}`;
    const relativeDir = path.posix.join("uploads", "org-logos");
    const diskDir = path.join(process.cwd(), "public", relativeDir);
    await mkdir(diskDir, { recursive: true });
    await writeFile(path.join(diskDir, fileName), Buffer.from(await file.arrayBuffer()));
    return `/${relativeDir}/${fileName}`;
  }

  const url = String(formData.get("logoUrl") ?? "").trim();
  return url || null;
}
