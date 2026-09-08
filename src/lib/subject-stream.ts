export type StudentStream = "SCIENCE" | "ARTS";
export type SubjectTrack = "COMMON" | "SCIENCE" | "ARTS";
/** Intermediate (11–12) groups. */
export type IntermediateStudyGroup =
  | "PRE_MEDICAL"
  | "PRE_ENGINEERING"
  | "ICS"
  | "ARTS";
/** Matric (9–10) groups — replaces Science/Arts + separate elective. */
export type MatricStudyGroup = "BIOLOGY" | "COMPUTER" | "ARTS";
export type StudyGroup = IntermediateStudyGroup | MatricStudyGroup;

export const SCIENCE_ELECTIVE_GROUP = "SCIENCE_ELECTIVE";
export const ARTS_ELECTIVE_GROUP = "ARTS_ELECTIVE";

export const STUDY_GROUP_OPTIONS: Array<{
  value: IntermediateStudyGroup;
  label: string;
}> = [
  { value: "PRE_MEDICAL", label: "Pre-medical" },
  { value: "PRE_ENGINEERING", label: "Pre-engineering" },
  { value: "ICS", label: "ICS" },
  { value: "ARTS", label: "Arts" },
];

export const MATRIC_GROUP_OPTIONS: Array<{
  value: MatricStudyGroup;
  label: string;
}> = [
  { value: "BIOLOGY", label: "Biology" },
  { value: "COMPUTER", label: "Computer" },
  { value: "ARTS", label: "Arts" },
];

/** Short label for gazette / lists (Bio, Comp, Pre-Med, …). */
export function formatStudyGroupShort(studyGroup?: string | null) {
  switch (studyGroup) {
    case "BIOLOGY":
      return "Bio";
    case "COMPUTER":
      return "Comp";
    case "PRE_MEDICAL":
      return "Pre-Med";
    case "PRE_ENGINEERING":
      return "Pre-Eng";
    case "ICS":
      return "ICS";
    case "ARTS":
      return "Arts";
    default:
      return studyGroup?.trim() || "—";
  }
}

/** Full label for student roster / filters. */
export function formatStudyGroupLabel(studyGroup?: string | null) {
  switch (studyGroup) {
    case "BIOLOGY":
      return "Biology";
    case "COMPUTER":
      return "Computer";
    case "PRE_MEDICAL":
      return "Pre-medical";
    case "PRE_ENGINEERING":
      return "Pre-engineering";
    case "ICS":
      return "ICS";
    case "ARTS":
      return "Arts";
    case "SCIENCE":
      return "Science";
    default:
      return studyGroup?.trim() || "—";
  }
}

/** Filter chips / dropdown options for a class roster. */
export function groupFilterOptionsForClass(className: string): Array<{
  value: string;
  label: string;
}> {
  if (isHigherSecondaryClass(className)) return STUDY_GROUP_OPTIONS;
  if (isMatricSecondaryClass(className)) return MATRIC_GROUP_OPTIONS;
  return [
    { value: "SCIENCE", label: "Science" },
    { value: "ARTS", label: "Arts" },
  ];
}

/** True when `value` is a stored studyGroup (not bare SCIENCE stream). */
export function isStoredStudyGroup(value: string): value is StudyGroup {
  return (
    isMatricStudyGroup(value) ||
    value === "PRE_MEDICAL" ||
    value === "PRE_ENGINEERING" ||
    value === "ICS"
  );
}

/**
 * Display group for a student: prefer studyGroup, else stream.
 */
export function studentGroupDisplay(input: {
  studyGroup?: string | null;
  stream?: string | null;
}) {
  if (input.studyGroup?.trim()) {
    return formatStudyGroupLabel(input.studyGroup);
  }
  if (input.stream === "SCIENCE" || input.stream === "ARTS") {
    return formatStudyGroupLabel(input.stream);
  }
  return "—";
}

export function isHigherSecondaryClass(className: string) {
  const n = className.trim().toLowerCase().replace(/\s+/g, " ");
  return /\b(11th|12th|11|12|xi|xii|hssc|intermediate|1st year|2nd year|first year|second year)\b/.test(
    n,
  );
}

