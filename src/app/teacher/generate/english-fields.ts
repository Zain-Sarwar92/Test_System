export type EnglishFieldFilter =
  | "ALL"
  | "MCQ"
  | "COMPREHENSION"
  | "SPELLING"
  | "MEANING"
  | "SYNONYM"
  | "VERB"
  | "GRAMMAR"
  | "QA"
  | "DI"
  | "PAIR"
  | "ESSAYS"
  | "SUMMARY"
  | "TRANSLATE_UR"
  | "TRANSLATE_EN"
  | "POEM_STANZA"
  | "POEM"
  | "PASSAGE"
  | "PUNCTUATION"
  | "LONG"
  | "HADITH"
  | "PERSONALITY"
  | "AYAT"
  | "CORRECT"
  | "IDIOM"
  | "LETTER"
  | "APPLICATION"
  | "STORY"
  | "DIALOGUE"
  | "CENTRAL"
  | "TAFHEEM"
  | "VOICE";

export type QType = "MCQ" | "SHORT" | "LONG";

export const ENGLISH_FIELD_VALUES = [
  "ALL",
  "MCQ",
  "COMPREHENSION",
  "SPELLING",
  "MEANING",
  "SYNONYM",
  "VERB",
  "GRAMMAR",
  "QA",
  "DI",
  "PAIR",
  "ESSAYS",
  "SUMMARY",
  "TRANSLATE_UR",
  "TRANSLATE_EN",
  "POEM_STANZA",
  "POEM",
  "PASSAGE",
  "PUNCTUATION",
  "LONG",
  "HADITH",
  "PERSONALITY",
  "AYAT",
  "CORRECT",
  "IDIOM",
  "LETTER",
  "APPLICATION",
  "STORY",
  "DIALOGUE",
  "CENTRAL",
  "TAFHEEM",
  "VOICE",
] as const;

type EnglishTypeOption = {
  type: QType;
  field: EnglishFieldFilter;
  label: string;
  value: string;
};

/** Class 9 English — labels match PTS Generate Paper type list (exact order). */
export const CLASS9_ENGLISH_QUESTION_TYPE_OPTIONS: EnglishTypeOption[] = [
  {
    type: "MCQ",
    field: "COMPREHENSION",
    label: "Multiple Options (چارممکنہ جوابات)",
    value: "MCQ:COMPREHENSION",
  },
  {
    type: "MCQ",
    field: "SPELLING",
    label: "Tick Correct Spelling",
    value: "MCQ:SPELLING",
  },
  {
    type: "MCQ",
    field: "MEANING",
    label: "Correct Meaning Of Underlined Word",
    value: "MCQ:MEANING",
  },
  {
    type: "MCQ",
    field: "VERB",
    label: "Tick Correct Form Of Verb",
    value: "MCQ:VERB",
  },
  {
    type: "MCQ",
    field: "GRAMMAR",
    label: "Tick Correct According To Grammar",
    value: "MCQ:GRAMMAR",
  },
  {
    type: "SHORT",
    field: "QA",
    label: "Question Answers (سوالات جوابات)",
    value: "SHORT:QA",
  },
  {
    type: "LONG",
    field: "LETTER",
    label: "Letters (خطوط)",
    value: "LONG:LETTER",
  },
  {
    type: "SHORT",
    field: "TRANSLATE_EN",
    label: "Translate Into English Sentences",
    value: "SHORT:TRANSLATE_EN",
  },
  {
    type: "SHORT",
    field: "VOICE",
    label: "Active & Passive Voice",
    value: "SHORT:VOICE",
  },
  {
    type: "LONG",
    field: "STORY",
    label: "Stories (کہانیاں)",
    value: "LONG:STORY",
  },
  {
    type: "LONG",
    field: "SUMMARY",
    label: "Summary (خلاصہ) Matric",
    value: "LONG:SUMMARY",
  },
  {
    type: "LONG",
    field: "DIALOGUE",
    label: "Dialogues (مکالمے)",
    value: "LONG:DIALOGUE",
  },
  {
    type: "SHORT",
    field: "PAIR",
    label: "Words Into Sentences (الفاظ کو جملوں میں استعمال)",
    value: "SHORT:PAIR",
  },
  {
    type: "SHORT",
    field: "IDIOM",
    label: "Idioms",
    value: "SHORT:IDIOM",
  },
  {
    type: "LONG",
    field: "TRANSLATE_UR",
    label: "Translate Into Urdu Paragraphs",
    value: "LONG:TRANSLATE_UR",
  },
  {
    type: "LONG",
    field: "PASSAGE",
    label: "Comprehension Paragraphs (تفہیم عبارات)",
    value: "LONG:PASSAGE",
  },
  {
    type: "LONG",
    field: "POEM_STANZA",
    label: "Poems Stanzas",
    value: "LONG:POEM_STANZA",
  },
];

