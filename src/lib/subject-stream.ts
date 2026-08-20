export type StudentStream = "SCIENCE" | "ARTS";
export type SubjectTrack = "COMMON" | "SCIENCE" | "ARTS";
export type StudyGroup = "PRE_MEDICAL" | "PRE_ENGINEERING" | "ICS" | "ARTS";

export const SCIENCE_ELECTIVE_GROUP = "SCIENCE_ELECTIVE";
export const ARTS_ELECTIVE_GROUP = "ARTS_ELECTIVE";

export const STUDY_GROUP_OPTIONS: Array<{ value: StudyGroup; label: string }> = [
  { value: "PRE_MEDICAL", label: "Pre-medical" },
  { value: "PRE_ENGINEERING", label: "Pre-engineering" },
  { value: "ICS", label: "ICS" },
  { value: "ARTS", label: "Arts" },
];

export function isHigherSecondaryClass(className: string) {
  const n = className.trim().toLowerCase().replace(/\s+/g, " ");
  return /\b(11th|12th|11|12|xi|xii|hssc|intermediate|1st year|2nd year|first year|second year)\b/.test(
    n,
  );
}

export function streamFromStudyGroup(group: StudyGroup): StudentStream {
  return group === "ARTS" ? "ARTS" : "SCIENCE";
}

export type SubjectMeta = {
  id: string;
  name: string;
  track: SubjectTrack;
  electiveGroup: string | null;
  totalMarks?: number;
};

