export type AssignmentInput = {
  classId: string;
  sectionId: string;
  subjectId: string;
};

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

/** Expand multi class/section + subject-name groups into concrete assignment rows. */
export function expandAssignmentGroups(
  groups: AssignmentGroupInput[],
  catalog: {
    sections: Array<{ id: string; classId: string }>;
    subjects: Array<{ id: string; name: string; classId: string }>;
  },
): AssignmentInput[] {
  const sectionById = new Map(catalog.sections.map((s) => [s.id, s]));
  const expanded: AssignmentInput[] = [];

  for (const group of groups) {
    const classIds = [...new Set(group.classIds.filter(Boolean))];
    const sectionIds = [...new Set(group.sectionIds.filter(Boolean))];
    const subjectName = group.subjectName.trim();
    if (classIds.length === 0 || sectionIds.length === 0 || !subjectName) {
      throw new Error("Each assignment needs class(es), section(s), and a subject");
    }

    for (const classId of classIds) {
      const subject = catalog.subjects.find(
        (s) =>
          s.classId === classId &&
          s.name.trim().toLowerCase() === subjectName.toLowerCase(),
      );
      if (!subject) {
        throw new Error(`Subject "${subjectName}" was not found for one of the selected classes`);
      }

      for (const sectionId of sectionIds) {
        const section = sectionById.get(sectionId);
        if (!section) {
          throw new Error("One or more selected sections were not found");
        }
        if (section.classId !== classId) {
          // Section belongs to another selected class — skip for this class.
          continue;
        }
        expanded.push({
          classId,
          sectionId,
          subjectId: subject.id,
        });
      }
    }
  }

  if (expanded.length === 0) {
    throw new Error(
      "No valid class + section combinations. Pick sections that belong to the selected classes.",
    );
  }

  assertNoDuplicateAssignments(expanded);
  return expanded;
}
