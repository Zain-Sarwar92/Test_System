export type TeacherLevel = "PRIMARY" | "MATRIC" | "INTERMEDIATE";

export const TEACHER_LEVELS: {
  value: TeacherLevel;
  label: string;
  description: string;
}[] = [
  {
    value: "PRIMARY",
    label: "Primary",
    description: "Nursery, Prep & Class 1–8",
  },
  {
    value: "MATRIC",
    label: "Matric",
    description: "Class 9–10",
  },
  {
    value: "INTERMEDIATE",
    label: "Intermediate",
    description: "Class 11–12",
  },
];

export function teacherLevelLabel(level: TeacherLevel | null | undefined) {
  if (!level) return null;
  return TEACHER_LEVELS.find((item) => item.value === level)?.label ?? level;
}

/** Extract a grade number from common class name formats. */
export function extractClassNumber(className: string): number | null {
  const name = className.trim().toLowerCase();

  const classMatch = name.match(/\b(?:class|grade|std|standard)\s*[- ]?\s*(\d{1,2})\b/);
  if (classMatch) return Number(classMatch[1]);

  const ordinalMatch = name.match(/\b(\d{1,2})(st|nd|rd|th)\b/);
  if (ordinalMatch) return Number(ordinalMatch[1]);

  const bareMatch = name.match(/^(\d{1,2})$/);
  if (bareMatch) return Number(bareMatch[1]);

  return null;
}

export function resolveTeacherLevelForClass(
  className: string,
): TeacherLevel | null {
  const name = className.trim().toLowerCase();

  if (
    /\b(nursery|prep|playgroup|kg|k\.g|kindergarten|montessori|ece)\b/.test(
      name,
    )
  ) {
    return "PRIMARY";
  }

  if (/\b(matric|matriculation|ssc)\b/.test(name)) return "MATRIC";
  if (/\b(intermediate|f\.?\s?a\.?|f\.?\s?sc\.?|ics|hssc)\b/.test(name)) {
    return "INTERMEDIATE";
  }

  const num = extractClassNumber(name);
  if (num === null) return null;
  if (num >= 1 && num <= 8) return "PRIMARY";
  if (num === 9 || num === 10) return "MATRIC";
  if (num === 11 || num === 12) return "INTERMEDIATE";
  return null;
}

export function classMatchesTeacherLevel(
  className: string,
  level: TeacherLevel,
) {
  return resolveTeacherLevelForClass(className) === level;
}
