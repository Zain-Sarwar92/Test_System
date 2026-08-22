export type QuestionMedium = "ENGLISH" | "URDU" | "BOTH";

function stripHtml(s: string): string {
  return s
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&quot;/gi, '"')
    .replace(/&apos;/gi, "'")
    .replace(/&#39;/g, "'")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) =>
      String.fromCharCode(parseInt(h, 16)),
    )
    .replace(/\s+/g, " ")
    .trim();
}

function hasUrduScript(s: string): boolean {
  return /[\u0600-\u06FF]/.test(s);
}

function hasLatinScript(s: string): boolean {
  return /[A-Za-z]{2,}/.test(s);
}

/**
 * Infer one question's language medium from stored text / textUrdu.
 */
export function inferQuestionMedium(
  text: string | null | undefined,
  textUrdu: string | null | undefined,
): QuestionMedium {
  const en = stripHtml(text ?? "");
  const ur = stripHtml(textUrdu ?? "");

  if (!en && !ur) return "ENGLISH";
  if (!en) return "URDU";
  if (!ur || ur === "—" || ur === ".") {
    // Prompt stored only in `text` (common for PTS Urdu paragraphs).
    return hasUrduScript(en) ? "URDU" : "ENGLISH";
  }

  // Same content duplicated in both columns → single medium.
  if (en === ur) {
    return hasUrduScript(en) ? "URDU" : "ENGLISH";
  }

  const enUrdu = hasUrduScript(en);
  const urUrdu = hasUrduScript(ur);
  const enLatin = hasLatinScript(en);

  if (enLatin && !enUrdu && urUrdu) return "BOTH";
  if (enUrdu && urUrdu) return "URDU";
  if (enLatin && !urUrdu) return "ENGLISH";
  if (!enLatin && urUrdu) return "URDU";
  return "BOTH";
}

/**
 * Aggregate medium for a question type / pool:
 * - all Urdu → URDU
 * - all English → ENGLISH
 * - any Dual or mix → BOTH
 */
export function aggregateQuestionsMedium(
  questions: Array<{ text: string; textUrdu: string | null }>,
): QuestionMedium {
  if (questions.length === 0) return "BOTH";
  let sawEnglish = false;
  let sawUrdu = false;
  let sawDual = false;
  for (const q of questions) {
    const m = inferQuestionMedium(q.text, q.textUrdu);
    if (m === "BOTH") sawDual = true;
    else if (m === "ENGLISH") sawEnglish = true;
    else sawUrdu = true;
    if (sawDual || (sawEnglish && sawUrdu)) return "BOTH";
  }
  if (sawDual) return "BOTH";
  if (sawEnglish && !sawUrdu) return "ENGLISH";
  if (sawUrdu && !sawEnglish) return "URDU";
  return "BOTH";
}
