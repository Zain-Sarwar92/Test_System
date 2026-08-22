import type { Prisma, QuestionType } from "@/generated/prisma/client";
import type { EnglishFieldFilter, QType } from "@/app/teacher/generate/english-fields";

/** Map DB subType (+ legacy aliases) to picker field keys. */
export function subTypeToEnglishField(
  subType: string | null | undefined,
): EnglishFieldFilter | null {
  if (!subType) return null;
  const key = subType.toUpperCase();
  if (key === "WORD") return "PAIR";
  if (
    key === "MCQ" ||
    key === "COMPREHENSION" ||
    key === "SPELLING" ||
    key === "MEANING" ||
    key === "SYNONYM" ||
    key === "VERB" ||
    key === "GRAMMAR" ||
    key === "QA" ||
    key === "DI" ||
    key === "PAIR" ||
    key === "ESSAYS" ||
    key === "SUMMARY" ||
    key === "TRANSLATE_UR" ||
    key === "TRANSLATE_EN" ||
    key === "POEM_STANZA" ||
    key === "POEM" ||
    key === "PASSAGE" ||
    key === "PUNCTUATION" ||
    key === "LONG" ||
    key === "HADITH" ||
    key === "PERSONALITY" ||
    key === "AYAT" ||
    key === "CORRECT" ||
    key === "IDIOM" ||
    key === "LETTER" ||
    key === "APPLICATION" ||
    key === "STORY" ||
    key === "DIALOGUE" ||
    key === "CENTRAL" ||
    key === "TAFHEEM"
  ) {
    return key;
  }
  return null;
}

/** Infer field when subType is missing (Class 10 / legacy imports). */
export function inferEnglishFieldFromLegacy(
  type: QuestionType,
  source: string | null | undefined,
  externalKey?: string | null,
): EnglishFieldFilter | null {
  // externalKey encodes the field for Class 10 PTS data
  const keyField = externalKey?.match(/:english:([a-z_]+):/i)?.[1];
  if (keyField) {
    const mapped = subTypeToEnglishField(
      keyField.toUpperCase().replace(/-/g, "_"),
    );
    if (mapped) return mapped;
  }

  const s = (source ?? "").toLowerCase();

  // Exact source strings from Class 10 import
  if (s.includes("tick correct spelling") || s.includes("spelling")) return "SPELLING";
  if (s.includes("synonym") || s.includes("antonym") || s.includes("tick cross")) return "SYNONYM";
  if (s.includes("correct meaning") || s.includes("meaning")) return "MEANING";
  if (s.includes("form of verb") || s.includes("correct form of verb")) return "VERB";
  if (s.includes("grammar")) return "GRAMMAR";
  if (s.includes("punctuat")) return "PUNCTUATION";
  if (s.includes("pair of words")) return "PAIR";
  if (s.includes("word meaning")) return "PAIR";
  if (s.includes("summary")) return "SUMMARY";
  if (s.includes("translate into urdu")) return "TRANSLATE_UR";
  if (s.includes("translate into english")) return "TRANSLATE_EN";
  if (s.includes("poem stanza")) return "POEM_STANZA";
  if (s.includes("direct & indirect") || s.includes("past papers")) return "DI";

  // Generic fallbacks by question type
  if (type === "MCQ" && s.includes("exercise")) return "COMPREHENSION";
  if (
    type === "SHORT" &&
    (s.includes("exercise") || s.includes("additional") || s.includes("review"))
  ) {
    return "QA";
  }
  // LONG Exercise in Ch 15 = essays; elsewhere = translate (use externalKey as tiebreak)
  if (type === "LONG" && s.includes("exercise")) {
    return externalKey?.includes(":essays:") ? "ESSAYS" : "ESSAYS";
  }
  return null;
}

export function resolveEnglishField(input: {
  type: QuestionType;
  subType?: string | null;
  source?: string | null;
  externalKey?: string | null;
}): EnglishFieldFilter | null {
  return (
    subTypeToEnglishField(input.subType) ??
    inferEnglishFieldFromLegacy(input.type, input.source, input.externalKey)
  );
}

export type EnglishFieldCounts = Record<EnglishFieldFilter, number>;