/** Class 9–10 (Matric). */
export function isMatricSecondaryClass(className: string) {
  if (isHigherSecondaryClass(className)) return false;
  const n = className.trim().toLowerCase().replace(/\s+/g, " ");
  return (
    /\b(9th|10th)\b/.test(n) ||
    /\bclass\s*9\b/.test(n) ||
    /\bclass\s*10\b/.test(n) ||
    n === "9" ||
    n === "10" ||
    n === "ix" ||
    n === "x"
  );
}

export function isMatricStudyGroup(value: string): value is MatricStudyGroup {
  return value === "BIOLOGY" || value === "COMPUTER" || value === "ARTS";
}

export function streamFromStudyGroup(group: StudyGroup): StudentStream {
  return group === "ARTS" ? "ARTS" : "SCIENCE";
}

/** Resolve Biology/Computer subject id for a matric group. */
export function scienceElectiveIdForMatricGroup(
  subjects: SubjectMeta[],
  group: Exclude<MatricStudyGroup, "ARTS">,
): string | null {
  const scienceElectives = subjects.filter(
    (subject) => subject.electiveGroup === SCIENCE_ELECTIVE_GROUP,
  );
  const needle = group === "BIOLOGY" ? "biology" : "computer";
  const urduNeedle = group === "BIOLOGY" ? "حیاتیات" : "کمپیوٹر";
  const match = scienceElectives.find((subject) => {
    const n = subject.name.trim().toLowerCase();
    return n.includes(needle) || subject.name.includes(urduNeedle);
  });
  return match?.id ?? null;
}

/**
 * Intermediate groups: Pre-medical → Biology, ICS → Computer,
 * Pre-engineering / Arts → no science elective row.
 */
export function electiveIdsForIntermediateGroup(
  subjects: SubjectMeta[],
  group: IntermediateStudyGroup,
): string[] {
  if (group === "PRE_MEDICAL") {
    const id = scienceElectiveIdForMatricGroup(subjects, "BIOLOGY");
    return id ? [id] : [];
  }
  if (group === "ICS") {
    const id = scienceElectiveIdForMatricGroup(subjects, "COMPUTER");
    return id ? [id] : [];
  }
  return [];
}

export function isIntermediateStudyGroup(
  value: string,
): value is IntermediateStudyGroup {
  return (
    value === "PRE_MEDICAL" ||
    value === "PRE_ENGINEERING" ||
    value === "ICS" ||
    value === "ARTS"
  );
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

  // Arts electives (English + Urdu — Matric & Intermediate)
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
    n.includes("sociology") ||
    n.includes("psychology") ||
    n.includes("persian") ||
    n.includes("library") ||
    n.includes("philosophy") ||
    n.includes("commercial geography") ||
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
    n.includes("سوشیالوجی") ||
    n.includes("نفسیات") ||
    n.includes("فارسی") ||
    n.includes("لائبریری") ||
    n.includes("تاریخ") ||
    n.includes("جغرافیہ") ||
    n.includes("حدیق") ||
    n.includes("حَدِیق") ||
    n.includes("ادب")
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
  let electiveGroup = hasDbElective
    ? subject.electiveGroup!.trim()
    : inferred.electiveGroup;

  // Physics / Chemistry are always compulsory Science — never Bio/Computer electives.
  // (Some Intermediate seed rows wrongly tagged Chemistry as SCIENCE_ELECTIVE.)
  if (
    inferred.track === "SCIENCE" &&
    inferred.electiveGroup === null &&
    electiveGroup === SCIENCE_ELECTIVE_GROUP
  ) {
    electiveGroup = null;
  }

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

/** Infer matric group from stored studyGroup or legacy elective choice. */
export function inferMatricGroup(input: {
  studyGroup?: string | null;
  stream: StudentStream;
  electiveSubjectId?: string | null;
  electiveChoiceIds?: string[] | null;
  subjects: Array<{ id: string; name: string; electiveGroup?: string | null }>;
}): MatricStudyGroup | "" {
  if (input.studyGroup === "BIOLOGY" || input.studyGroup === "COMPUTER") {
    return input.studyGroup;
  }
  if (input.studyGroup === "ARTS" || input.stream === "ARTS") {
    return "ARTS";
  }
  const ids = chosenElectiveIds(input);
  for (const id of ids) {
    const subject = input.subjects.find((row) => row.id === id);
    if (!subject) continue;
    const n = subject.name.trim().toLowerCase();
    if (n.includes("biology") || subject.name.includes("حیاتیات")) return "BIOLOGY";
    if (n.includes("computer") || subject.name.includes("کمپیوٹر")) return "COMPUTER";
  }
  return "";
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
    studyGroup?: string | null;
    electiveSubjectId?: string | null;
    electiveChoiceIds?: string[] | null;
  },
  subject: SubjectMeta,
) {
  // Electives (Bio / Computer / Arts options): only if explicitly chosen.
  if (subject.electiveGroup) {
    return chosenElectiveIds(student).includes(subject.id);
  }

  if (subject.track === "COMMON") {
    // Intermediate Pre-medical does not take Mathematics.
    if (
      student.studyGroup === "PRE_MEDICAL" &&
      isMathematicsSubjectName(subject.name)
    ) {
      return false;
    }
    return true;
  }

  if (subject.track !== student.stream) return false;

  // Intermediate Science groups take different compulsory Science subjects.
  const group = student.studyGroup;
  if (group === "PRE_MEDICAL" || group === "PRE_ENGINEERING" || group === "ICS") {
    return isIntermediateGroupTakingScienceSubject(group, subject.name);
  }

  return true;
}

