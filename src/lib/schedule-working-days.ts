/** Working days = Mon–Sat; Sunday is always off. */

export function parseYmd(ymd: string): Date {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(y!, m! - 1, d!);
}

export function formatYmd(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

const WEEKDAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

/** Three-letter weekday for a YYYY-MM-DD value, or "" if invalid/empty. */
export function weekdayShortFromYmd(ymd: string): string {
  const trimmed = ymd.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return "";
  const date = parseYmd(trimmed);
  if (Number.isNaN(date.getTime())) return "";
  return WEEKDAY_SHORT[date.getDay()] ?? "";
}

export function isSunday(date: Date): boolean {
  return date.getDay() === 0;
}

/** Move forward/backward by `count` working days (skips Sunday). count=0 returns same day. */
export function addWorkingDays(start: Date, count: number): Date {
  const date = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  if (count === 0) return date;
  if (count > 0) {
    let added = 0;
    while (added < count) {
      date.setDate(date.getDate() + 1);
      if (!isSunday(date)) added += 1;
    }
    return date;
  }
  let remaining = -count;
  while (remaining > 0) {
    date.setDate(date.getDate() - 1);
    if (!isSunday(date)) remaining -= 1;
  }
  return date;
}

export function addWorkingDaysYmd(ymd: string, count: number): string {
  return formatYmd(addWorkingDays(parseYmd(ymd), count));
}

/**
 * Signed working-day distance from `fromYmd` to `toYmd` (Sunday not counted).
 * Same calendar day → 0.
 */
export function workingDaysBetween(fromYmd: string, toYmd: string): number {
  const from = parseYmd(fromYmd);
  const to = parseYmd(toYmd);
  const fromKey = formatYmd(from);
  const toKey = formatYmd(to);
  if (fromKey === toKey) return 0;

  const forward = from.getTime() < to.getTime();
  const date = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const end = new Date(to.getFullYear(), to.getMonth(), to.getDate());
  let count = 0;
  if (forward) {
    while (date.getTime() < end.getTime()) {
      date.setDate(date.getDate() + 1);
      if (!isSunday(date)) count += 1;
    }
    return count;
  }
  while (date.getTime() > end.getTime()) {
    date.setDate(date.getDate() - 1);
    if (!isSunday(date)) count += 1;
  }
  return -count;
}

/**
 * Sum of delay gaps on this round and earlier rounds (Round 2+).
 * gapsBeforeRound[i] = extra working days applied starting at Round i+1
 * (pushes that round and all later rounds). Round 1 (index 0) is usually 0.
 */
export function cumulativeGapWorkingDays(
  gapsBeforeRound: number[],
  roundIndexZeroBased: number,
): number {
  let sum = 0;
  for (let i = 0; i <= roundIndexZeroBased; i++) {
    sum += Math.max(0, Math.floor(gapsBeforeRound[i] ?? 0));
  }
  return sum;
}

/**
 * Working days covered by Round 1, from its earliest to its latest test date.
 * Subjects sharing a date count once, so a round is only as long as the days it
 * actually uses (Physics 19, Bio+Computer 20, Islamiyat+Pak Studies 21 → 3).
 */
export function roundStrideWorkingDays(round1Ymds: string[]): number {
  const dates = round1Ymds
    .map((ymd) => ymd.trim())
    .filter((ymd) => /^\d{4}-\d{2}-\d{2}$/.test(ymd))
    .sort();
  const first = dates[0];
  const last = dates[dates.length - 1];
  if (!first || !last) return 1;
  return Math.max(1, workingDaysBetween(first, last) + 1);
}

/**
 * Round k date for a subject =
 * Round 1 date + (k-1) * roundStride + cumulative gaps before k
 * (working days; Sunday off). Same arrangement every round.
 */
export function dateForRound(
  round1Ymd: string,
  roundIndexZeroBased: number,
  roundStride: number,
  extraWorkingDays = 0,
): string {
  const base = parseYmd(round1Ymd);
  const offset =
    Math.max(0, roundIndexZeroBased) * Math.max(roundStride, 1) +
    Math.max(0, extraWorkingDays);
  if (offset <= 0) return formatYmd(base);
  return formatYmd(addWorkingDays(base, offset));
}
