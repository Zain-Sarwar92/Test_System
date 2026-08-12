"use client";

import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

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

function CheckboxColumn({
  label,
  options,
  selected,
  onChange,
  emptyText,
  disabled,
}: {
  label: string;
  options: Array<{
    id: string;
    label: string;
    hint?: string;
  }>;
  selected: string[];
  onChange: (next: string[]) => void;
  emptyText: string;
  disabled?: boolean;
}) {
  return (
    <div className={disabled ? "opacity-60" : undefined}>
      <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted">
        {label}
      </span>
      <div className="max-h-36 space-y-0.5 overflow-y-auto rounded-xl border border-[rgba(15,40,70,0.12)] bg-white px-2 py-1.5">
        {options.length === 0 ? (
          <p className="px-1 py-2 text-xs text-muted">{emptyText}</p>
        ) : (
          options.map((option) => {
            const checked = selected.includes(option.id);
            return (
              <label
                key={option.id}
                className={`flex items-center gap-2 rounded-md px-1 py-1 text-sm ${
                  disabled
                    ? "cursor-not-allowed opacity-50"
                    : "cursor-pointer hover:bg-[#f3f7fb]"
                }`}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={disabled}
                  onChange={() => {
                    if (disabled) return;
                    onChange(toggleId(selected, option.id));
                  }}
                  className="h-3.5 w-3.5 rounded border-[rgba(15,40,70,0.25)]"
                />
                <span className="leading-snug text-ink">
                  {option.label}
                  {option.hint ? (
                    <span className="ml-1 text-[11px] text-muted">
                      ({option.hint})
                    </span>
                  ) : null}
                </span>
              </label>
            );
          })
        )}
      </div>
    </div>
  );
}

export type TakenSection = {
  sectionId: string;
  teacherName: string;
};

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
  const takenBySectionId = new Map(
    takenSections.map((item) => [item.sectionId, item.teacherName]),
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
        next.sectionIds = next.sectionIds.filter((id) => {
          const section = sections.find((s) => s.id === id);
          return section ? allowedClasses.has(section.classId) : false;
        });

        const subjectStillValid = subjects.some(
          (s) =>
            allowedClasses.has(s.classId) &&
            s.name.trim().toLowerCase() === next.subjectName.trim().toLowerCase(),
        );
        if (!subjectStillValid) {
          next.subjectName = "";
        }

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
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-base font-semibold text-ink">Teaching Assignments</h3>
          <p className="mt-1 text-sm text-muted">
            Assign any Board → Class → Section → Subject. The teacher will only see
            those books when generating papers. Remove a row (or clear all) to revoke
            access.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {allowEmpty && rows.length > 0 ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={clearAll}
            >
              Clear all
            </Button>
          ) : null}
          <Button type="button" variant="secondary" size="sm" className="gap-1.5" onClick={addRow}>
            <Plus className="h-3.5 w-3.5" />
            Add Assignment
          </Button>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-[0.9rem] border border-dashed border-[rgba(15,40,70,0.16)] bg-[#f8fbfd] px-4 py-8 text-center">
          <p className="text-sm font-semibold text-ink">No teaching permissions</p>
          <p className="mt-1 text-sm text-muted">
            This teacher cannot generate papers until you assign at least one subject.
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
        <>
          <div className="hidden grid-cols-[1fr_1fr_1fr_1fr_auto] gap-2 px-1 text-[11px] font-semibold uppercase tracking-wide text-muted lg:grid">
            <span>Board</span>
            <span>Class</span>
            <span>Section</span>
            <span>Subject</span>
            <span>Remove</span>
          </div>

          {rows.map((row, index) => {
            const selectedBoardSet = new Set(row.boardIds);
            const boardClasses = classes.filter((c) => selectedBoardSet.has(c.boardId));
            const selectedClassSet = new Set(row.classIds);
            const classSections = sections.filter((s) => selectedClassSet.has(s.classId));
            const subjectNames = [
              ...new Map(
                subjects
                  .filter((s) => selectedClassSet.has(s.classId))
                  .map((s) => [s.name.trim().toLowerCase(), s.name.trim()]),
              ).values(),
            ].sort((a, b) => a.localeCompare(b));

            const classLabelById = new Map(
              classes.map((klass) => [klass.id, klass.name]),
            );

            return (
              <div
                key={row.key}
                className="rounded-[0.9rem] border border-[rgba(15,40,70,0.08)] bg-[#f8fbfd] p-3"
              >
                <div className="grid gap-3 lg:grid-cols-[1fr_1fr_1fr_1fr_auto] lg:items-start">
                  <CheckboxColumn
                    label={`Board ${index + 1}`}
                    options={boards.map((board) => ({
                      id: board.id,
                      label: board.name,
                    }))}
                    selected={row.boardIds}
                    onChange={(boardIds) => updateRow(row.key, { boardIds })}
                    emptyText="No boards"
                  />

                  <CheckboxColumn
                    label="Class"
                    options={boardClasses.map((klass) => ({
                      id: klass.id,
                      label: klass.name,
                    }))}
                    selected={row.classIds}
                    onChange={(classIds) => updateRow(row.key, { classIds })}
                    emptyText={
                      row.boardIds.length === 0 ? "Select board first" : "No classes"
                    }
                    disabled={row.boardIds.length === 0}
                  />

                  <CheckboxColumn
                    label="Section"
                    options={classSections.map((section) => {
                      const alsoTaughtBy = takenBySectionId.get(section.id);
                      return {
                        id: section.id,
                        label: `${classLabelById.get(section.classId) ?? "Class"} → ${section.name}`,
                        hint: alsoTaughtBy ? `also with ${alsoTaughtBy}` : undefined,
                      };
                    })}
                    selected={row.sectionIds}
                    onChange={(sectionIds) => updateRow(row.key, { sectionIds })}
                    emptyText={
                      row.classIds.length === 0
                        ? "Select class first"
                        : "No sections"
                    }
                    disabled={row.classIds.length === 0}
                  />

                  <label>
                    <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted">
                      Subject
                    </span>
                    <select
                      value={row.subjectName}
                      onChange={(e) =>
                        updateRow(row.key, { subjectName: e.target.value })
                      }
                      disabled={row.classIds.length === 0}
                      className="h-10 w-full rounded-xl border border-[rgba(15,40,70,0.12)] bg-white px-3 text-sm disabled:opacity-60"
                    >
                      <option value="">Select subject</option>
                      {subjectNames.map((name) => (
                        <option key={name} value={name}>
                          {name}
                        </option>
                      ))}
                    </select>
                  </label>

                  <button
                    type="button"
                    className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[rgba(15,40,70,0.1)] bg-white text-[#b42318] hover:bg-red-50 lg:mt-6"
                    onClick={() => removeRow(row.key)}
                    aria-label="Revoke assignment"
                    title="Revoke this permission"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}
