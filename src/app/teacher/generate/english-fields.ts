export type EnglishFieldFilter =
  | "ALL"
  | "COMPREHENSION"
  | "SPELLING"
  | "MEANING"
  | "VERB"
  | "GRAMMAR"
  | "QA"
  | "DI"
  | "PAIR"
  | "ESSAYS"
  | "SUMMARY"
  | "TRANSLATE_UR"
  | "TRANSLATE_EN"
  | "POEM_STANZA";

export type QType = "MCQ" | "SHORT" | "LONG";

export const ENGLISH_FIELD_VALUES = [
  "ALL",
  "COMPREHENSION",
  "SPELLING",
  "MEANING",
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
    label: "Pair of Words",
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
