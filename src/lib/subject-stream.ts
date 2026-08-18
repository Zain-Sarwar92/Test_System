export type StudentStream = "SCIENCE" | "ARTS";
export type SubjectTrack = "COMMON" | "SCIENCE" | "ARTS";

export const SCIENCE_ELECTIVE_GROUP = "SCIENCE_ELECTIVE";
export const ARTS_ELECTIVE_GROUP = "ARTS_ELECTIVE";

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

export function shortElectiveLabel(name: string) {
  const n = name.toLowerCase();
  if (n.includes("biology")) return "Bio";
  if (n.includes("computer")) return "Comp";
  return name.slice(0, 8);
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
