"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  addWorkingDaysYmd,
  cumulativeGapWorkingDays,
  dateForRound,
  weekdayShortFromYmd,
  workingDaysBetween,
} from "@/lib/schedule-working-days";
import { createTestSchedule } from "./actions";

type TeacherOption = {
  id: string;
  name: string;
  email: string;
};

type CatalogSubject = {
  subjectId: string;
  subjectName: string;
  teachersBySectionId: Record<string, TeacherOption[]>;
};

type CatalogClass = {
  classId: string;
  className: string;
  sections: Array<{ id: string; name: string }>;
  subjects: CatalogSubject[];
};

export type ScheduleCatalogBoard = {
  boardId: string;
  boardName: string;
  classes: CatalogClass[];
};

type DateSlot = {
  key: string;
  date: string;
};

type RoundDraft = {
  key: string;
  name: string;
  subjectDateSlots: Record<string, DateSlot[]>;
};

const STEPS = [
  { id: 1, label: "Name" },
  { id: 2, label: "Board" },
  { id: 3, label: "Classes" },
  { id: 4, label: "Sections" },
  { id: 5, label: "Subjects" },
  { id: 6, label: "Details" },
] as const;

function sortByName(a: string, b: string) {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
}

function newKey() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function newDateSlot(date = ""): DateSlot {
  return { key: newKey(), date };
}

function newRoundDraft(
  orderIndex: number,
  initial?: Partial<Pick<RoundDraft, "subjectDateSlots">>,
): RoundDraft {
  return {
    key: newKey(),
    name: `Round ${orderIndex + 1}`,
    subjectDateSlots: initial?.subjectDateSlots ?? {},
  };
}

