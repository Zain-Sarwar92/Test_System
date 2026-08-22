/**
 * How many questions count toward section / paper total marks.
 * When "attempt any N" is set (N < printed count), only N are scored.
 */
export function scoredQuestionCount(
  printedCount: number,
  attemptCount?: number | null,
): number {
  const attempt = typeof attemptCount === "number" ? attemptCount : 0;
  if (attempt > 0 && attempt < printedCount) return attempt;
  return Math.max(0, printedCount);
}

/** Section total = scored count × marks each. */
export function sectionTotalMarks(input: {
  questionCount: number;
  marksEach: number;
  attemptCount?: number | null;
}): number {
  return (
    scoredQuestionCount(input.questionCount, input.attemptCount) *
    input.marksEach
  );
}

/** Parse "Short Questions: Attempt any 4 out of 6." from saved instructions. */
export function parseAttemptCountFromInstructions(
  instructions: string | null | undefined,
  type: "MCQ" | "SHORT" | "LONG",
): number | undefined {
  if (!instructions) return undefined;
  const label =
    type === "MCQ"
      ? "Multiple Choice"
      : type === "SHORT"
        ? "Short Questions"
        : "Long Questions";
  const match = instructions.match(
    new RegExp(`${label}:\\s*Attempt any\\s+(\\d+)\\s+out of\\s+(\\d+)`, "i"),
  );
  if (!match) return undefined;
  const attempt = Number(match[1]);
  return Number.isFinite(attempt) && attempt > 0 ? attempt : undefined;
}
