"use client";

import { Check, Lock, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SearchSelect } from "@/components/ui/search-select";
import { cn } from "@/lib/utils";

export type BoardOption = {
  id: string;
  name: string;
};

export type ClassOption = {
  id: string;
  name: string;
  boardId: string;
  boardName: string;
};

export type SectionOption = {
  id: string;
  name: string;
  classId: string;
};

export type SubjectOption = {
  id: string;
  name: string;
  classId: string;
};

export type AssignmentDraft = {
  key: string;
  boardIds: string[];
  classIds: string[];
  sectionIds: string[];
  subjectName: string;
};

export function newAssignmentDraft(
  initial: Partial<AssignmentDraft> = {},
): AssignmentDraft {
  return {
    key: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    boardIds: initial.boardIds ?? [],
    classIds: initial.classIds ?? [],
    sectionIds: initial.sectionIds ?? [],
    subjectName: initial.subjectName ?? "",
  };
}

function toggleId(list: string[], id: string) {
  return list.includes(id) ? list.filter((item) => item !== id) : [...list, id];
}

function normalizeSubjectName(name: string) {
  return name.trim().toLowerCase();
}

type ChipOption = {
  id: string;
  label: string;
  lockedBy?: string;
};

function ChipPicker({
  label,
  step,
  options,
  selected,
  onChange,
  emptyText,
  disabled,
}: {
  label: string;
  step: number;
  options: ChipOption[];
  selected: string[];
  onChange: (next: string[]) => void;
  emptyText: string;
  disabled?: boolean;
}) {
  return (
    <div className={cn("pts-assign-field", disabled && "is-disabled")}>
      <div className="pts-assign-field-head">
        <span className="pts-assign-step">{step}</span>
        <span className="pts-assign-label">{label}</span>
        {selected.length > 0 ? (
          <span className="pts-assign-count">{selected.length} selected</span>
        ) : null}
      </div>

      {disabled || options.length === 0 ? (
        <p className="pts-assign-empty">{emptyText}</p>
      ) : (
        <div className="pts-assign-chiplist">
          {options.map((option) => {
            const active = selected.includes(option.id);
            const locked = Boolean(option.lockedBy);
            return (
              <button
                key={option.id}
                type="button"
                disabled={locked}
                title={
                  locked ? `Already taken by ${option.lockedBy}` : option.label
                }
                onClick={() => onChange(toggleId(selected, option.id))}
                className={cn(
                  "pts-assign-chip",
                  active && "is-active",
                  locked && "is-locked",
                )}
              >
                {active ? <Check className="h-3.5 w-3.5 shrink-0" /> : null}
                {locked ? <Lock className="h-3 w-3 shrink-0" /> : null}
                <span className="truncate">{option.label}</span>
                {locked ? (
                  <span className="pts-assign-chip-note">
                    {option.lockedBy}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** "Class 9" + "Red" → "9 Red"; "10" + "Green" → "10 Green". */
function formatSectionLabel(className: string | undefined, sectionName: string) {
  const shortClass = (className ?? "").trim().replace(/^class\s+/i, "");
  const section = sectionName.trim();
  if (!shortClass) return section || "Section";
  if (!section) return shortClass;
  return `${shortClass} ${section}`;
}

/** A section is taken only for a specific subject (same class implied by section). */
export type TakenSection = {
  sectionId: string;
  subjectName: string;
  teacherName: string;
};

function takenLookupKey(sectionId: string, subjectName: string) {
  return `${sectionId}::${normalizeSubjectName(subjectName)}`;
}

export function TeacherAssignmentsEditor({
  boards,
  classes,
  sections,
  subjects,
  takenSections = [],
  rows,
  onChange,
  allowEmpty = true,
}: {
  boards: BoardOption[];
  classes: ClassOption[];
  sections: SectionOption[];
  subjects: SubjectOption[];
  takenSections?: TakenSection[];
  rows: AssignmentDraft[];
  onChange: (rows: AssignmentDraft[]) => void;
  allowEmpty?: boolean;
}) {
  const takenBySectionSubject = new Map(
    takenSections.map((item) => [
      takenLookupKey(item.sectionId, item.subjectName),
      item.teacherName,
    ]),
  );

  function updateRow(key: string, patch: Partial<AssignmentDraft>) {
    onChange(
      rows.map((row) => {
        if (row.key !== key) return row;
        const next = { ...row, ...patch };

        if (patch.boardIds) {
          const allowedBoards = new Set(patch.boardIds);
          next.classIds = row.classIds.filter((id) => {
            const klass = classes.find((c) => c.id === id);
            return klass ? allowedBoards.has(klass.boardId) : false;
          });
        }

        const effectiveClassIds = next.classIds;
        const allowedClasses = new Set(effectiveClassIds);

        const subjectStillValid = subjects.some(
          (s) =>
            allowedClasses.has(s.classId) &&
            normalizeSubjectName(s.name) ===
              normalizeSubjectName(next.subjectName),
        );
        if (!subjectStillValid) {
          next.subjectName = "";
        }

        // Sections depend on class + subject; clear when subject changes or
        // drop sections that no longer belong / are taken for this subject.
        if (patch.subjectName !== undefined && patch.subjectName !== row.subjectName) {
          next.sectionIds = [];
        }

        const subjectKey = normalizeSubjectName(next.subjectName);
        next.sectionIds = next.sectionIds.filter((id) => {
          const section = sections.find((s) => s.id === id);
          if (!section || !allowedClasses.has(section.classId)) return false;
          if (!subjectKey) return false;
          return !takenBySectionSubject.has(takenLookupKey(id, next.subjectName));
        });

        return next;
      }),
    );
  }

  function addRow() {
    onChange([...rows, newAssignmentDraft()]);
  }

  function removeRow(key: string) {
    const next = rows.filter((row) => row.key !== key);
    if (next.length === 0) {
      onChange(allowEmpty ? [] : [newAssignmentDraft()]);
      return;
    }
    onChange(next);
  }

  function clearAll() {
    onChange(allowEmpty ? [] : [newAssignmentDraft()]);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-base font-semibold text-ink">Teaching Assignments</h3>
        </div>
        <div className="flex flex-wrap gap-2">
          {allowEmpty && rows.length > 0 ? (
            <Button type="button" variant="outline" size="sm" onClick={clearAll}>
              Clear all
            </Button>
          ) : null}
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="gap-1.5"
            onClick={addRow}
          >
            <Plus className="h-3.5 w-3.5" />
            Add Assignment
          </Button>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-[1rem] border border-dashed border-[rgba(15,40,70,0.16)] bg-mist px-4 py-10 text-center">
          <p className="text-sm font-semibold text-ink">No teaching permissions</p>
          <p className="mt-1 text-sm text-muted">
            This teacher cannot generate tests until you assign at least one subject.
          </p>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="mt-4 gap-1.5"
            onClick={addRow}
          >
            <Plus className="h-3.5 w-3.5" />
            Assign subject
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {rows.map((row, index) => {
            const selectedBoardSet = new Set(row.boardIds);
            const boardClasses = classes.filter((c) =>
              selectedBoardSet.has(c.boardId),
            );
            const selectedClassSet = new Set(row.classIds);
            const classSections = sections.filter((s) =>
              selectedClassSet.has(s.classId),
            );
            const subjectNames = [
              ...new Map(
                subjects
                  .filter((s) => selectedClassSet.has(s.classId))
                  .map((s) => [normalizeSubjectName(s.name), s.name.trim()]),
              ).values(),
            ].sort((a, b) => a.localeCompare(b));

            const classLabelById = new Map(
              classes.map((klass) => [klass.id, klass.name]),
            );
            const hasSubject = Boolean(row.subjectName.trim());

            // Sections already claimed in other rows of this form for same subject.
            const claimedInOtherRows = new Set<string>();
            for (const other of rows) {
              if (other.key === row.key) continue;
              if (
                normalizeSubjectName(other.subjectName) !==
                normalizeSubjectName(row.subjectName)
              ) {
                continue;
              }
              for (const sectionId of other.sectionIds) {
                claimedInOtherRows.add(sectionId);
              }
            }

            const summaryReady =
              row.boardIds.length > 0 &&
              row.classIds.length > 0 &&
              hasSubject &&
              row.sectionIds.length > 0;

            return (
              <div key={row.key} className="pts-assign-card">
                <div className="pts-assign-card-head">
                  <span className="pts-assign-card-title">
                    Assignment {index + 1}
                  </span>
                  {summaryReady ? (
                    <span className="pts-assign-card-summary">
                      {row.subjectName} · {row.sectionIds.length} section
                      {row.sectionIds.length === 1 ? "" : "s"}
                    </span>
                  ) : (
                    <span className="pts-assign-card-summary is-pending">
                      Incomplete
                    </span>
                  )}
                  <button
                    type="button"
                    className="pts-assign-remove"
                    onClick={() => removeRow(row.key)}
                    aria-label="Revoke assignment"
                    title="Remove this assignment"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>

                <div className="pts-assign-grid">
                  <ChipPicker
                    step={1}
                    label="Board"
                    options={boards.map((board) => ({
                      id: board.id,
                      label: board.name,
                    }))}
                    selected={row.boardIds}
                    onChange={(boardIds) => updateRow(row.key, { boardIds })}
                    emptyText="No boards available"
                  />

                  <ChipPicker
                    step={2}
                    label="Class"
                    options={boardClasses.map((klass) => ({
                      id: klass.id,
                      label: klass.name,
                    }))}
                    selected={row.classIds}
                    onChange={(classIds) => updateRow(row.key, { classIds })}
                    emptyText={
                      row.boardIds.length === 0
                        ? "Select a board first"
                        : "No classes for this board"
                    }
                    disabled={row.boardIds.length === 0}
                  />

                  <div
                    className={cn(
                      "pts-assign-field",
                      row.classIds.length === 0 && "is-disabled",
                    )}
                  >
                    <div className="pts-assign-field-head">
                      <span className="pts-assign-step">3</span>
                      <span className="pts-assign-label">Subject</span>
                    </div>
                    {row.classIds.length === 0 ? (
                      <p className="pts-assign-empty">Select a class first</p>
                    ) : (
                      <SearchSelect
                        ariaLabel="Subject"
                        value={row.subjectName}
                        placeholder="Select subject"
                        searchPlaceholder="Search subject…"
                        emptyText="No subject found"
                        onChange={(subjectName) =>
                          updateRow(row.key, { subjectName })
                        }
                        options={subjectNames.map((name) => ({
                          value: name,
                          label: name,
                        }))}
                      />
                    )}
                  </div>

                  <ChipPicker
                    step={4}
                    label="Section"
                    options={classSections.map((section) => {
                      const takenBy = takenBySectionSubject.get(
                        takenLookupKey(section.id, row.subjectName),
                      );
                      const lockedBy = takenBy
                        ? takenBy
                        : claimedInOtherRows.has(section.id)
                          ? "another row"
                          : undefined;
                      return {
                        id: section.id,
                        label: formatSectionLabel(
                          classLabelById.get(section.classId),
                          section.name,
                        ),
                        lockedBy,
                      };
                    })}
                    selected={row.sectionIds}
                    onChange={(sectionIds) => updateRow(row.key, { sectionIds })}
                    emptyText={
                      row.classIds.length === 0
                        ? "Select a class first"
                        : !hasSubject
                          ? "Select a subject first"
                          : "No sections in this class"
                    }
                    disabled={row.classIds.length === 0 || !hasSubject}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
