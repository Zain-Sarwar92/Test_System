"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SearchSelect } from "@/components/ui/search-select";
import { addWorkingDaysYmd } from "@/lib/schedule-working-days";
import { createTestSchedule } from "./actions";
import { toast } from "@/components/ui/toast";

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

function sortByName(a: string, b: string) {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
}

export function CreateScheduleForm({
  catalog,
}: {
  catalog: ScheduleCatalogBoard[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [name, setName] = useState("");
  const [boardId, setBoardId] = useState("");
  const [classIds, setClassIds] = useState<string[]>([]);
  const [sectionIds, setSectionIds] = useState<string[]>([]);
  const [subjectNames, setSubjectNames] = useState<string[]>([]);
  const [subjectDates, setSubjectDates] = useState<Record<string, string>>({});
  const [roundCount, setRoundCount] = useState(1);

  const board = useMemo(
    () => catalog.find((row) => row.boardId === boardId) ?? null,
    [catalog, boardId],
  );

  const boardClasses = board?.classes ?? [];

  const selectedClasses = useMemo(
    () =>
      boardClasses
        .filter((row) => classIds.includes(row.classId))
        .sort((a, b) => sortByName(a.className, b.className)),
    [boardClasses, classIds],
  );

  const sectionIdSet = useMemo(() => new Set(sectionIds), [sectionIds]);

  const availableSubjects = useMemo(() => {
    const names = new Set<string>();
    for (const classItem of selectedClasses) {
      for (const subject of classItem.subjects) names.add(subject.subjectName);
    }
    return [...names].sort(sortByName);
  }, [selectedClasses]);

  const subjectGaps = useMemo(() => {
    const gaps = new Map<string, string[]>();
    for (const subjectName of availableSubjects) {
      const missing: string[] = [];
      for (const classItem of selectedClasses) {
        const subject = classItem.subjects.find((s) => s.subjectName === subjectName);
        if (!subject) continue;
        const chosen = classItem.sections.filter((s) => sectionIdSet.has(s.id));
        if (!chosen.length) {
          missing.push(classItem.className);
          continue;
        }
        const noTeacher = chosen.filter(
          (s) => !(subject.teachersBySectionId[s.id] ?? []).length,
        );
        if (noTeacher.length) {
          missing.push(
            `${classItem.className} (${noTeacher.map((s) => s.name).join(", ")})`,
          );
        }
      }
      gaps.set(subjectName, missing);
    }
    return gaps;
  }, [availableSubjects, selectedClasses, sectionIdSet]);

  function toggleClass(id: string) {
    setClassIds((current) => {
      const next = current.includes(id)
        ? current.filter((row) => row !== id)
        : [...current, id];
      const allowedSections = new Set(
        boardClasses
          .filter((c) => next.includes(c.classId))
          .flatMap((c) => c.sections.map((s) => s.id)),
      );
      setSectionIds((sections) => sections.filter((id) => allowedSections.has(id)));
      setSubjectNames([]);
      setSubjectDates({});
      return next;
    });
  }

  function toggleSection(id: string) {
    setSectionIds((current) =>
      current.includes(id) ? current.filter((row) => row !== id) : [...current, id],
    );
  }

  function toggleSubject(subjectName: string) {
    const gaps = subjectGaps.get(subjectName) ?? [];
    if (gaps.length) {
      toast.error(`Assign teachers first: ${gaps.join("; ")}`);
      return;
    }
    setSubjectNames((current) => {
      if (current.includes(subjectName)) {
        setSubjectDates((dates) => {
          const next = { ...dates };
          delete next[subjectName];
          return next;
        });
        return current.filter((row) => row !== subjectName);
      }
      return [...current, subjectName].sort(sortByName);
    });
  }

  function onBoardChange(nextBoardId: string) {
    setBoardId(nextBoardId);
    setClassIds([]);
    setSectionIds([]);
    setSubjectNames([]);
    setSubjectDates({});
  }

  function buildPayload() {
    if (name.trim().length < 2) throw new Error("Enter a schedule name.");
    if (!boardId) throw new Error("Select a board.");
    if (!classIds.length) throw new Error("Select at least one class.");
    if (!sectionIds.length) throw new Error("Select at least one section.");
    if (!subjectNames.length) throw new Error("Select at least one subject.");

    for (const subjectName of subjectNames) {
      if (!subjectDates[subjectName]?.trim()) {
        throw new Error(`Set a date for ${subjectName}.`);
      }
      const gaps = subjectGaps.get(subjectName) ?? [];
      if (gaps.length) {
        throw new Error(`${subjectName}: assign teachers — ${gaps.join("; ")}`);
      }
    }

    const rounds = Array.from({ length: Math.max(1, roundCount) }, (_, order) => {
      const subjects = subjectNames.map((subjectName) => {
        const baseDate = subjectDates[subjectName]!.trim();
        const testDate =
          order === 0 ? baseDate : addWorkingDaysYmd(baseDate, order * 7);

        const classAssignments = selectedClasses
          .map((classItem) => {
            const subject = classItem.subjects.find((s) => s.subjectName === subjectName);
            if (!subject) return null;
            const sections = classItem.sections.filter((s) => sectionIdSet.has(s.id));
            if (!sections.length) return null;
            return {
              classId: classItem.classId,
              subjectId: subject.subjectId,
              sectionAssignments: sections.map((section) => {
                const teacherId =
                  subject.teachersBySectionId[section.id]?.[0]?.id ?? "";
                if (!teacherId) {
                  throw new Error(
                    `No teacher for ${subjectName} · ${classItem.className} · ${section.name}`,
                  );
                }
                return { sectionId: section.id, teacherId };
              }),
            };
          })
          .filter(Boolean) as Array<{
          classId: string;
          subjectId: string;
          sectionAssignments: Array<{ sectionId: string; teacherId: string }>;
        }>;

        if (!classAssignments.length) {
          throw new Error(`${subjectName}: no class/section mapping.`);
        }

        return {
          subjectName,
          testDate,
          classAssignments,
        };
      });

      return {
        name: `Round ${order + 1}`,
        order,
        subjects,
      };
    });

    return { name: name.trim(), rounds };
  }

  function onSubmit() {
    try {
      const payload = buildPayload();
      startTransition(async () => {
        const result = await createTestSchedule(payload);
        if (!result.ok) {
          toast.error(result.error);
          return;
        }
        toast.success("Schedule created.");
        router.push(`/org-admin/schedules/${result.scheduleId}`);
        router.refresh();
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create schedule.");
    }
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-5">
      <div className="rounded-[1.25rem] border border-line bg-card p-5 sm:p-6">
        <h3 className="font-display text-lg font-semibold text-ink">Create schedule</h3>
        <p className="mt-1 text-sm text-muted">
          Name, classes, subjects, dates — teachers auto-assign. No email on create.
        </p>

        <div className="mt-6 space-y-5">
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted">
              Schedule name *
            </span>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Mid Term / Round tests"
              className="h-11"
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted">
              Board *
            </span>
            <SearchSelect
              value={boardId}
              options={catalog.map((row) => ({
                value: row.boardId,
                label: row.boardName,
              }))}
              onChange={onBoardChange}
              placeholder="Select board"
              searchPlaceholder="Search board…"
              ariaLabel="Board"
              className="h-11 w-full"
            />
          </label>

          {board ? (
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
                Classes *
              </p>
              <div className="flex flex-wrap gap-2">
                {boardClasses.map((klass) => {
                  const on = classIds.includes(klass.classId);
                  return (
                    <button
                      key={klass.classId}
                      type="button"
                      onClick={() => toggleClass(klass.classId)}
                      className={
                        on
                          ? "rounded-xl border border-brand/45 bg-brand/10 px-3 py-2 text-sm font-semibold text-brand"
                          : "rounded-xl border border-line bg-mist/30 px-3 py-2 text-sm font-medium text-ink-soft"
                      }
                    >
                      {klass.className}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}

          {selectedClasses.length ? (
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
                Sections *
              </p>
              <div className="space-y-3">
                {selectedClasses.map((klass) => (
                  <div key={klass.classId}>
                    <p className="mb-1.5 text-sm font-semibold text-ink">{klass.className}</p>
                    <div className="flex flex-wrap gap-2">
                      {klass.sections.map((section) => {
                        const on = sectionIds.includes(section.id);
                        return (
                          <button
                            key={section.id}
                            type="button"
                            onClick={() => toggleSection(section.id)}
                            className={
                              on
                                ? "rounded-xl border border-brand/45 bg-brand/10 px-3 py-2 text-sm font-semibold text-brand"
                                : "rounded-xl border border-line bg-mist/30 px-3 py-2 text-sm font-medium text-ink-soft"
                            }
                          >
                            {section.name}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {sectionIds.length ? (
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
                Subjects *
              </p>
              <div className="flex flex-wrap gap-2">
                {availableSubjects.map((subjectName) => {
                  const on = subjectNames.includes(subjectName);
                  const gaps = subjectGaps.get(subjectName) ?? [];
                  const blocked = gaps.length > 0;
                  return (
                    <button
                      key={subjectName}
                      type="button"
                      onClick={() => toggleSubject(subjectName)}
                      title={blocked ? `No teacher: ${gaps.join("; ")}` : undefined}
                      className={
                        blocked
                          ? "rounded-xl border border-line bg-mist/20 px-3 py-2 text-sm text-muted line-through"
                          : on
                            ? "rounded-xl border border-brand/45 bg-brand/10 px-3 py-2 text-sm font-semibold text-brand"
                            : "rounded-xl border border-line bg-mist/30 px-3 py-2 text-sm font-medium text-ink-soft"
                      }
                    >
                      {subjectName}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}

          {subjectNames.length ? (
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                Subject dates (Round 1) *
              </p>
              {subjectNames.map((subjectName) => (
                <label key={subjectName} className="flex flex-wrap items-center gap-3">
                  <span className="min-w-[8rem] text-sm font-semibold text-ink">
                    {subjectName}
                  </span>
                  <Input
                    type="date"
                    value={subjectDates[subjectName] ?? ""}
                    onChange={(e) =>
                      setSubjectDates((current) => ({
                        ...current,
                        [subjectName]: e.target.value,
                      }))
                    }
                    className="h-11 max-w-[12rem]"
                  />
                </label>
              ))}
            </div>
          ) : null}

          <label className="block max-w-[12rem]">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted">
              Rounds
            </span>
            <Input
              type="number"
              min={1}
              max={8}
              value={roundCount}
              onChange={(e) =>
                setRoundCount(Math.min(8, Math.max(1, Number(e.target.value) || 1)))
              }
              className="h-11"
            />
            <span className="mt-1 block text-xs text-muted">
              Round 2+ dates = +7 working days each (Sundays skipped).
            </span>
          </label>

          <Button type="button" onClick={onSubmit} disabled={pending} className="w-full sm:w-auto">
            {pending ? "Creating…" : "Create schedule"}
          </Button>
        </div>
      </div>
    </div>
  );
}
