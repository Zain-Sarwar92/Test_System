import {
  SCIENCE_ELECTIVE_GROUP,
  chosenElectiveIds,
  isStudentEnrolledInSubject,
  resolveSubjectMeta,
  shortElectiveLabel,
  type StudentStream,
  type SubjectMeta,
  type SubjectTrack,
} from "@/lib/subject-stream";

export function academicSession(date = new Date()) {
  const year = date.getFullYear();
  const start = date.getMonth() >= 3 ? year : year - 1;
  return `${start}-${String(start + 1).slice(-2)}`;
}

export function sortByRoll(a: string, b: string) {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
}

export function gradeFromPercent(percent: number | null) {
  if (percent == null) return "—";
  if (percent >= 80) return "A+";
  if (percent >= 70) return "A";
  if (percent >= 60) return "B";
  if (percent >= 50) return "C";
  if (percent >= 40) return "D";
  return "F";
}

export function percentOf(obtained: number, total: number) {
  if (total <= 0) return null;
  return Math.round((obtained / total) * 1000) / 10;
}

export type CompiledSubjectCell = {
  id: string;
  name: string;
  totalMarks: number;
  obtained: number | null;
  isAbsent: boolean;
  entered: boolean;
  applicable: boolean;
  display: string;
};

export type CompiledStudent = {
  id: string;
  rollNumber: string;
  name: string;
  fatherName: string;
  stream: StudentStream;
  electiveSubjectId: string | null;
  electiveChoiceIds: string[];
  cells: CompiledSubjectCell[];
  obtainedTotal: number;
  maxTotal: number;
  percent: number | null;
  grade: string;
  passed: boolean;
  complete: boolean;
  position: number | null;
};

export type GazetteColumn =
  | {
      kind: "subject";
      key: string;
      label: string;
      subjectId: string;
      totalMarks: number;
    }
  | {
      kind: "elective";
      key: string;
      label: string;
      group: string;
      subjectIds: string[];
      totalMarks: number;
    };

export function buildGazetteColumns(
  subjects: SubjectMeta[],
): GazetteColumn[] {
  const columns: GazetteColumn[] = [];
  const seenGroups = new Set<string>();

  for (const subject of subjects) {
    // Science Bio/Computer are mutually exclusive → one gazette column.
    if (subject.electiveGroup === SCIENCE_ELECTIVE_GROUP) {
      if (seenGroups.has(subject.electiveGroup)) continue;
      seenGroups.add(subject.electiveGroup);
      const groupSubjects = subjects.filter(
        (row) => row.electiveGroup === subject.electiveGroup,
      );
      columns.push({
        kind: "elective",
        key: `group:${subject.electiveGroup}`,
        label: groupSubjects.map((row) => shortElectiveLabel(row.name)).join(" / "),
        group: subject.electiveGroup,
        subjectIds: groupSubjects.map((row) => row.id),
        totalMarks: Math.max(...groupSubjects.map((row) => row.totalMarks ?? 100)),
      });
      continue;
    }
    // Arts electives (and any other subjects) each get their own column.
    columns.push({
      kind: "subject",
      key: `subject:${subject.id}`,
      label: subject.name,
      subjectId: subject.id,
      totalMarks: subject.totalMarks ?? 100,
    });
  }
  return columns;
}