function isMathematicsSubjectName(name: string) {
  const n = normalizeSubjectName(name);
  if (n.includes("business")) return false;
  if (n.includes("general") || n.includes("جنرل")) return false;
  return (
    n.includes("mathematics") ||
    n.includes("ریاضی") ||
    n === "maths" ||
    n === "math"
  );
}

function isPhysicsSubjectName(name: string) {
  const n = normalizeSubjectName(name);
  return n.includes("physics") || n.includes("طبیعیات") || n.includes("فزکس");
}

function isChemistrySubjectName(name: string) {
  const n = normalizeSubjectName(name);
  return n.includes("chemistry") || n.includes("کیمیا");
}

/**
 * Punjab Intermediate Science groups:
 * - Pre-medical: Physics + Chemistry (+ Biology elective)
 * - Pre-engineering: Physics + Chemistry + Mathematics
 * - ICS: Physics + Mathematics (+ Computer elective) — no Chemistry
 */
function isIntermediateGroupTakingScienceSubject(
  group: "PRE_MEDICAL" | "PRE_ENGINEERING" | "ICS",
  subjectName: string,
) {
  if (isChemistrySubjectName(subjectName)) {
    return group === "PRE_MEDICAL" || group === "PRE_ENGINEERING";
  }
  if (isPhysicsSubjectName(subjectName)) {
    return true;
  }
  if (isMathematicsSubjectName(subjectName)) {
    return group === "PRE_ENGINEERING" || group === "ICS";
  }
  // Other SCIENCE-track subjects: allow for all science groups.
  return true;
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

/** Arts-track / Arts-elective subjects — hidden from default Science result sheets. */
export function isArtsCurriculumSubject(subject: {
  id?: string;
  name: string;
  track?: SubjectTrack | null;
  electiveGroup?: string | null;
}) {
  const meta = resolveSubjectMeta(subject);
  return meta.track === "ARTS" || meta.electiveGroup === ARTS_ELECTIVE_GROUP;
}

/**
 * Default subjects auto-added on a new result:
 * Science (+ science electives) and true compulsory commons only.
 * Arts / optional Intermediate electives stay off until Add subject.
 */
export function isDefaultResultSubject(subject: {
  id?: string;
  name: string;
  track?: SubjectTrack | null;
  electiveGroup?: string | null;
}) {
  if (isArtsCurriculumSubject(subject)) return false;
  const meta = resolveSubjectMeta(subject);
  if (meta.track === "SCIENCE" || meta.electiveGroup === SCIENCE_ELECTIVE_GROUP) {
    return true;
  }
  return isCompulsoryCommonSubjectName(subject.name);
}

export function isEthicsSubjectName(name: string) {
  const n = normalizeSubjectName(name);
  return (
    n.includes("ethics") ||
    n.includes("akhlaq") ||
    name.includes("اخلاقیات")
  );
}

export function isScienceCurriculumSubject(subject: {
  name: string;
  track?: SubjectTrack | null;
  electiveGroup?: string | null;
}) {
  const meta = resolveSubjectMeta(subject);
  return (
    meta.track === "SCIENCE" || meta.electiveGroup === SCIENCE_ELECTIVE_GROUP
  );
}

/** Which result sheet defaults to use for a section roster. */
export type ResultSheetStream = "SCIENCE" | "ARTS";

export function inferResultSheetStream(
  students: Array<{ stream?: string | null; studyGroup?: string | null }>,
): ResultSheetStream {
  if (students.length === 0) return "SCIENCE";
  const arts = students.filter(
    (student) =>
      student.stream === "ARTS" || student.studyGroup === "ARTS",
  ).length;
  return arts * 2 >= students.length ? "ARTS" : "SCIENCE";
}

/**
 * Defaults for a section result sheet.
 * - SCIENCE: commons + science (+ Bio/Computer electives)
 * - ARTS: commons + Arts-track subjects + electives chosen by roster students
 * Ethics never auto-included (Islamiyat alternative).
 */
export function isDefaultResultSubjectForStream(
  subject: {
    id?: string;
    name: string;
    track?: SubjectTrack | null;
    electiveGroup?: string | null;
  },
  sheetStream: ResultSheetStream,
  chosenElectiveIds: Iterable<string> = [],
) {
  if (isEthicsSubjectName(subject.name)) return false;

  if (sheetStream === "SCIENCE") {
    return isDefaultResultSubject(subject);
  }

  const electiveSet =
    chosenElectiveIds instanceof Set
      ? chosenElectiveIds
      : new Set(chosenElectiveIds);

  if (isScienceCurriculumSubject(subject)) return false;

  if (isCompulsoryCommonSubjectName(subject.name)) return true;

  const meta = resolveSubjectMeta(subject);
  if (meta.track === "ARTS" && !meta.electiveGroup) return true;
  if (subject.id && electiveSet.has(subject.id)) return true;

  return false;
}

function isCompulsoryCommonSubjectName(name: string) {
  const n = normalizeSubjectName(name);
  if (n.includes("business")) return false;
  if (n.includes("accounting") || n.includes("banking") || n.includes("commerce")) {
    return false;
  }
  if (n.includes("statistics") && !n.includes("pakistan")) return false;

  if (n.includes("english") || n.includes("انگریزی")) return true;
  if (
    (n.includes("urdu") || n.includes("اردو") || n.includes("اُردو")) &&
    !n.includes("optional") &&
    !n.includes("اختیاری")
  ) {
    return true;
  }
  if (
    (n.includes("islamiyat") || n.includes("اسلامیات") || n.includes("islamic")) &&
    !n.includes("optional") &&
    !n.includes("اختیاری") &&
    !n.includes("ikhtiyari")
  ) {
    return true;
  }
  // Ethics / اخلاقیات is an *alternative* to Islamiyat (typically non-Muslims).
  // Do not auto-include it on Science (Bio/Computer) or default result sheets.
  // Org admins can still add it manually when needed.
  if (
    n.includes("tarjuma") ||
    n.includes("ترجمۃ") ||
    n.includes("ترجمه") ||
    n.includes("quran")
  ) {
    return true;
  }
  if (
    n.includes("pakistan studies") ||
    n.includes("pak studies") ||
    n.includes("پاکستان اسٹڈیز") ||
    n.includes("pak study")
  ) {
    return true;
  }
  if (
    (n.includes("mathematics") || n.includes("ریاضی") || n === "maths" || n === "math") &&
    !n.includes("general") &&
    !n.includes("جنرل") &&
    !n.includes("business")
  ) {
    return true;
  }
  return false;
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
