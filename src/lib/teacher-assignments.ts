export type AssignmentInput = {
  classId: string;
  sectionId: string;
  subjectId: string;
};

export function teacherAssignmentScopeKey(classId: string, subjectId: string) {
  return `${classId}:${subjectId}`;
}

export type AssignmentGroupInput = {
  classIds: string[];
  sectionIds: string[];
  subjectName: string;
};

export function assignmentKey(a: AssignmentInput) {
  return `${a.classId}:${a.sectionId}:${a.subjectId}`;
}

export function parseAssignmentsJson(raw: unknown): AssignmentInput[] {
  if (typeof raw !== "string" || !raw.trim()) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("Invalid assignments payload");
  }
  if (!Array.isArray(parsed)) {
    throw new Error("Assignments must be an array");
  }

  const rows: AssignmentInput[] = [];
  for (const item of parsed) {
    if (!item || typeof item !== "object") {
      throw new Error("Invalid assignment row");
    }
    const row = item as Record<string, unknown>;
    const classId = String(row.classId ?? "").trim();
    const sectionId = String(row.sectionId ?? "").trim();
    const subjectId = String(row.subjectId ?? "").trim();
    if (!classId || !sectionId || !subjectId) {
      throw new Error("Each assignment needs class, section, and subject");
    }
    rows.push({ classId, sectionId, subjectId });
  }
  return rows;
}

export function assertNoDuplicateAssignments(rows: AssignmentInput[]) {
  const seen = new Set<string>();
  for (const row of rows) {
    const key = assignmentKey(row);
    if (seen.has(key)) {
      throw new Error("Duplicate teaching assignment: same class, section, and subject");
    }
    seen.add(key);
  }
}

function isBlankAssignmentGroup(group: AssignmentGroupInput) {
  return (
    group.classIds.filter(Boolean).length === 0 &&
    group.sectionIds.filter(Boolean).length === 0 &&
    !group.subjectName.trim()
  );
}

function isPartialAssignmentGroup(group: AssignmentGroupInput) {
  const hasClass = group.classIds.filter(Boolean).length > 0;
  const hasSection = group.sectionIds.filter(Boolean).length > 0;
  const hasSubject = Boolean(group.subjectName.trim());
  const any = hasClass || hasSection || hasSubject;
  const all = hasClass && hasSection && hasSubject;
  return any && !all;
}

/** Expand multi class/section + subject-name groups into concrete assignment rows. */
export function expandAssignmentGroups(
  groups: AssignmentGroupInput[],
  catalog: {
    sections: Array<{ id: string; classId: string }>;
    subjects: Array<{ id: string; name: string; classId: string }>;
    classes?: Array<{ id: string; name: string }>;
  },
  options?: { allowEmpty?: boolean },
): AssignmentInput[] {
  const allowEmpty = options?.allowEmpty ?? true;
  const sectionById = new Map(catalog.sections.map((s) => [s.id, s]));
  const classNameById = new Map(
    (catalog.classes ?? []).map((klass) => [klass.id, klass.name]),
  );
  const expanded: AssignmentInput[] = [];
  const activeGroups = groups.filter((group) => !isBlankAssignmentGroup(group));

  for (const group of activeGroups) {
    if (isPartialAssignmentGroup(group)) {
      throw new Error(
        "Every assignment needs a class, a subject, and at least one section.",
      );
    }

    const classIds = [...new Set(group.classIds.filter(Boolean))];
    const sectionIds = [...new Set(group.sectionIds.filter(Boolean))];
    const subjectName = group.subjectName.trim();
    const classesWithoutSection: string[] = [];

    for (const classId of classIds) {
      const subject = catalog.subjects.find(
        (s) =>
          s.classId === classId &&
          s.name.trim().toLowerCase() === subjectName.toLowerCase(),
      );
      if (!subject) {
        throw new Error(
          `"${subjectName}" is not taught in one of the selected classes. Remove that class, or pick a different subject.`,
        );
      }

      let matchedSections = 0;
      for (const sectionId of sectionIds) {
        const section = sectionById.get(sectionId);
        if (!section) {
          throw new Error(
            "One or more selected sections no longer exist. Refresh the page and try again.",
          );
        }
        if (section.classId !== classId) {
          // Section belongs to another selected class — skip for this class.
          continue;
        }
        matchedSections += 1;
        expanded.push({
          classId,
          sectionId,
          subjectId: subject.id,
        });
      }

      if (matchedSections === 0) {
        classesWithoutSection.push(classNameById.get(classId) ?? "a selected class");
      }
    }

    if (classesWithoutSection.length > 0) {
      const labels = [...new Set(classesWithoutSection)].join(", ");
      throw new Error(
        `No section selected for ${labels}. Select at least one section for every chosen class, or remove that class from this assignment.`,
      );
    }
  }

  if (expanded.length === 0) {
    if (allowEmpty && activeGroups.length === 0) {
      return [];
    }
    throw new Error(
      "No valid class and section combination was found. Pick sections that belong to the selected classes.",
    );
  }

  assertNoDuplicateAssignments(expanded);
  return expanded;
}