export function compileSectionResult(input: {
  passPercent: number;
  students: Array<{
    id: string;
    rollNumber: string;
    name: string;
    fatherName: string;
    stream: StudentStream;
    electiveSubjectId?: string | null;
    electiveChoiceIds?: string[] | null;
  }>;
  subjects: SubjectMeta[];
  marks: Array<{
    studentId: string;
    subjectId: string;
    obtainedMarks: number | null;
    isAbsent: boolean;
  }>;
}): { columns: GazetteColumn[]; rows: CompiledStudent[] } {
  const markMap = new Map<string, { obtainedMarks: number | null; isAbsent: boolean }>();
  for (const mark of input.marks) {
    markMap.set(`${mark.studentId}:${mark.subjectId}`, mark);
  }

  const columns = buildGazetteColumns(input.subjects);
  const subjectById = new Map(input.subjects.map((subject) => [subject.id, subject]));

  const rows: CompiledStudent[] = input.students.map((student) => {
    const cells: CompiledSubjectCell[] = columns.map((column) => {
      if (column.kind === "subject") {
        const subject = subjectById.get(column.subjectId)!;
        const applicable = isStudentEnrolledInSubject(student, subject);
        const mark = markMap.get(`${student.id}:${subject.id}`);
        const isAbsent = applicable && (mark?.isAbsent ?? false);
        const obtained = !applicable
          ? null
          : isAbsent
            ? 0
            : mark?.obtainedMarks ?? null;
        const entered = !applicable
          ? true
          : Boolean(mark && (mark.isAbsent || mark.obtainedMarks != null));
        return {
          id: subject.id,
          name: subject.name,
          totalMarks: subject.totalMarks ?? 100,
          obtained,
          isAbsent,
          entered,
          applicable,
          display: !applicable
            ? "—"
            : isAbsent
              ? "Abs"
              : obtained == null
                ? "—"
                : String(obtained),
        };
      }

      const chosenIds = chosenElectiveIds(student);
      const chosen = column.subjectIds
        .map((id) => subjectById.get(id)!)
        .find((subject) => chosenIds.includes(subject.id));
      if (!chosen) {
        return {
          id: column.key,
          name: column.label,
          totalMarks: column.totalMarks,
          obtained: null,
          isAbsent: false,
          entered: true,
          applicable: false,
          display: "—",
        };
      }
      const mark = markMap.get(`${student.id}:${chosen.id}`);
      const isAbsent = mark?.isAbsent ?? false;
      const obtained = isAbsent ? 0 : mark?.obtainedMarks ?? null;
      const entered = Boolean(mark && (mark.isAbsent || mark.obtainedMarks != null));
      return {
        id: chosen.id,
        name: chosen.name,
        totalMarks: chosen.totalMarks ?? column.totalMarks,
        obtained,
        isAbsent,
        entered,
        applicable: true,
        display: !entered
          ? "—"
          : isAbsent
            ? `${shortElectiveLabel(chosen.name)} Abs`
            : `${shortElectiveLabel(chosen.name)} ${obtained}`,
      };
    });

    const scored = cells.filter((cell) => cell.applicable);
    const complete = scored.length > 0 && scored.every((cell) => cell.entered);
    const obtainedTotal = scored.reduce((sum, cell) => sum + (cell.obtained ?? 0), 0);
    const maxTotal = scored.reduce((sum, cell) => sum + cell.totalMarks, 0);
    const percent = complete ? percentOf(obtainedTotal, maxTotal) : null;
    const passed =
      complete &&
      scored.every((cell) => {
        if (cell.isAbsent) return false;
        const subjectPercent = percentOf(cell.obtained ?? 0, cell.totalMarks);
        return subjectPercent != null && subjectPercent >= input.passPercent;
      }) &&
      percent != null &&
      percent >= input.passPercent;

    return {
      id: student.id,
      rollNumber: student.rollNumber,
      name: student.name,
      fatherName: student.fatherName,
      stream: student.stream,
      electiveSubjectId: student.electiveSubjectId ?? null,
      electiveChoiceIds: chosenElectiveIds(student),
      cells,
      obtainedTotal,
      maxTotal,
      percent,
      grade: gradeFromPercent(percent),
      passed,
      complete,
      position: null,
    };
  });

  const ranked = [...rows]
    .filter((row) => row.complete)
    .sort((a, b) => b.obtainedTotal - a.obtainedTotal || sortByRoll(a.rollNumber, b.rollNumber));

  let lastTotal: number | null = null;
  let lastPosition = 0;
  ranked.forEach((row) => {
    // Dense rank: tied students share a position; next unique total is +1 (1,1,2 not 1,1,3).
    if (lastTotal === row.obtainedTotal) {
      row.position = lastPosition;
      return;
    }
    lastPosition += 1;
    lastTotal = row.obtainedTotal;
    row.position = lastPosition;
  });

  const positionById = new Map(ranked.map((row) => [row.id, row.position]));
  return {
    columns,
    rows: rows
      .map((row) => ({ ...row, position: positionById.get(row.id) ?? null }))
      .sort((a, b) => {
        if (a.position != null && b.position != null) {
          return a.position - b.position || sortByRoll(a.rollNumber, b.rollNumber);
        }
        if (a.position != null) return -1;
        if (b.position != null) return 1;
        return sortByRoll(a.rollNumber, b.rollNumber);
      }),
  };
}