function normalizeSubjectName(name: string) {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

/** Infer track/group from subject name when DB tags are missing/COMMON. */
export function inferSubjectMeta(name: string): {
  track: SubjectTrack;
  electiveGroup: string | null;
} {
  const n = normalizeSubjectName(name);

  // Science electives
  if (
    n.includes("biology") ||
    n.includes("computer") ||
    n.includes("کمپیوٹر") ||
    n.includes("حیاتیات")
  ) {
    return { track: "SCIENCE", electiveGroup: SCIENCE_ELECTIVE_GROUP };
  }

  // Science compulsory
  if (
    n.includes("physics") ||
    n.includes("chemistry") ||
    n.includes("طبیعیات") ||
    n.includes("کیمیا")
  ) {
    return { track: "SCIENCE", electiveGroup: null };
  }

  // Arts compulsory
  if (n.includes("general science") || n.includes("جنرل سائنس")) {
    return { track: "ARTS", electiveGroup: null };
  }

  // Arts electives (English + Urdu common names in this bank)
  if (
    n.includes("education") ||
    n.includes("civics") ||
    n.includes("geography") ||
    n.includes("history") ||
    n.includes("economics") ||
    n.includes("home economics") ||
    n.includes("physical education") ||
    n.includes("punjabi") ||
    n.includes("poultry") ||
    n.includes("food") ||
    n.includes("nutrition") ||
    n.includes("ایجوکیشن") ||
    n.includes("سوکس") ||
    n.includes("معاشیات") ||
    n.includes("ہوم اکنامکس") ||
    n.includes("غذا") ||
    n.includes("فزیکل") ||
    n.includes("پنجابی") ||
    n.includes("مرغبانی") ||
    n.includes("اسلامیات اختیاری") ||
    n.includes("جنرل ریاضی")
  ) {
    return { track: "ARTS", electiveGroup: ARTS_ELECTIVE_GROUP };
  }

  // Common compulsory (English, Urdu, Islamiyat Lazmi, Ethics, Tarjuma, Math, Pak Studies…)
  return { track: "COMMON", electiveGroup: null };
}

export function resolveSubjectMeta(subject: {
  id: string;
  name: string;
  track?: SubjectTrack | null;
  electiveGroup?: string | null;
  totalMarks?: number;
}): SubjectMeta {
  const inferred = inferSubjectMeta(subject.name);
  const hasDbTrack = Boolean(subject.track && subject.track !== "COMMON");
  const hasDbElective = Boolean(subject.electiveGroup?.trim());

  // Prefer explicit DB tags; fall back to name inference for COMMON/empty rows.
  const electiveGroup = hasDbElective
    ? subject.electiveGroup!.trim()
    : inferred.electiveGroup;

  let track: SubjectTrack;
  if (electiveGroup === SCIENCE_ELECTIVE_GROUP) track = "SCIENCE";
  else if (electiveGroup === ARTS_ELECTIVE_GROUP) track = "ARTS";
  else if (hasDbTrack) track = subject.track as SubjectTrack;
  else track = inferred.track;

  return {
    id: subject.id,
    name: subject.name,
    track,
    electiveGroup,
    totalMarks: subject.totalMarks,
  };
}

export function chosenElectiveIds(student: {
  electiveSubjectId?: string | null;
  electiveChoiceIds?: string[] | null;
}) {
  const ids = new Set<string>();
  if (student.electiveSubjectId) ids.add(student.electiveSubjectId);
  for (const id of student.electiveChoiceIds ?? []) {
    if (id) ids.add(id);
  }
  return [...ids];
}

/** Attach electiveChoiceIds from Prisma `electiveChoices` relation (plus legacy electiveSubjectId). */
export function withChosenElectives<
  T extends {
    electiveSubjectId?: string | null;
    electiveChoices?: Array<{ subjectId: string }>;
  },
>(student: T) {
  return {
    ...student,
    electiveChoiceIds: [
      ...new Set([
        ...(student.electiveChoices?.map((row) => row.subjectId) ?? []),
        ...(student.electiveSubjectId ? [student.electiveSubjectId] : []),
      ]),
    ],
  };
}

export function isStudentEnrolledInSubject(
  student: {
    stream: StudentStream;
    electiveSubjectId?: string | null;
    electiveChoiceIds?: string[] | null;
  },
  subject: SubjectMeta,
) {
  if (subject.electiveGroup) {
    return chosenElectiveIds(student).includes(subject.id);
  }
  if (subject.track === "COMMON") return true;
  return subject.track === student.stream;
}

export function electiveOptionsForClass(
  subjects: Array<{
    id: string;
    name: string;
    track?: SubjectTrack | null;
    electiveGroup?: string | null;
  }>,
  stream?: StudentStream,
) {
  return subjects
    .map(resolveSubjectMeta)
    .filter((subject) => {
      if (stream === "ARTS") return subject.electiveGroup === ARTS_ELECTIVE_GROUP;
      if (stream === "SCIENCE") {
        return subject.electiveGroup === SCIENCE_ELECTIVE_GROUP;
      }
      return (
        subject.electiveGroup === SCIENCE_ELECTIVE_GROUP ||
        subject.electiveGroup === ARTS_ELECTIVE_GROUP
      );
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** Compact subject headers for gazettes / tight tables. */
export function shortSubjectLabel(name: string) {
  const n = name.toLowerCase().trim();

  if (n.includes("biology") || n.includes("حیاتیات")) return "Bio";
  if (n.includes("computer") || n.includes("کمپیوٹر")) return "Comp";
  if (n.includes("mathematics") || n.includes("ریاضی") || n === "maths" || n === "math") {
    return "Math";
  }
  if (n.includes("physics") || n.includes("فزکس") || n.includes("طبیعیات")) return "Phy";
  if (n.includes("chemistry") || n.includes("کیمیا")) return "Chem";
  if (n.includes("english") || n.includes("انگریزی")) return "Eng";
  if (n.includes("pakistan studies") || n.includes("پاکستان اسٹڈیز") || n.includes("pak study")) {
    return "Pak St";
  }
  if (n.includes("general science") || n.includes("جنرل سائنس")) return "G.Sci";
  if (n.includes("اُردو") || n.includes("اردو") || n.includes("urdu")) return "Urdu";
  if (
    n.includes("اسلامیات اختیاری") ||
    (n.includes("islamiyat") && (n.includes("ikhtiyari") || n.includes("optional")))
  ) {
    return "اسلامیات";
  }
  if (n.includes("اسلامیات") || n.includes("islamiyat") || n.includes("islamic")) {
    return "Isl";
  }
  if (n.includes("ترجمۃ") || n.includes("ترجمه") || n.includes("tarjuma") || n.includes("quran")) {
    return "Tarjuma";
  }
  if (n.includes("اخلاقیات") || n.includes("ethics") || n.includes("akhlaq")) return "Ethics";
  if (n.includes("education") || n.includes("ایجوکیشن")) return "Edu";
  if (n.includes("civics") || n.includes("سوکس")) return "Civ";
  if (n.includes("economics") || n.includes("معاشیات")) return "Eco";
  if (n.includes("punjabi") || n.includes("پنجابی")) return "Pun";
  if (n.includes("home economics") || n.includes("ہوم اکنامکس")) return "H.Eco";
  if (n.includes("physical education") || n.includes("فزیکل")) return "PE";
  if (n.includes("food") || n.includes("غذا")) return "Food";
  if (n.includes("مرغبانی") || n.includes("poultry")) return "Poultry";

  return name.length > 10 ? name.slice(0, 10) : name;
}

export function shortElectiveLabel(name: string) {
  return shortSubjectLabel(name);
}

/** Explicit DB tags for Punjab Class 9/10 default buckets. */
export function classifySubjectForBucket(name: string): {
  track: SubjectTrack;
  electiveGroup: string | null;
} {
  const n = normalizeSubjectName(name);

  if (
    n === "biology" ||
    n === "computer" ||
    n.includes("biology") ||
    (n.includes("computer") && !n.includes("science"))
  ) {
    return { track: "SCIENCE", electiveGroup: SCIENCE_ELECTIVE_GROUP };
  }

  if (n.includes("physics") || n.includes("chemistry")) {
    return { track: "SCIENCE", electiveGroup: null };
  }

  if (n.includes("general science")) {
    return { track: "ARTS", electiveGroup: null };
  }

  if (
    n.includes("ایجوکیشن") ||
    n.includes("سوکس") ||
    n.includes("معاشیات") ||
    n.includes("ہوم اکنامکس") ||
    n.includes("غذا") ||
    n.includes("فزیکل") ||
    n.includes("پنجابی") ||
    n.includes("مرغبانی") ||
    n.includes("اسلامیات اختیاری") ||
    n.includes("جنرل ریاضی") ||
    n.includes("education") ||
    n.includes("civics") ||
    n.includes("economics") ||
    n.includes("home economics") ||
    n.includes("physical education") ||
    n.includes("punjabi") ||
    n.includes("poultry")
  ) {
    return { track: "ARTS", electiveGroup: ARTS_ELECTIVE_GROUP };
  }

  // Common: English, Urdu, Islamiyat Lazmi, Ethics, Tarjuma, Math, Pak Studies…
  return { track: "COMMON", electiveGroup: null };
}