/** Default / Class 10+ English bank fields when generating papers. */
export const ENGLISH_QUESTION_TYPE_OPTIONS: EnglishTypeOption[] = [
  {
    type: "MCQ",
    field: "COMPREHENSION",
    label: "Multiple options",
    value: "MCQ:COMPREHENSION",
  },
  {
    type: "MCQ",
    field: "SPELLING",
    label: "Tick correct spelling",
    value: "MCQ:SPELLING",
  },
  {
    type: "MCQ",
    field: "MEANING",
    label: "Correct meaning of underlined word",
    value: "MCQ:MEANING",
  },
  {
    type: "MCQ",
    field: "SYNONYM",
    label: "Tick cross synonyms / antonyms",
    value: "MCQ:SYNONYM",
  },
  {
    type: "MCQ",
    field: "VERB",
    label: "Tick correct form of verb",
    value: "MCQ:VERB",
  },
  {
    type: "MCQ",
    field: "GRAMMAR",
    label: "Tick correct according to grammar",
    value: "MCQ:GRAMMAR",
  },
  {
    type: "SHORT",
    field: "QA",
    label: "Question Answers",
    value: "SHORT:QA",
  },
  {
    type: "SHORT",
    field: "DI",
    label: "Direct & Indirect",
    value: "SHORT:DI",
  },
  {
    type: "SHORT",
    field: "PAIR",
    label: "Words into sentences",
    value: "SHORT:PAIR",
  },
  {
    type: "LONG",
    field: "ESSAYS",
    label: "Essays",
    value: "LONG:ESSAYS",
  },
  {
    type: "LONG",
    field: "SUMMARY",
    label: "Summary (Matric)",
    value: "LONG:SUMMARY",
  },
  {
    type: "LONG",
    field: "TRANSLATE_UR",
    label: "Translate into Urdu",
    value: "LONG:TRANSLATE_UR",
  },
  {
    type: "LONG",
    field: "TRANSLATE_EN",
    label: "Translate into English",
    value: "LONG:TRANSLATE_EN",
  },
  {
    type: "LONG",
    field: "POEM_STANZA",
    label: "Poem Stanzas",
    value: "LONG:POEM_STANZA",
  },
  {
    type: "LONG",
    field: "PUNCTUATION",
    label: "Punctuate the paragraph",
    value: "LONG:PUNCTUATION",
  },
];

export function isIntermediateEnglishClass(className: string | null | undefined) {
  const n = (className ?? "").trim();
  return /\bclass\s*1[12]\b/i.test(n) || /\binter(?:mediate)?\b/i.test(n);
}

export function isClass9EnglishClass(className: string | null | undefined) {
  const n = (className ?? "").trim();
  return /\bclass\s*9\b/i.test(n) || /\b9th\b/i.test(n);
}