/** Sum marks across selected rounds. Missing mark in an existing assessment counts as 0. */
export function compileCombinedSectionResult(input: {
  passPercent: number;
  students: Array<{
    id: string;
    rollNumber: string;
    name: string;
    fatherName: string;
    stream: StudentStream;
    electiveSubjectId?: string | null;
    electiveChoiceIds?: string[] | null;
  }>;
  rounds: Array<{
    assessments: Array<{
      subjectId: string;
      subject: {
        id: string;
        name: string;
        track?: SubjectTrack | null;
        electiveGroup?: string | null;
      };
      totalMarks: number;
      marks: Array<{
        studentId: string;
        obtainedMarks: number | null;
        isAbsent: boolean;
      }>;
    }>;
  }>;
}): { columns: GazetteColumn[]; rows: CompiledStudent[] } {
  type AggSubject = SubjectMeta & {
    assessmentRounds: number;
  };
  type AggMark = {
    obtained: number;
    absents: number;
    assessmentRounds: number;
  };

  const subjectAgg = new Map<string, AggSubject>();
  const markAgg = new Map<string, AggMark>();

  for (const round of input.rounds) {
    for (const assessment of round.assessments) {
      const meta = resolveSubjectMeta({
        id: assessment.subject.id,
        name: assessment.subject.name,
        track: assessment.subject.track,
        electiveGroup: assessment.subject.electiveGroup,
        totalMarks: assessment.totalMarks,
      });
      const existing = subjectAgg.get(meta.id);
      if (existing) {
        existing.totalMarks = (existing.totalMarks ?? 0) + assessment.totalMarks;
        existing.assessmentRounds += 1;
      } else {
        subjectAgg.set(meta.id, {
          ...meta,
          totalMarks: assessment.totalMarks,
          assessmentRounds: 1,
        });
      }

      const marksByStudent = new Map(
        assessment.marks.map((mark) => [mark.studentId, mark]),
      );
      for (const student of input.students) {
        if (!isStudentEnrolledInSubject(student, meta)) continue;
        const key = `${student.id}:${meta.id}`;
        const mark = marksByStudent.get(student.id);
        const isAbsent = mark?.isAbsent ?? false;
        const obtained =
          isAbsent || mark?.obtainedMarks == null ? 0 : mark.obtainedMarks;
        const current = markAgg.get(key) ?? {
          obtained: 0,
          absents: 0,
          assessmentRounds: 0,
        };
        current.obtained += obtained;
        current.assessmentRounds += 1;
        if (isAbsent) current.absents += 1;
        markAgg.set(key, current);
      }
    }
  }

  const subjects = [...subjectAgg.values()].sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
  );

  const forcedMarks = [...markAgg.entries()].map(([key, agg]) => {
    const [studentId, subjectId] = key.split(":");
    const allAbsent =
      agg.assessmentRounds > 0 && agg.absents === agg.assessmentRounds;
    return {
      studentId,
      subjectId,
      obtainedMarks: allAbsent ? 0 : agg.obtained,
      isAbsent: allAbsent,
    };
  });

  for (const student of input.students) {
    for (const subject of subjects) {
      if (!isStudentEnrolledInSubject(student, subject)) continue;
      const key = `${student.id}:${subject.id}`;
      if (markAgg.has(key)) continue;
      forcedMarks.push({
        studentId: student.id,
        subjectId: subject.id,
        obtainedMarks: 0,
        isAbsent: false,
      });
    }
  }

  return compileSectionResult({
    passPercent: input.passPercent,
    students: input.students,
    subjects,
    marks: forcedMarks,
  });
}

export type MultiRoundColumn = {
  key: string;
  label: string;
  totalMarks: number;
  rounds: Array<{ id: string; label: string; totalMarks: number }>;
};

export type MultiRoundBreakdownCell = {
  key: string;
  roundValues: Array<{ roundId: string; display: string }>;
  totalDisplay: string;
};

