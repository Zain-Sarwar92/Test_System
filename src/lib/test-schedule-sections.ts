/** "Class 9" → "9", "Class 10" → "10" */
export function shortClassLabel(className: string) {
  const match = className.trim().match(/(\d+[A-Za-z]*)\s*$/);
  return match?.[1] ?? className.trim();
}

/** Split values like "Blue, A" / "Blue and A" / "Red + A" into atomic section names. */
export function atomicSectionNames(raw: string | null | undefined): string[] {
  if (!raw?.trim()) return ["General"];
  return [
    ...new Set(
      raw
        .split(/[,/|+&]+|\band\b/i)
        .map((part) => part.replace(/\./g, " ").trim())
        .map((part) => part.replace(/\s+/g, " ").trim())
        .filter(Boolean),
    ),
  ];
}

export function sortSectionNames(a: string, b: string) {
  if (a === "General") return 1;
  if (b === "General") return -1;
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
}

export function collectClassSections(
  items: Array<{
    className: string;
    sectionNames: Array<string | null | undefined>;
  }>,
) {
  const classSections = new Map<string, Set<string>>();
  for (const item of items) {
    const sections = classSections.get(item.className) ?? new Set<string>();
    if (item.sectionNames.length === 0) {
      sections.add("General");
    } else {
      for (const raw of item.sectionNames) {
        for (const section of atomicSectionNames(raw)) {
          sections.add(section);
        }
      }
    }
    classSections.set(item.className, sections);
  }
  return classSections;
}

export function assignmentMatchesSection(
  assignmentSectionName: string | null | undefined,
  columnSectionName: string,
) {
  return atomicSectionNames(assignmentSectionName).some(
    (section) => section.toLowerCase() === columnSectionName.toLowerCase(),
  );
}
