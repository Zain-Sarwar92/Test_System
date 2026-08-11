export type AssignmentCompletionStatus =
  | "COMPLETED"
  | "OVERDUE"
  | "PENDING"
  | "UPCOMING";

/**
 * Days before testDate (inclusive) that count as PENDING rather than UPCOMING.
 * Teachers should prepare papers due within this window; email still goes only
 * the day before the test.
 */
export const PENDING_WINDOW_DAYS = 7;

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function daysBetween(from: Date, to: Date): number {
  const ms = startOfDay(to).getTime() - startOfDay(from).getTime();
  return Math.round(ms / (24 * 60 * 60 * 1000));
}

/**
 * Resolve a teacher's completion status for a scheduled test.
 * COMPLETED only when a paper is actually linked — `completedAt` alone is ignored
 * so deleting a paper correctly reopens the assignment.
 */
export function resolveAssignmentStatus(input: {
  testDate: Date;
  hasCreatedTest: boolean;
  completedAt?: Date | null;
  now?: Date;
}): AssignmentCompletionStatus {
  if (input.hasCreatedTest) {
    return "COMPLETED";
  }

  const now = input.now ?? new Date();
  const daysUntil = daysBetween(now, input.testDate);

  if (daysUntil < 0) {
    return "OVERDUE";
  }
  if (daysUntil <= PENDING_WINDOW_DAYS) {
    return "PENDING";
  }
  return "UPCOMING";
}

export function daysUntilTest(testDate: Date, now: Date = new Date()): number {
  return daysBetween(now, testDate);
}

/** Soft in-app window: paper is due within the next week. */
export function isDueWithinWeek(testDate: Date, now: Date = new Date()): boolean {
  const days = daysBetween(now, testDate);
  return days >= 0 && days <= PENDING_WINDOW_DAYS;
}

/** Email window: only the day before the test. */
export function isDueTomorrow(testDate: Date, now: Date = new Date()): boolean {
  return daysBetween(now, testDate) === 1;
}

export function formatScheduleDate(date: Date): string {
  const weekday = date.toLocaleDateString("en-GB", { weekday: "short" });
  const rest = date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  return `${weekday} ${rest}`;
}

export function statusChipClass(status: AssignmentCompletionStatus): string {
  switch (status) {
    case "COMPLETED":
      return "status-chip status-chip-success";
    case "OVERDUE":
      return "status-chip status-chip-danger";
    case "PENDING":
      return "status-chip status-chip-warn";
    case "UPCOMING":
      return "status-chip status-chip-info";
    default:
      return "status-chip status-chip-muted";
  }
}