export function englishTypeCatalog(options?: {
  intermediate?: boolean;
  class9?: boolean;
}): EnglishTypeOption[] {
  if (options?.class9) return CLASS9_ENGLISH_QUESTION_TYPE_OPTIONS;
  return ENGLISH_QUESTION_TYPE_OPTIONS;
}

export const DEFAULT_ENGLISH_TYPE_FIELD = ENGLISH_QUESTION_TYPE_OPTIONS[0];

export function defaultEnglishFieldForType(
  type: QType,
  options?: { class9?: boolean },
): EnglishFieldFilter {
  const catalog = englishTypeCatalog(options);
  return (
    catalog.find((opt) => opt.type === type)?.field ??
    DEFAULT_ENGLISH_TYPE_FIELD.field
  );
}

export function englishTypeFieldSelectValue(
  type: QType,
  field: EnglishFieldFilter,
  options?: { class9?: boolean },
): string {
  const catalog = englishTypeCatalog(options);
  const exact = `${type}:${field}`;
  if (catalog.some((opt) => opt.value === exact)) {
    return exact;
  }
  return (
    catalog.find((opt) => opt.type === type)?.value ??
    DEFAULT_ENGLISH_TYPE_FIELD.value
  );
}

export function parseEnglishTypeField(
  value: string,
  options?: { class9?: boolean },
): { type: QType; field: EnglishFieldFilter } | null {
  const catalog = englishTypeCatalog(options);
  const match = catalog.find((opt) => opt.value === value);
  if (match) return { type: match.type, field: match.field };
  const [type, field] = value.split(":");
  if (type !== "MCQ" && type !== "SHORT" && type !== "LONG") return null;
  if (!ENGLISH_FIELD_VALUES.includes(field as EnglishFieldFilter)) return null;
  return { type, field: field as EnglishFieldFilter };
}

export function isEnglishSubjectName(name: string | null | undefined) {
  return /english/i.test((name ?? "").trim());
}

/** Class 11/12 (Intermediate) — PTS groups English by MCQ/SHORT/LONG, not granular fields. */
export const INTERMEDIATE_ENGLISH_TYPE_META: Record<
  QType,
  { label: string; urdu: string }
> = {
  MCQ: { label: "Multiple options", urdu: "چار ممکنہ جوابات" },
  SHORT: { label: "Short questions", urdu: "مختصر سوالات" },
  LONG: { label: "Long questions", urdu: "تفصیلی سوالات" },
};

/** Intermediate (Class 11/12) uses PTS-style labels. */
const INTERMEDIATE_FIELD_LABELS: Partial<Record<EnglishFieldFilter, string>> = {
  COMPREHENSION: "Multiple options",
  MEANING: "Tick cross synonyms",
  SYNONYM: "Tick cross synonyms",
  QA: "Short questions",
  PAIR: "Pair of words",
  DI: "Direct & Indirect",
  VERB: "Correct form of verb",
  TRANSLATE_UR: "Translate into Urdu (paragraph)",
  PUNCTUATION: "Punctuate the paragraph",
};

export function englishOptionsForCounts(
  counts: Partial<Record<EnglishFieldFilter, number>>,
  options?: {
    intermediate?: boolean;
    class9?: boolean;
    includeEmpty?: boolean;
  },
): Array<EnglishTypeOption & { count: number }> {
  const catalog = englishTypeCatalog({
    intermediate: options?.intermediate,
    class9: options?.class9,
  });
  const mapped = catalog.map((opt) => ({
    ...opt,
    label:
      options?.intermediate && INTERMEDIATE_FIELD_LABELS[opt.field]
        ? INTERMEDIATE_FIELD_LABELS[opt.field]!
        : opt.label,
    count: counts[opt.field] ?? 0,
  }));
  if (options?.includeEmpty || options?.class9) return mapped;
  return mapped.filter((opt) => opt.count > 0);
}

