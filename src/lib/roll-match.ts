/** Roll numbers are compared without padding zeros so "007" matches "7". */
export function normalizeRollNumber(roll: string): string {
  const trimmed = roll.trim().toUpperCase();
  const digits = trimmed.replace(/[^0-9]/g, "");
  return digits ? String(Number(digits)) : trimmed;
}

/** Loose check: sheet name vs roster name for the same roll number. */
export function namesLikelyMatch(
  sheetName: string | undefined | null,
  tableName: string,
): boolean {
  const fromSheet = sheetName?.trim().toLowerCase();
  const fromTable = tableName.trim().toLowerCase();
  if (!fromSheet) return true;
  if (!fromTable) return true;
  if (fromSheet === fromTable) return true;
  const sheetFirst = fromSheet.split(/\s+/)[0] ?? "";
  const tableFirst = fromTable.split(/\s+/)[0] ?? "";
  return sheetFirst.length >= 3 && sheetFirst === tableFirst;
}
