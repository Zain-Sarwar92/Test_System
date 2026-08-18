/** Roll numbers are compared without padding zeros so "007" matches "7". */
export function normalizeRollNumber(roll: string): string {
  const trimmed = roll.trim().toUpperCase();
  const digits = trimmed.replace(/[^0-9]/g, "");
  return digits ? String(Number(digits)) : trimmed;
}