export function sumEnglishFieldCounts(
  topics: Array<{
    id: string;
    countsByEnglishField?: Partial<Record<EnglishFieldFilter, number>>;
  }>,
  selectedTopicIds: Set<string>,
): Partial<Record<EnglishFieldFilter, number>> {
  const out: Partial<Record<EnglishFieldFilter, number>> = {};
  for (const topic of topics) {
    if (!selectedTopicIds.has(topic.id)) continue;
    for (const [field, n] of Object.entries(topic.countsByEnglishField ?? {})) {
      const key = field as EnglishFieldFilter;
      if (key === "ALL") continue;
      out[key] = (out[key] ?? 0) + (n ?? 0);
    }
  }
  return out;
}

/** Class 9 Urdu Lazmi — labels match PTS Generate Paper type list. */
export const URDU_QUESTION_TYPE_OPTIONS: Array<{
  type: QType;
  field: EnglishFieldFilter;
  label: string;
  value: string;
}> = [
  {
    type: "MCQ",
    field: "MCQ",
    label: "Multiple Options (چارممکنہ جوابات)",
    value: "MCQ:MCQ",
  },
  {
    type: "SHORT",
    field: "QA",
    label: "Question Answers (سوالات جوابات)",
    value: "SHORT:QA",
  },
  {
    type: "SHORT",
    field: "CORRECT",
    label: "جملوں کی درستگی",
    value: "SHORT:CORRECT",
  },
  {
    type: "SHORT",
    field: "IDIOM",
    label: "جملوں کی تکمیل",
    value: "SHORT:IDIOM",
  },
  {
    type: "SHORT",
    field: "MEANING",
    label: "Pointing (اعراب لگائیں)",
    value: "SHORT:MEANING",
  },
  {
    type: "LONG",
    field: "POEM",
    label: "اشعار کی تشریح",
    value: "LONG:POEM",
  },
  {
    type: "LONG",
    field: "ESSAYS",
    label: "Essays (مضامین)",
    value: "LONG:ESSAYS",
  },
  {
    type: "LONG",
    field: "SUMMARY",
    label: "Summary (خلاصہ) Matric",
    value: "LONG:SUMMARY",
  },
  {
    type: "LONG",
    field: "TAFHEEM",
    label: "Comprehension Paragraphs (تفہیم عبارات)",
    value: "LONG:TAFHEEM",
  },
  {
    type: "LONG",
    field: "PASSAGE",
    label: "پیراگراف کی تشریح Matric",
    value: "LONG:PASSAGE",
  },
  {
    type: "LONG",
    field: "LETTER",
    label: "Letters (خطوط)",
    value: "LONG:LETTER",
  },
  {
    type: "LONG",
    field: "APPLICATION",
    label: "Applications (درخواستیں)",
    value: "LONG:APPLICATION",
  },
  {
    type: "LONG",
    field: "STORY",
    label: "Stories (کہانیاں)",
    value: "LONG:STORY",
  },
  {
    type: "LONG",
    field: "DIALOGUE",
    label: "Dialogues (مکالمے)",
    value: "LONG:DIALOGUE",
  },
  {
    type: "LONG",
    field: "CENTRAL",
    label: "Theme (مرکزی خیال)",
    value: "LONG:CENTRAL",
  },
];

export function isUrduSubjectName(name: string | null | undefined) {
  const n = (name ?? "").trim().toLowerCase();
  return /urdu|اردو|اُردو/.test(n) || /ردو/.test(name ?? "");
}

export function defaultUrduFieldForType(type: QType): EnglishFieldFilter {
  return (
    URDU_QUESTION_TYPE_OPTIONS.find((opt) => opt.type === type)?.field ?? "MCQ"
  );
}

export function urduTypeFieldSelectValue(
  type: QType,
  field: EnglishFieldFilter,
): string {
  const exact = `${type}:${field}`;
  if (URDU_QUESTION_TYPE_OPTIONS.some((opt) => opt.value === exact)) {
    return exact;
  }
  return (
    URDU_QUESTION_TYPE_OPTIONS.find((opt) => opt.type === type)?.value ??
    URDU_QUESTION_TYPE_OPTIONS[0].value
  );
}