export type MultiRoundStudentRow = CompiledStudent & {
  breakdown: MultiRoundBreakdownCell[];
};

type RoundAssessmentInput = {
  subjectId: string;
  subject: {
    id: string;
    name: string;
    track?: SubjectTrack | null;
    electiveGroup?: string | null;
  };
  totalMarks: number;
  marks: Array<{
    studentId: string;
    obtainedMarks: number | null;
    isAbsent: boolean;
  }>;
};

/** Same totals as the combined result, plus a per-round breakdown for each subject column. */
export function compileMultiRoundSectionResult(input: {
  passPercent: number;
  students: Array<{
    id: string;
    rollNumber: string;
    name: string;
    fatherName: string;
    stream: StudentStream;
    electiveSubjectId?: string | null;
    electiveChoiceIds?: string[] | null;
  }>;
  rounds: Array<{
    id: string;
    label: string;
    assessments: RoundAssessmentInput[];
  }>;
}): { columns: MultiRoundColumn[]; rows: MultiRoundStudentRow[] } {
  const combined = compileCombinedSectionResult({
    passPercent: input.passPercent,
    students: input.students,
    rounds: input.rounds.map((round) => ({ assessments: round.assessments })),
  });

  const totalsByRound = new Map<string, Map<string, number>>();
  const marksByRound = new Map<
    string,
    Map<string, { obtainedMarks: number | null; isAbsent: boolean }>
  >();
  for (const round of input.rounds) {
    const totals = new Map<string, number>();
    const marks = new Map<
      string,
      { obtainedMarks: number | null; isAbsent: boolean }
    >();
    for (const assessment of round.assessments) {
      totals.set(assessment.subject.id, assessment.totalMarks);
      for (const mark of assessment.marks) {
        marks.set(`${mark.studentId}:${assessment.subject.id}`, {
          obtainedMarks: mark.obtainedMarks,
          isAbsent: mark.isAbsent,
        });
      }
    }
    totalsByRound.set(round.id, totals);
    marksByRound.set(round.id, marks);
  }

  const columnSubjectIds = combined.columns.map((column) =>
    column.kind === "subject" ? [column.subjectId] : column.subjectIds,
  );

  const columns: MultiRoundColumn[] = combined.columns.map((column, index) => {
    const subjectIds = columnSubjectIds[index];
    const rounds = input.rounds
      .map((round) => {
        const totals = totalsByRound.get(round.id);
        const present = subjectIds
          .map((subjectId) => totals?.get(subjectId))
          .filter((value): value is number => value != null);
        if (present.length === 0) return null;
        return {
          id: round.id,
          label: round.label,
          totalMarks: Math.max(...present),
        };
      })
      .filter((round): round is NonNullable<typeof round> => round != null);
    return {
      key: column.key,
      label: column.label,
      totalMarks: column.totalMarks,
      rounds,
    };
  });

  const rows: MultiRoundStudentRow[] = combined.rows.map((row) => {
    const breakdown = combined.columns.map((column, index) => {
      const subjectIds = columnSubjectIds[index];
      const chosenSubjectId =
        column.kind === "subject"
          ? subjectIds[0]
          : subjectIds.find((id) => row.electiveChoiceIds.includes(id)) ??
            subjectIds.find((id) => id === row.electiveSubjectId) ??
            null;
      const applicable = row.cells[index]?.applicable ?? false;

      const roundValues = columns[index].rounds.map((round) => {
        if (!applicable || !chosenSubjectId) {
          return { roundId: round.id, display: "—" };
        }
        const hasAssessment = totalsByRound
          .get(round.id)
          ?.has(chosenSubjectId);
        if (!hasAssessment) return { roundId: round.id, display: "—" };
        const mark = marksByRound
          .get(round.id)
          ?.get(`${row.id}:${chosenSubjectId}`);
        if (mark?.isAbsent) return { roundId: round.id, display: "Abs" };
        return {
          roundId: round.id,
          display: String(mark?.obtainedMarks ?? 0),
        };
      });

      return {
        key: column.key,
        roundValues,
        totalDisplay: row.cells[index]?.display ?? "—",
      };
    });

    return { ...row, breakdown };
  });

  return { columns, rows };
}

export { resolveSubjectMeta };
