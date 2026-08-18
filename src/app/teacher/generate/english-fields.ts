export type EnglishFieldFilter =
  | "ALL"
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
  | "PUNCTUATION";

export type QType = "MCQ" | "SHORT" | "LONG";

export const ENGLISH_FIELD_VALUES = [
  "ALL",
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
  "PUNCTUATION",
] as const;

/** English bank fields available when generating papers. */
export const ENGLISH_QUESTION_TYPE_OPTIONS: Array<{
  type: QType;
  field: EnglishFieldFilter;
  label: string;
  value: string;
}> = [
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

export const DEFAULT_ENGLISH_TYPE_FIELD = ENGLISH_QUESTION_TYPE_OPTIONS[0];

export function defaultEnglishFieldForType(type: QType): EnglishFieldFilter {
  return (
    ENGLISH_QUESTION_TYPE_OPTIONS.find((opt) => opt.type === type)?.field ??
    DEFAULT_ENGLISH_TYPE_FIELD.field
  );
}

export function englishTypeFieldSelectValue(
  type: QType,
  field: EnglishFieldFilter,
): string {
  const exact = `${type}:${field}`;
  if (ENGLISH_QUESTION_TYPE_OPTIONS.some((opt) => opt.value === exact)) {
    return exact;
  }
  return (
    ENGLISH_QUESTION_TYPE_OPTIONS.find((opt) => opt.type === type)?.value ??
    DEFAULT_ENGLISH_TYPE_FIELD.value
  );
}

export function parseEnglishTypeField(
  value: string,
): { type: QType; field: EnglishFieldFilter } | null {
  const match = ENGLISH_QUESTION_TYPE_OPTIONS.find((opt) => opt.value === value);
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
export function isIntermediateEnglishClass(className: string | null | undefined) {
  const n = (className ?? "").trim();
  return /\bclass\s*1[12]\b/i.test(n) || /\binter(?:mediate)?\b/i.test(n);
}

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
  options?: { intermediate?: boolean },
): Array<(typeof ENGLISH_QUESTION_TYPE_OPTIONS)[number] & { count: number }> {
  return ENGLISH_QUESTION_TYPE_OPTIONS.map((opt) => ({
    ...opt,
    label:
      options?.intermediate && INTERMEDIATE_FIELD_LABELS[opt.field]
        ? INTERMEDIATE_FIELD_LABELS[opt.field]!
        : opt.label,
    count: counts[opt.field] ?? 0,
  })).filter((opt) => opt.count > 0);
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