export function emptyEnglishFieldCounts(): EnglishFieldCounts {
  return {
    ALL: 0,
    MCQ: 0,
    COMPREHENSION: 0,
    SPELLING: 0,
    MEANING: 0,
    SYNONYM: 0,
    VERB: 0,
    GRAMMAR: 0,
    QA: 0,
    DI: 0,
    PAIR: 0,
    ESSAYS: 0,
    SUMMARY: 0,
    TRANSLATE_UR: 0,
    TRANSLATE_EN: 0,
    POEM_STANZA: 0,
    POEM: 0,
    PASSAGE: 0,
    PUNCTUATION: 0,
    LONG: 0,
    HADITH: 0,
    PERSONALITY: 0,
    AYAT: 0,
    CORRECT: 0,
    IDIOM: 0,
    LETTER: 0,
    APPLICATION: 0,
    STORY: 0,
    DIALOGUE: 0,
    CENTRAL: 0,
    TAFHEEM: 0,
  };
}

export function englishFieldWhere(
  field: EnglishFieldFilter,
): Prisma.QuestionWhereInput {
  if (field === "ALL") return {};

  const subTypes =
    field === "PAIR" ? (["PAIR", "WORD"] as const) : ([field] as const);

  const or: Prisma.QuestionWhereInput[] = [{ subType: { in: [...subTypes] } }];

  switch (field) {
    case "COMPREHENSION":
      // Class 9: subType=COMPREHENSION / Class 10: MCQ with source "Exercise"
      or.push({ source: { contains: "Exercise" }, type: "MCQ" });
      break;
    case "SPELLING":
      // Class 9: subType=SPELLING / Class 10: "Tick correct spelling"
      or.push({ source: { contains: "spelling" } });
      break;
    case "MEANING":
      // Class 9: subType=MEANING / Class 10: "Correct meaning of underlined word"
      or.push({ source: { contains: "meaning" } });
      break;
    case "VERB":
      // Class 9: subType=VERB / Class 10: "Correct form of verb"
      or.push({ source: { contains: "form of verb" } });
      break;
    case "GRAMMAR":
      // Class 9: subType=GRAMMAR / Class 10: "Tick correct according to grammar"
      or.push({ source: { contains: "grammar" } });
      break;
    case "QA":
      or.push(
        { source: { contains: "Exercise" }, type: "SHORT" },
        { source: { contains: "Additional" }, type: "SHORT" },
        { source: { contains: "Review" }, type: "SHORT" },
      );
      break;
    case "DI":
      // Class 9: subType=DI / Class 10: "Direct & Indirect" source, also "Past Papers"
      or.push(
        { source: { contains: "Past Papers" } },
        { source: { contains: "Direct & Indirect" } },
      );
      break;
    case "PAIR":
      // Class 9: subType=WORD / Class 10: source "Pair of Words"
      or.push(
        { source: { contains: "Pair of Words" } },
        { source: { contains: "Word meaning" } },
        { externalKey: { contains: ":word:" } },
      );
      break;
    case "ESSAYS":
      // Class 10 Ch15: externalKey contains ":essays:", LONG + source "Exercise"
      or.push(
        { externalKey: { contains: ":essays:" } },
        { source: { contains: "Exercise" }, type: "LONG", externalKey: { contains: ":english:" } },
      );
      break;
    case "SUMMARY":
      or.push({ source: { contains: "Summary" } });
      break;
    case "TRANSLATE_UR":
      or.push({ source: { contains: "Translate into Urdu" } });
      break;
    case "TRANSLATE_EN":
      or.push({ source: { contains: "Translate into English" } });
      break;
    case "POEM_STANZA":
      or.push({ source: { contains: "Poem Stanzas" } });
      break;
    case "SYNONYM":
      or.push(
        { source: { contains: "synonym", mode: "insensitive" } },
        { source: { contains: "antonym", mode: "insensitive" } },
        { source: { contains: "tick cross", mode: "insensitive" } },
      );
      break;
    case "PUNCTUATION":
      or.push({ source: { contains: "punctuat", mode: "insensitive" } });
      break;
    default:
      break;
  }

  return { OR: or };
}

export function englishFieldMatchesType(
  field: EnglishFieldFilter,
  type: QType,
): boolean {
  if (field === "ALL") return true;
  const mcq: EnglishFieldFilter[] = [
    "MCQ",
    "COMPREHENSION",
    "SPELLING",
    "MEANING",
    "SYNONYM",
    "VERB",
    "GRAMMAR",
  ];
  const short: EnglishFieldFilter[] = [
    "QA",
    "DI",
    "PAIR",
    "CORRECT",
    "IDIOM",
  ];
  const long: EnglishFieldFilter[] = [
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
    "LETTER",
    "APPLICATION",
    "STORY",
    "DIALOGUE",
    "CENTRAL",
    "TAFHEEM",
  ];
  if (type === "MCQ") return mcq.includes(field);
  if (type === "SHORT") {
    // Urdu uses MEANING as short word-meaning; English uses MEANING as MCQ.
    if (field === "MEANING") return true;
    return short.includes(field);
  }
  return long.includes(field);
}
