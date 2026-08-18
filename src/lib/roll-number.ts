/** Increment a roll like "9" → "10", "01" → "02", or "A-09" → "A-10". */
export function incrementRollNumber(rollNumber: string) {
  const match = rollNumber.trim().match(/^(.*?)(\d+)$/);
  if (!match) return null;
  const nextDigits = (BigInt(match[2]) + 1n).toString().padStart(match[2].length, "0");
  return `${match[1]}${nextDigits}`;
}

/** Next roll in a section: max existing numeric roll + 1. Empty if none yet. */
export function suggestNextRollNumber(rollNumbers: string[]) {
  let best: { numeric: bigint; next: string } | null = null;

  for (const raw of rollNumbers) {
    const match = raw.trim().match(/^(.*?)(\d+)$/);
    if (!match) continue;
    const numeric = BigInt(match[2]);
    if (best && numeric <= best.numeric) continue;
    const next = incrementRollNumber(raw.trim());
    if (!next) continue;
    best = { numeric, next };
  }

  return best?.next ?? "";
}