export function CreateScheduleForm({
  catalog,
}: {
  catalog: ScheduleCatalogBoard[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [step, setStep] = useState(1);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [selectedBoardId, setSelectedBoardId] = useState("");
  const [selectedClassIds, setSelectedClassIds] = useState<string[]>([]);
  const [selectedSectionIds, setSelectedSectionIds] = useState<string[]>([]);
  const [selectedSubjectNames, setSelectedSubjectNames] = useState<string[]>([]);
  const [roundCount, setRoundCount] = useState(1);
  /** gapsBeforeRound[i] = extra working days before Round i+1 (shifts that round and later). */
  const [gapsBeforeRound, setGapsBeforeRound] = useState<number[]>([]);
  const [rounds, setRounds] = useState<RoundDraft[]>([newRoundDraft(0)]);
  const [activeRoundKey, setActiveRoundKey] = useState(() => rounds[0]!.key);

  const selectedBoard = useMemo(
    () => catalog.find((board) => board.boardId === selectedBoardId) ?? null,
    [catalog, selectedBoardId],
  );

  const boardClasses = selectedBoard?.classes ?? [];

  const selectedClasses = useMemo(
    () =>
      boardClasses
        .filter((c) => selectedClassIds.includes(c.classId))
        .sort((a, b) => sortByName(a.className, b.className)),
    [boardClasses, selectedClassIds],
  );

  const selectedSectionIdSet = useMemo(
    () => new Set(selectedSectionIds),
    [selectedSectionIds],
  );

  const availableSubjects = useMemo(() => {
    const names = new Set<string>();
    for (const classItem of selectedClasses) {
      for (const subject of classItem.subjects) {
        names.add(subject.subjectName);
      }
    }
    return [...names].sort(sortByName);
  }, [selectedClasses]);

  const subjectTeacherGaps = useMemo(() => {
    const gaps = new Map<string, string[]>();
    for (const subjectName of availableSubjects) {
      const missing: string[] = [];
      for (const classItem of selectedClasses) {
        const subject = classItem.subjects.find((s) => s.subjectName === subjectName);
        if (!subject) continue;
        const chosenSections = classItem.sections.filter((section) =>
          selectedSectionIdSet.has(section.id),
        );
        if (chosenSections.length === 0) {
          missing.push(classItem.className);
          continue;
        }
        const sectionsWithoutTeacher = chosenSections.filter(
          (section) => (subject.teachersBySectionId[section.id] ?? []).length === 0,
        );
        if (sectionsWithoutTeacher.length > 0) {
          missing.push(
            `${classItem.className} (${sectionsWithoutTeacher
              .map((section) => section.name)
              .join(", ")})`,
          );
        }
      }
      gaps.set(subjectName, missing);
    }
    return gaps;
  }, [availableSubjects, selectedClasses, selectedSectionIdSet]);

  const detailRows = useMemo(() => {
    return selectedSubjectNames
      .slice()
      .sort(sortByName)
      .map((subjectName) => {
        const cells = selectedClasses
          .map((classItem) => {
            const subject = classItem.subjects.find((s) => s.subjectName === subjectName);
            if (!subject) return null;
            const sections = classItem.sections
              .filter((section) => selectedSectionIdSet.has(section.id))
              .slice()
              .sort((a, b) => sortByName(a.name, b.name));
            if (sections.length === 0) return null;
            return {
              classId: classItem.classId,
              className: classItem.className,
              subjectId: subject.subjectId,
              sections,
              teachersBySectionId: subject.teachersBySectionId,
            };
          })
          .filter((cell): cell is NonNullable<typeof cell> => Boolean(cell))
          .sort((a, b) => sortByName(a.className, b.className));

        return { subjectName, cells };
      })
      .filter((row) => row.cells.length > 0);
  }, [selectedSubjectNames, selectedClasses, selectedSectionIdSet]);

  const activeRound =
    rounds.find((round) => round.key === activeRoundKey) ?? rounds[0] ?? null;

  function buildSeededDateSlots(): Record<string, DateSlot[]> {
    const subjectDateSlots: Record<string, DateSlot[]> = {};
    for (const row of detailRows) {
      subjectDateSlots[row.subjectName] = [newDateSlot()];
    }
    return subjectDateSlots;
  }

  function subjectOrder(): string[] {
    return detailRows.map((row) => row.subjectName);
  }

  function cloneRounds(source: RoundDraft[]): RoundDraft[] {
    return source.map((round) => ({
      ...round,
      subjectDateSlots: Object.fromEntries(
        Object.entries(round.subjectDateSlots).map(([name, slots]) => [
          name,
          slots.map((slot) => ({ ...slot })),
        ]),
      ),
    }));
  }

  function round1AllFilled(round1: RoundDraft, names: string[]): boolean {
    return (
      names.length > 0 &&
      names.every((name) => Boolean(round1.subjectDateSlots[name]?.[0]?.date?.trim()))
    );
  }

  /** Shift every slot at/after (fromRound, fromSubject) by delta working days. */
  function shiftSlotsFrom(
    source: RoundDraft[],
    names: string[],
    fromRoundIndex: number,
    fromSubjectIndex: number,
    delta: number,
    options?: { includeStart?: boolean },
  ): RoundDraft[] {
    if (delta === 0 || names.length === 0) return source;
    const includeStart = options?.includeStart ?? true;
    const next = cloneRounds(source);
    let passedStart = false;
    for (let r = 0; r < next.length; r++) {
      for (let s = 0; s < names.length; s++) {
        const name = names[s]!;
        const isStart = r === fromRoundIndex && s === fromSubjectIndex;
        if (!passedStart) {
          if (isStart) {
            passedStart = true;
            if (!includeStart) continue;
          } else {
            continue;
          }
        }
        const slot = next[r]?.subjectDateSlots[name]?.[0];
        if (slot?.date?.trim()) {
          slot.date = addWorkingDaysYmd(slot.date.trim(), delta);
        }
      }
    }
    return next;
  }

  function regenerateRoundsFromRound1(
    round1: RoundDraft,
    count: number,
    subjectNames: string[],
    previousRounds: RoundDraft[] = [],
    gaps: number[] = [],
  ): RoundDraft[] {
    const n = Math.max(subjectNames.length, 1);
    const bases: Record<string, string> = {};
    let allFilled = subjectNames.length > 0;
    for (const name of subjectNames) {
      const date = round1.subjectDateSlots[name]?.[0]?.date?.trim() ?? "";
      if (!date) {
        allFilled = false;
        break;
      }
      bases[name] = date;
    }

    const nextRounds: RoundDraft[] = [];
    for (let i = 0; i < count; i++) {
      const previous = i === 0 ? round1 : previousRounds[i];
      const extraGaps = cumulativeGapWorkingDays(gaps, i);
      const subjectDateSlots: Record<string, DateSlot[]> = {};
      for (const name of subjectNames) {
        const prevSlot = previous?.subjectDateSlots[name]?.[0];
        if (i === 0) {
          subjectDateSlots[name] = [
            {
              key: round1.subjectDateSlots[name]?.[0]?.key ?? newKey(),
              date: round1.subjectDateSlots[name]?.[0]?.date ?? "",
            },
          ];
        } else if (allFilled) {
          subjectDateSlots[name] = [
            {
              key: prevSlot?.key ?? newKey(),
              date: dateForRound(bases[name]!, i, n, extraGaps),
            },
          ];
        } else {
          subjectDateSlots[name] = [
            { key: prevSlot?.key ?? newKey(), date: "" },
          ];
        }
      }
      nextRounds.push({
        key: previous?.key ?? newKey(),
        name: `Round ${i + 1}`,
        subjectDateSlots,
      });
    }
    return nextRounds;
  }

  function resizeGaps(count: number, previous: number[] = gapsBeforeRound): number[] {
    const next = previous.slice(0, Math.max(0, count));
    while (next.length < Math.max(0, count)) next.push(0);
    if (next.length > 0) next[0] = 0;
    return next;
  }

  function resetDownstreamFromBoard() {
    setSelectedClassIds([]);
    setSelectedSectionIds([]);
    setSelectedSubjectNames([]);
    setRoundCount(1);
    setGapsBeforeRound([]);
    const first = newRoundDraft(0);
    setRounds([first]);
    setActiveRoundKey(first.key);
  }

  function selectBoard(boardId: string) {
    setSelectedBoardId(boardId);
    resetDownstreamFromBoard();
  }

  function toggleClass(classId: string) {
    setSelectedClassIds((prev) => {
      const next = prev.includes(classId)
        ? prev.filter((id) => id !== classId)
        : [...prev, classId];
      const allowedSectionIds = new Set(
        boardClasses
          .filter((classItem) => next.includes(classItem.classId))
          .flatMap((classItem) => classItem.sections.map((section) => section.id)),
      );
      setSelectedSectionIds((sections) =>
        sections.filter((sectionId) => allowedSectionIds.has(sectionId)),
      );
      return next;
    });
    setSelectedSubjectNames([]);
    setRoundCount(1);
    setGapsBeforeRound([]);
    const first = newRoundDraft(0);
    setRounds([first]);
    setActiveRoundKey(first.key);
  }

  function toggleSection(sectionId: string) {
    setSelectedSectionIds((prev) =>
      prev.includes(sectionId)
        ? prev.filter((id) => id !== sectionId)
        : [...prev, sectionId],
    );
    setSelectedSubjectNames([]);
    setRoundCount(1);
    setGapsBeforeRound([]);
    const first = newRoundDraft(0);
    setRounds([first]);
    setActiveRoundKey(first.key);
  }

  function toggleSubject(subjectName: string) {
    const missing = subjectTeacherGaps.get(subjectName) ?? [];
    if (missing.length > 0 && !selectedSubjectNames.includes(subjectName)) {
      setError(
        `${subjectName} has no eligible teacher for: ${missing.join(", ")}. Assign a teacher to this subject first.`,
      );
      return;
    }
    setError(null);
    setSelectedSubjectNames((prev) =>
      prev.includes(subjectName)
        ? prev.filter((name) => name !== subjectName)
        : [...prev, subjectName],
    );
  }

  function changeRoundCount(nextCount: number) {
    const count = Math.max(1, Math.min(52, nextCount));
    setRoundCount(count);
    setGapsBeforeRound((prevGaps) => {
      const nextGaps = resizeGaps(count, prevGaps);
      setRounds((prev) => {
        const names = subjectOrder();
        if (count <= prev.length) {
          const trimmed = prev.slice(0, count);
          if (!trimmed.some((r) => r.key === activeRoundKey)) {
            setActiveRoundKey(trimmed[0]!.key);
          }
          return trimmed;
        }
        const round1 =
          prev[0] ??
          newRoundDraft(0, { subjectDateSlots: buildSeededDateSlots() });
        const generated = regenerateRoundsFromRound1(
          round1,
          count,
          names.length > 0 ? names : selectedSubjectNames,
          prev,
          nextGaps,
        );
        // Keep existing round dates; only append newly generated rounds.
        const merged = [
          ...prev,
          ...generated.slice(prev.length).map((round, offset) => ({
            ...round,
            key: round.key,
            name: `Round ${prev.length + offset + 1}`,
          })),
        ];
        return merged;
      });
      return nextGaps;
    });
  }

  function updateSubjectDate(
    roundIndex: number,
    subjectName: string,
    date: string,
  ) {
    setRounds((prev) => {
      const names = subjectOrder();
      const subjectIndex = names.indexOf(subjectName);
      if (subjectIndex < 0 || !prev[roundIndex]) return prev;

      const oldDate =
        prev[roundIndex]?.subjectDateSlots[subjectName]?.[0]?.date?.trim() ?? "";
      const next = cloneRounds(prev);
      const round = next[roundIndex]!;
      round.subjectDateSlots[subjectName] = [
        {
          key: round.subjectDateSlots[subjectName]?.[0]?.key ?? newKey(),
          date,
        },
      ];

      // First time Round 1 becomes complete → seed later rounds from formula.
      if (
        roundIndex === 0 &&
        !oldDate &&
        date.trim() &&
        round1AllFilled(round, names)
      ) {
        return regenerateRoundsFromRound1(
          round,
          roundCount,
          names,
          next,
          gapsBeforeRound,
        );
      }

      if (!oldDate || !date.trim()) return next;

      const delta = workingDaysBetween(oldDate, date.trim());
      if (delta === 0) return next;

      return shiftSlotsFrom(next, names, roundIndex, subjectIndex, delta, {
        includeStart: false,
      });
    });
  }

  function updateGapBeforeRound(roundIndex: number, rawDays: number) {
    if (roundIndex <= 0) return;
    const days = Math.max(0, Math.min(60, Math.floor(rawDays) || 0));
    setGapsBeforeRound((prevGaps) => {
      const nextGaps = resizeGaps(roundCount, prevGaps);
      const previousDays = nextGaps[roundIndex] ?? 0;
      nextGaps[roundIndex] = days;
      const delta = days - previousDays;
      if (delta !== 0) {
        setRounds((prev) =>
          shiftSlotsFrom(prev, subjectOrder(), roundIndex, 0, delta, {
            includeStart: true,
          }),
        );
      }
      return nextGaps;
    });
  }

  function goNext() {
    setError(null);
    if (step === 1) {
      if (name.trim().length < 2) {
        setError("Enter a schedule name (at least 2 characters).");
        return;
      }
      setStep(2);
      return;
    }
    if (step === 2) {
      if (!selectedBoardId) {
        setError("Select a board.");
        return;
      }
      setStep(3);
      return;
    }
    if (step === 3) {
      if (selectedClassIds.length === 0) {
        setError("Select at least one class.");
        return;
      }
      const classesWithoutSections = selectedClasses.filter(
        (classItem) => classItem.sections.length === 0,
      );
      if (classesWithoutSections.length > 0) {
        setError(
          `These classes have no sections yet: ${classesWithoutSections
            .map((c) => c.className)
            .join(", ")}. Create sections in Academic Setup first.`,
        );
        return;
      }
      setStep(4);
      return;
    }
    if (step === 4) {
      if (selectedSectionIds.length === 0) {
        setError("Select at least one section.");
        return;
      }
      const classesMissingSections = selectedClasses.filter(
        (classItem) =>
          !classItem.sections.some((section) => selectedSectionIdSet.has(section.id)),
      );
      if (classesMissingSections.length > 0) {
        setError(
          `Choose at least one section for: ${classesMissingSections
            .map((c) => c.className)
            .join(", ")}.`,
        );
        return;
      }
      setStep(5);
      return;
    }
    if (step === 5) {
      if (selectedSubjectNames.length === 0) {
        setError("Select at least one subject.");
        return;
      }
      if (detailRows.length === 0) {
        setError("Selected subjects are not available on the chosen classes.");
        return;
      }
      const blocked = selectedSubjectNames.filter(
        (subjectName) => (subjectTeacherGaps.get(subjectName) ?? []).length > 0,
      );
      if (blocked.length > 0) {
        setError(
          `These subjects have no eligible teacher for one or more selected sections: ${blocked.join(", ")}. Assign teachers first, then try again.`,
        );
        return;
      }
      const seeded = buildSeededDateSlots();
      const prevRound1 = rounds[0];
      if (prevRound1) {
        for (const name of Object.keys(seeded)) {
          const prevSlot = prevRound1.subjectDateSlots[name]?.[0];
          if (prevSlot?.date) {
            seeded[name] = [{ key: prevSlot.key, date: prevSlot.date }];
          }
        }
      }
      const round1: RoundDraft = {
        key: prevRound1?.key ?? newKey(),
        name: "Round 1",
        subjectDateSlots: seeded,
      };
      const nextGaps = resizeGaps(roundCount, gapsBeforeRound);
      setGapsBeforeRound(nextGaps);
      const initial = regenerateRoundsFromRound1(
        round1,
        roundCount,
        selectedSubjectNames,
        rounds,
        nextGaps,
      );
      setRounds(initial);
      setActiveRoundKey((current) =>
        initial.some((r) => r.key === current) ? current : initial[0]!.key,
      );
      setStep(6);
    }
  }

  function goBack() {
    setError(null);
    setStep((s) => Math.max(1, s - 1));
  }

  function buildSubjectsForRound(round: RoundDraft) {
    const subjects: Array<{
      subjectName: string;
      testDate: string;
      classAssignments: Array<{
        classId: string;
        subjectId: string;
        sectionAssignments: Array<{
          sectionId: string;
          teacherId: string;
        }>;
      }>;
    }> = [];

    for (const row of detailRows) {
      const slots = round.subjectDateSlots[row.subjectName] ?? [newDateSlot()];
      const dates = slots.map((s) => s.date.trim()).filter(Boolean);
      if (dates.length === 0) {
        throw new Error(
          `${round.name}: set Round 1 dates for ${row.subjectName} first.`,
        );
      }
      if (dates.length > 1) {
        throw new Error(
          `${round.name}: ${row.subjectName} should have one date per round.`,
        );
      }

      const classAssignments = row.cells.map((cell) => ({
        classId: cell.classId,
        subjectId: cell.subjectId,
        sectionAssignments: cell.sections.map((section) => {
          const teachers = cell.teachersBySectionId[section.id] ?? [];
          const teacherId = teachers[0]?.id ?? "";
          if (!teacherId) {
            throw new Error(
              `${round.name}: no teacher assigned for ${row.subjectName} · ${cell.className} · ${section.name}. Assign a teacher first.`,
            );
          }
          return {
            sectionId: section.id,
            teacherId,
          };
        }),
      }));

      for (const testDate of dates) {
        subjects.push({
          subjectName: row.subjectName,
          testDate,
          classAssignments,
        });
      }
    }

    return subjects;
  }

  function onSubmit() {
    setError(null);

    try {
      if (rounds.length === 0) {
        setError("Add at least one round.");
        return;
      }
      for (const round of rounds) {
        if (!round.name.trim()) {
          setError("Every round needs a name.");
          return;
        }
      }

      const payloadRounds = rounds.map((round, order) => ({
        name: round.name.trim(),
        order,
        subjects: buildSubjectsForRound(round),
      }));

      startTransition(async () => {
        const result = await createTestSchedule({
          name,
          rounds: payloadRounds,
        });
        if (!result.ok) {
          setError(result.error);
          return;
        }
        router.push(`/org-admin/schedules/${result.scheduleId}`);
        router.refresh();
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to prepare schedule");
    }
  }

  const subjectsMissingTeachers = availableSubjects.filter(
    (subjectName) => (subjectTeacherGaps.get(subjectName) ?? []).length > 0,
  );

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <div className="rounded-[1.25rem] border border-[rgba(15,40,70,0.1)] bg-white p-4 shadow-[0_10px_30px_rgba(15,40,70,0.05)] sm:p-5">
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {STEPS.map((item, index) => {
            const active = step === item.id;
            const done = step > item.id;
            return (
              <div key={item.id} className="flex min-w-0 items-center gap-2">
                {index > 0 ? (
                  <div
                    className={`h-px w-4 sm:w-8 ${
                      done || active ? "bg-brand" : "bg-[rgba(15,40,70,0.12)]"
                    }`}
                  />
                ) : null}
                <div
                  className={`flex items-center gap-2 rounded-full px-2.5 py-1.5 text-xs font-semibold sm:px-3 ${
                    active
                      ? "bg-brand text-white"
                      : done
                        ? "bg-brand/10 text-brand"
                        : "bg-[#f3f7fb] text-muted"
                  }`}
                >
                  {done ? <Check className="h-3.5 w-3.5" /> : null}
                  <span>
                    {item.id}. {item.label}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="rounded-[1.25rem] border border-[rgba(15,40,70,0.1)] bg-white p-5 shadow-[0_10px_30px_rgba(15,40,70,0.05)] sm:p-6">
        {step === 1 ? (
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold text-ink">Schedule name</h3>
              <p className="mt-1 text-sm text-muted">
                Give this exam plan a clear name teachers will recognize.
              </p>
            </div>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. February Regular / Mid Term March"
              className="h-11"
            />
          </div>
        ) : null}

        {step === 2 ? (
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold text-ink">Select board</h3>
              <p className="mt-1 text-sm text-muted">
                Classes, sections, and subjects will come from this board only.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {catalog.map((board) => {
                const selected = selectedBoardId === board.boardId;
                return (
                  <button
                    key={board.boardId}
                    type="button"
                    onClick={() => selectBoard(board.boardId)}
                    className={
                      selected
                        ? "rounded-full border border-brand bg-brand/10 px-3.5 py-2 text-sm font-semibold text-brand"
                        : "rounded-full border border-[rgba(15,40,70,0.12)] bg-white px-3.5 py-2 text-sm font-medium text-ink hover:border-brand/40"
                    }
                  >
                    {board.boardName}
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}

        {step === 3 ? (
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold text-ink">Select classes</h3>
              <p className="mt-1 text-sm text-muted">
                You can include multiple classes in one schedule. Next you will pick sections.
              </p>
            </div>
            {boardClasses.length === 0 ? (
              <p className="rounded-[0.9rem] bg-[#f8fbfd] px-4 py-3 text-sm text-muted">
                No classes on this board yet.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {boardClasses.map((classItem) => {
                  const selected = selectedClassIds.includes(classItem.classId);
                  const noSections = classItem.sections.length === 0;
                  return (
                    <button
                      key={classItem.classId}
                      type="button"
                      onClick={() => toggleClass(classItem.classId)}
                      title={
                        noSections
                          ? "No sections configured for this class"
                          : undefined
                      }
                      className={
                        selected
                          ? "rounded-full border border-brand bg-brand/10 px-3.5 py-2 text-sm font-semibold text-brand"
                          : "rounded-full border border-[rgba(15,40,70,0.12)] bg-white px-3.5 py-2 text-sm font-medium text-ink hover:border-brand/40"
                      }
                    >
                      {classItem.className}
                      {noSections ? " · no sections" : ""}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        ) : null}

        {step === 4 ? (
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold text-ink">Select sections</h3>
              <p className="mt-1 text-sm text-muted">
                Choose which sections of the selected classes this schedule covers.
              </p>
            </div>
            {selectedClasses.length === 0 ? (
              <p className="rounded-[0.9rem] bg-[#f8fbfd] px-4 py-3 text-sm text-muted">
                Select classes first.
              </p>
            ) : (
              <div className="space-y-4">
                {selectedClasses.map((classItem) => (
                  <div
                    key={classItem.classId}
                    className="rounded-[0.9rem] border border-[rgba(15,40,70,0.08)] bg-[#f8fbfd] p-4"
                  >
                    <p className="text-sm font-semibold text-ink">{classItem.className}</p>
                    {classItem.sections.length === 0 ? (
                      <p className="mt-2 text-sm text-muted">No sections for this class.</p>
                    ) : (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {classItem.sections.map((section) => {
                          const selected = selectedSectionIdSet.has(section.id);
                          return (
                            <button
                              key={section.id}
                              type="button"
                              onClick={() => toggleSection(section.id)}
                              className={
                                selected
                                  ? "rounded-full border border-brand bg-brand/10 px-3.5 py-2 text-sm font-semibold text-brand"
                                  : "rounded-full border border-[rgba(15,40,70,0.12)] bg-white px-3.5 py-2 text-sm font-medium text-ink hover:border-brand/40"
                              }
                            >
                              {section.name}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : null}

        {step === 5 ? (
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold text-ink">Select subjects</h3>
              <p className="mt-1 text-sm text-muted">
                These subjects can be used in every round. Dates stay per round.
              </p>
            </div>
            {availableSubjects.length === 0 ? (
              <p className="rounded-[0.9rem] bg-[#f8fbfd] px-4 py-3 text-sm text-muted">
                No subjects found for the selected classes.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {availableSubjects.map((subjectName) => {
                  const selected = selectedSubjectNames.includes(subjectName);
                  const missing = subjectTeacherGaps.get(subjectName) ?? [];
                  const blocked = missing.length > 0;
                  return (
                    <button
                      key={subjectName}
                      type="button"
                      onClick={() => toggleSubject(subjectName)}
                      title={blocked ? `No teacher for: ${missing.join(", ")}` : undefined}
                      className={
                        blocked
                          ? "cursor-not-allowed rounded-full border border-dashed border-[rgba(15,40,70,0.18)] bg-[#f8fbfd] px-3.5 py-2 text-sm font-medium text-muted opacity-70"
                          : selected
                            ? "rounded-full border border-brand bg-brand/10 px-3.5 py-2 text-sm font-semibold text-brand"
                            : "rounded-full border border-[rgba(15,40,70,0.12)] bg-white px-3.5 py-2 text-sm font-medium text-ink hover:border-brand/40"
                      }
                    >
                      {subjectName}
                      {blocked ? " · no teacher" : ""}
                    </button>
                  );
                })}
              </div>
            )}
            {subjectsMissingTeachers.length > 0 ? (
              <div className="rounded-[0.9rem] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
                <p className="font-semibold">
                  {subjectsMissingTeachers.length} subject
                  {subjectsMissingTeachers.length === 1 ? "" : "s"} need a teacher before scheduling
                </p>
                <Link
                  href="/org-admin/teachers/new"
                  className="mt-2 inline-flex text-sm font-semibold text-brand underline-offset-2 hover:underline"
                >
                  Add / assign teacher →
                </Link>
              </div>
            ) : null}
          </div>
        ) : null}

        {step === 6 && activeRound ? (
          <div className="space-y-5">
            <div>
              <h3 className="text-lg font-semibold text-ink">Rounds & dates</h3>
              <p className="mt-1 text-sm text-muted">
                Set Round 1 dates first (later rounds auto-fill). You can edit any
                test date — later tests in that round and all next rounds shift by
                the same working-day gap (Sunday off). Use round gaps for breaks
                between rounds.
              </p>
            </div>

            <label className="block max-w-xs">
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted">
                How many rounds?
              </span>
              <Input
                type="number"
                min={1}
                max={52}
                value={roundCount}
                onChange={(e) =>
                  changeRoundCount(Number.parseInt(e.target.value || "1", 10))
                }
                className="h-10 bg-white"
              />
            </label>

            <div className="flex flex-wrap items-center gap-2">
              {rounds.map((round, index) => {
                const active = round.key === activeRound.key;
                const gap = gapsBeforeRound[index] ?? 0;
                return (
                  <button
                    key={round.key}
                    type="button"
                    onClick={() => setActiveRoundKey(round.key)}
                    className={
                      active
                        ? "rounded-full border border-brand bg-brand/10 px-3.5 py-2 text-sm font-semibold text-brand"
                        : "rounded-full border border-[rgba(15,40,70,0.12)] bg-white px-3.5 py-2 text-sm font-medium text-ink hover:border-brand/40"
                    }
                  >
                    {round.name}
                    {gap > 0 && index > 0 ? (
                      <span className="ml-1 text-[11px] font-medium opacity-80">
                        +{gap}d
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>

            {(() => {
              const activeIndex = rounds.findIndex((r) => r.key === activeRound.key);
              const isRound1 = activeIndex === 0;
              const gapValue =
                activeIndex >= 0 ? (gapsBeforeRound[activeIndex] ?? 0) : 0;
              const shiftedBy =
                activeIndex > 0
                  ? cumulativeGapWorkingDays(gapsBeforeRound, activeIndex)
                  : 0;
              return (
                <>
                  {activeIndex > 0 ? (
                    <p className="rounded-[0.9rem] border border-[rgba(15,40,70,0.08)] bg-[#f8fbfd] px-4 py-3 text-sm text-muted">
                      Edit any date below to skip a holiday — remaining tests in
                      this round and later rounds move with it
                      {shiftedBy > 0
                        ? ` (current round gaps total +${shiftedBy} working day${shiftedBy === 1 ? "" : "s"})`
                        : ""}
                      .
                    </p>
                  ) : (
                    <p className="rounded-[0.9rem] border border-[rgba(15,40,70,0.08)] bg-[#f8fbfd] px-4 py-3 text-sm text-muted">
                      Fill Round 1 dates to generate later rounds. Editing a Round 1
                      date also shifts later tests in Round 1 and beyond.
                    </p>
                  )}

                  {!isRound1 && activeIndex >= 0 ? (
                    <label className="block max-w-xs rounded-[1rem] border border-[rgba(15,40,70,0.08)] bg-[#f8fbfd] p-4">
                      <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted">
                        Gap before {activeRound.name}
                      </span>
                      <Input
                        type="number"
                        min={0}
                        max={60}
                        value={gapValue}
                        onChange={(e) =>
                          updateGapBeforeRound(
                            activeIndex,
                            Number.parseInt(e.target.value || "0", 10),
                          )
                        }
                        className="h-10 bg-white"
                      />
                      <span className="mt-1.5 block text-xs text-muted">
                        Extra working days before this round. Shifts Round{" "}
                        {activeIndex + 1}–{rounds.length} forward.
                      </span>
                    </label>
                  ) : null}
                </>
              );
            })()}

            {detailRows.length === 0 ? (
              <p className="rounded-[0.9rem] bg-[#f8fbfd] px-4 py-3 text-sm text-muted">
                Select subjects first.
              </p>
            ) : (
              <div className="list-stack">
                {detailRows.map((row) => {
                  const date =
                    activeRound.subjectDateSlots[row.subjectName]?.[0]?.date ?? "";
                  const weekday = weekdayShortFromYmd(date);
                  const teacherSummary = row.cells
                    .flatMap((cell) =>
                      cell.sections.map((section) => {
                        const teacher =
                          cell.teachersBySectionId[section.id]?.[0]?.name ?? "—";
                        return `${cell.className} ${section.name}: ${teacher}`;
                      }),
                    )
                    .join(" · ");
                  const activeIndex = rounds.findIndex(
                    (r) => r.key === activeRound.key,
                  );
                  return (
                    <div
                      key={`${activeRound.key}-${row.subjectName}`}
                      className="rounded-[1rem] border border-[rgba(15,40,70,0.08)] bg-[#f8fbfd] p-4 sm:p-5"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="text-base font-semibold text-ink">
                            {row.subjectName}
                          </p>
                          <p className="mt-1 text-[11px] text-muted">{teacherSummary}</p>
                        </div>
                        <label className="w-full max-w-[14rem]">
                          <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted">
                            {activeRound.name} date
                          </span>
                          <div className="flex items-center gap-2">
                            <Input
                              type="date"
                              value={date}
                              onChange={(e) =>
                                updateSubjectDate(
                                  Math.max(0, activeIndex),
                                  row.subjectName,
                                  e.target.value,
                                )
                              }
                              className="h-10 flex-1 bg-white"
                            />
                            {weekday ? (
                              <span className="w-9 shrink-0 text-center text-sm font-semibold text-ink">
                                {weekday}
                              </span>
                            ) : null}
                          </div>
                        </label>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : null}

        {error ? (
          <p className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </p>
        ) : null}

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-[rgba(15,40,70,0.08)] pt-5">
          <div>
            {step > 1 ? (
              <Button type="button" variant="secondary" onClick={goBack} className="gap-2">
                <ArrowLeft className="h-4 w-4" />
                Back
              </Button>
            ) : (
              <span />
            )}
          </div>
          <div>
            {step < 6 ? (
              <Button type="button" onClick={goNext} className="gap-2">
                Next
                <ArrowRight className="h-4 w-4" />
              </Button>
            ) : (
              <Button type="button" onClick={onSubmit} disabled={pending}>
                {pending ? "Creating…" : "Create Schedule"}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
