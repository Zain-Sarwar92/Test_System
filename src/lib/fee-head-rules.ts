import type { FeeFrequency } from "@/generated/prisma/client";

export const MONTH_OPTIONS = [
  { value: 1, label: "Jan" },
  { value: 2, label: "Feb" },
  { value: 3, label: "Mar" },
  { value: 4, label: "Apr" },
  { value: 5, label: "May" },
  { value: 6, label: "Jun" },
  { value: 7, label: "Jul" },
  { value: 8, label: "Aug" },
  { value: 9, label: "Sep" },
  { value: 10, label: "Oct" },
  { value: 11, label: "Nov" },
  { value: 12, label: "Dec" },
] as const;

export type FeeHeadRule = {
  frequency: FeeFrequency;
  applicableMonths: number[];
};

export function periodMonth(periodKey: string) {
  return Number(periodKey.slice(5, 7));
}

/** Whether this fee type is collectable in YYYY-MM. */
export function feeHeadDueInPeriod(head: FeeHeadRule, periodKey: string) {
  if (head.frequency === "ONE_TIME") return true;
  const month = periodMonth(periodKey);
  if (head.frequency === "QUARTERLY") {
    return [1, 4, 7, 10].includes(month);
  }
  if (head.frequency === "ANNUAL") {
    return month === 1;
  }
  // MONTHLY — optional month whitelist
  if (!head.applicableMonths.length) return true;
  return head.applicableMonths.includes(month);
}

export function feeHeadFrequencyLabel(frequency: FeeFrequency) {
  switch (frequency) {
    case "ONE_TIME":
      return "One-time";
    case "QUARTERLY":
      return "Quarterly";
    case "ANNUAL":
      return "Annual";
    default:
      return "Monthly";
  }
}

export function feeHeadMonthsLabel(months: number[]) {
  if (!months.length) return "Every month";
  const labels = MONTH_OPTIONS.filter((m) => months.includes(m.value)).map((m) => m.label);
  return labels.join(", ");
}

/** Charge period key used for one-time heads (admission etc.). */
export const ONE_TIME_PERIOD_KEY = "ONCE";

export const DEFAULT_FEE_HEAD_SEEDS = [
  {
    name: "Monthly Fee",
    category: "TUITION" as const,
    frequency: "MONTHLY" as const,
    description: "Regular monthly tuition",
  },
  {
    name: "Admission Fee",
    category: "ADMISSION" as const,
    frequency: "ONE_TIME" as const,
    description: "Paid once per student",
    defaultAmount: "5000",
  },
  {
    name: "Generator Dues",
    category: "GENERATOR" as const,
    frequency: "MONTHLY" as const,
    description: "Set specific months if not every month",
  },
  {
    name: "Test Dues",
    category: "TEST_DUES" as const,
    frequency: "MONTHLY" as const,
    description: "Monthly or custom months",
  },
] as const;
