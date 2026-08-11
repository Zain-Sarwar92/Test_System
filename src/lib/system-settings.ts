import { prisma } from "@/lib/prisma";

export const SETTING_KEYS = {
  platformName: "platform_name",
  defaultDurationMinutes: "default_duration_minutes",
  defaultMcqMarks: "default_mcq_marks",
  defaultShortMarks: "default_short_marks",
  defaultLongMarks: "default_long_marks",
  maintenanceMode: "maintenance_mode",
} as const;

export const DEFAULT_SETTINGS: Record<string, string> = {
  [SETTING_KEYS.platformName]: "Test Hub",
  [SETTING_KEYS.defaultDurationMinutes]: "60",
  [SETTING_KEYS.defaultMcqMarks]: "1",
  [SETTING_KEYS.defaultShortMarks]: "2",
  [SETTING_KEYS.defaultLongMarks]: "5",
  [SETTING_KEYS.maintenanceMode]: "false",
};

export async function getSystemSettings(): Promise<Record<string, string>> {
  const rows = await prisma.systemSetting.findMany();
  const map = { ...DEFAULT_SETTINGS };
  for (const row of rows) {
    map[row.key] = row.value;
  }
  return map;
}

export async function setSystemSettings(values: Record<string, string>) {
  const entries = Object.entries(values);
  await prisma.$transaction(
    entries.map(([key, value]) =>
      prisma.systemSetting.upsert({
        where: { key },
        create: { key, value },
        update: { value },
      }),
    ),
  );
}