export function parseUrduTypeField(
  value: string,
): { type: QType; field: EnglishFieldFilter } | null {
  const match = URDU_QUESTION_TYPE_OPTIONS.find((opt) => opt.value === value);
  if (match) return { type: match.type, field: match.field };
  const [type, field] = value.split(":");
  if (type !== "MCQ" && type !== "SHORT" && type !== "LONG") return null;
  if (!ENGLISH_FIELD_VALUES.includes(field as EnglishFieldFilter)) return null;
  return { type, field: field as EnglishFieldFilter };
}

export function urduOptionsForCounts(
  counts: Partial<Record<EnglishFieldFilter, number>>,
  options?: { includeEmpty?: boolean },
): Array<(typeof URDU_QUESTION_TYPE_OPTIONS)[number] & { count: number }> {
  const mapped = URDU_QUESTION_TYPE_OPTIONS.map((opt) => ({
    ...opt,
    count: counts[opt.field] ?? 0,
  }));
  if (options?.includeEmpty) return mapped;
  return mapped.filter((opt) => opt.count > 0);
}

/** Islamiyat Lazmi — labels match PTS Generate Paper type list. */
export const ISLAMIYAT_QUESTION_TYPE_OPTIONS: Array<{
  type: QType;
  field: EnglishFieldFilter;
  label: string;
  value: string;
}> = [
  {
    type: "MCQ",
    field: "MCQ",
    label: "Multiple Options (چارممکنہ جوابات)",
    value: "MCQ:MCQ",
  },
  {
    type: "SHORT",
    field: "QA",
    label: "Short Questions (مختصر سوالات)",
    value: "SHORT:QA",
  },
  {
    type: "LONG",
    field: "LONG",
    label: "Long Questions (تفصیلاً سوالات)",
    value: "LONG:LONG",
  },
  {
    type: "LONG",
    field: "HADITH",
    label: "Hadith (احادیث)",
    value: "LONG:HADITH",
  },
  {
    type: "LONG",
    field: "PERSONALITY",
    label: "Personalities",
    value: "LONG:PERSONALITY",
  },
];

export function isIslamiyatSubjectName(name: string | null | undefined) {
  const n = (name ?? "").trim().toLowerCase();
  return /islamiyat|islamic|اسلامیات/.test(n);
}

export function defaultIslamiyatFieldForType(type: QType): EnglishFieldFilter {
  return (
    ISLAMIYAT_QUESTION_TYPE_OPTIONS.find((opt) => opt.type === type)?.field ??
    "MCQ"
  );
}

export function islamiyatTypeFieldSelectValue(
  type: QType,
  field: EnglishFieldFilter,
): string {
  const exact = `${type}:${field}`;
  if (ISLAMIYAT_QUESTION_TYPE_OPTIONS.some((opt) => opt.value === exact)) {
    return exact;
  }
  return (
    ISLAMIYAT_QUESTION_TYPE_OPTIONS.find((opt) => opt.type === type)?.value ??
    ISLAMIYAT_QUESTION_TYPE_OPTIONS[0].value
  );
}

export function parseIslamiyatTypeField(
  value: string,
): { type: QType; field: EnglishFieldFilter } | null {
  const match = ISLAMIYAT_QUESTION_TYPE_OPTIONS.find((opt) => opt.value === value);
  if (match) return { type: match.type, field: match.field };
  const [type, field] = value.split(":");
  if (type !== "MCQ" && type !== "SHORT" && type !== "LONG") return null;
  if (!ENGLISH_FIELD_VALUES.includes(field as EnglishFieldFilter)) return null;
  return { type, field: field as EnglishFieldFilter };
}

