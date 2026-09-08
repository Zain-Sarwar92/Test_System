import type { FeeCategory } from "@/generated/prisma/client";

export const FEE_CATEGORIES = [
  "TUITION",
  "TEST_DUES",
  "GENERATOR",
  "ADMISSION",
  "LAB",
  "TRANSPORT",
  "OTHER",
] as const satisfies readonly FeeCategory[];

export type FeeCategoryValue = (typeof FEE_CATEGORIES)[number];

export const FEE_CATEGORY_LABELS: Record<FeeCategory, string> = {
  TUITION: "Tuition / monthly fee",
  TEST_DUES: "Test dues",
  GENERATOR: "Generator dues",
  ADMISSION: "Admission",
  LAB: "Lab / practical",
  TRANSPORT: "Transport",
  OTHER: "Other",
};

export function feeCategoryLabel(category: FeeCategory | string) {
  return FEE_CATEGORY_LABELS[category as FeeCategory] ?? category;
}
