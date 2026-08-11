"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/lib/rbac";
import { SETTING_KEYS, setSystemSettings } from "@/lib/system-settings";

const settingsSchema = z.object({
  platformName: z.string().trim().min(2).max(120),
  defaultDurationMinutes: z.coerce.number().int().min(5).max(300),
  defaultMcqMarks: z.coerce.number().int().min(1).max(100),
  defaultShortMarks: z.coerce.number().int().min(1).max(100),
  defaultLongMarks: z.coerce.number().int().min(1).max(100),
  maintenanceMode: z.enum(["true", "false"]),
});

export async function saveSystemSettings(formData: FormData) {
  await requireRole(["SUPER_ADMIN"]);

  const parsed = settingsSchema.parse({
    platformName: formData.get("platformName"),
    defaultDurationMinutes: formData.get("defaultDurationMinutes"),
    defaultMcqMarks: formData.get("defaultMcqMarks"),
    defaultShortMarks: formData.get("defaultShortMarks"),
    defaultLongMarks: formData.get("defaultLongMarks"),
    maintenanceMode: formData.get("maintenanceMode"),
  });

  await setSystemSettings({
    [SETTING_KEYS.platformName]: parsed.platformName,
    [SETTING_KEYS.defaultDurationMinutes]: String(parsed.defaultDurationMinutes),
    [SETTING_KEYS.defaultMcqMarks]: String(parsed.defaultMcqMarks),
    [SETTING_KEYS.defaultShortMarks]: String(parsed.defaultShortMarks),
    [SETTING_KEYS.defaultLongMarks]: String(parsed.defaultLongMarks),
    [SETTING_KEYS.maintenanceMode]: parsed.maintenanceMode,
  });

  revalidatePath("/super-admin/settings");
  revalidatePath("/super-admin");
}