export function islamiyatOptionsForCounts(
  counts: Partial<Record<EnglishFieldFilter, number>>,
  options?: { includeEmpty?: boolean },
): Array<(typeof ISLAMIYAT_QUESTION_TYPE_OPTIONS)[number] & { count: number }> {
  const mapped = ISLAMIYAT_QUESTION_TYPE_OPTIONS.map((opt) => ({
    ...opt,
    count: counts[opt.field] ?? 0,
  }));
  if (options?.includeEmpty) return mapped;
  return mapped.filter((opt) => opt.count > 0);
}

/** Class 9 Tarjuma Tul Quran — labels match PTS Generate Paper type list. */
export const TARJUMA_QUESTION_TYPE_OPTIONS: Array<{
  type: QType;
  field: EnglishFieldFilter;
  label: string;
  value: string;
}> = [
  {
    type: "MCQ",
    field: "MCQ",
    label: "Multiple Options (چارممکنہ جوابات)",
    value: "MCQ:MCQ",
  },
  {
    type: "SHORT",
    field: "QA",
    label: "Short Questions (مختصر سوالات)",
    value: "SHORT:QA",
  },
  {
    type: "LONG",
    field: "LONG",
    label: "Long Questions (تفصیلاً سوالات)",
    value: "LONG:LONG",
  },
  {
    type: "LONG",
    field: "AYAT",
    label: "Verses (آیات)",
    value: "LONG:AYAT",
  },
  {
    type: "SHORT",
    // Seed stores subType WORD; curriculum maps WORD → PAIR.
    field: "PAIR",
    label: "Word Meaning (الفاظ معنی)",
    value: "SHORT:PAIR",
  },
];

export function isTarjumaSubjectName(name: string | null | undefined) {
  const n = (name ?? "").trim().toLowerCase();
  const raw = name ?? "";
  return (
    /tarjuma|tarjama/.test(n) ||
    /ترجمہ|ترجمۃ|ترجمه/.test(raw) ||
    (/quran|قرآن|قرآن/.test(raw) && /ترجم|tarj/i.test(raw + n))
  );
}

export function defaultTarjumaFieldForType(type: QType): EnglishFieldFilter {
  return (
    TARJUMA_QUESTION_TYPE_OPTIONS.find((opt) => opt.type === type)?.field ??
    "MCQ"
  );
}

export function tarjumaTypeFieldSelectValue(
  type: QType,
  field: EnglishFieldFilter,
): string {
  const exact = `${type}:${field}`;
  if (TARJUMA_QUESTION_TYPE_OPTIONS.some((opt) => opt.value === exact)) {
    return exact;
  }
  return (
    TARJUMA_QUESTION_TYPE_OPTIONS.find((opt) => opt.type === type)?.value ??
    TARJUMA_QUESTION_TYPE_OPTIONS[0].value
  );
}

export function parseTarjumaTypeField(
  value: string,
): { type: QType; field: EnglishFieldFilter } | null {
  const match = TARJUMA_QUESTION_TYPE_OPTIONS.find((opt) => opt.value === value);
  if (match) return { type: match.type, field: match.field };
  const [type, field] = value.split(":");
  if (type !== "MCQ" && type !== "SHORT" && type !== "LONG") return null;
  if (!ENGLISH_FIELD_VALUES.includes(field as EnglishFieldFilter)) return null;
  return { type, field: field as EnglishFieldFilter };
}

export function tarjumaOptionsForCounts(
  counts: Partial<Record<EnglishFieldFilter, number>>,
  options?: { includeEmpty?: boolean },
): Array<(typeof TARJUMA_QUESTION_TYPE_OPTIONS)[number] & { count: number }> {
  const mapped = TARJUMA_QUESTION_TYPE_OPTIONS.map((opt) => ({
    ...opt,
    count: counts[opt.field] ?? 0,
  }));
  if (options?.includeEmpty) return mapped;
  return mapped.filter((opt) => opt.count > 0);
}
