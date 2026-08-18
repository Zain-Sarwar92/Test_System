"use client";

import Link from "next/link";
import { Fragment, useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { shortClassLabel } from "@/lib/test-schedule-sections";

export type SchedulePrintClassCell = {
  teachers: Array<{
    name: string;
    sectionName: string;
    status: string;
    syllabusText: string | null;
  }>;
};

export type SchedulePrintRow = {
  id: string;
  dateLabel: string;
  returnLabel: string;
  subjectName: string;
  byClass: Record<string, SchedulePrintClassCell>;
};

export type SchedulePrintSectionColumn = {
  key: string;
  className: string;
  sectionName: string;
  label: string;
};

type FieldKey =
  | "date"
  | "returnDate"
  | "subject"
  | "teachers"
  | "status"
  | "syllabus";

export type PreviewBlock =
  | { key: string; kind: "round"; title: string }
  | { key: string; kind: "data"; rowId: string };

type RenderItem =
  | {
      kind: "round";
      block: { key: string; kind: "round"; title: string };
      index: number;
    }
  | {
      kind: "group";
      key: string;
      dateLabel: string;
      returnLabel: string;
      entries: Array<{ key: string; row: SchedulePrintRow }>;
      index: number;
    };

const FIELD_OPTIONS: Array<{ key: FieldKey; label: string }> = [
  { key: "date", label: "Date" },
  { key: "returnDate", label: "Returning date" },
  { key: "subject", label: "Subject" },
  { key: "teachers", label: "Class teachers" },
  { key: "syllabus", label: "Section syllabus columns" },
  { key: "status", label: "Status" },
];

function newKey() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function findSectionEntry(
  row: SchedulePrintRow,
  className: string,
  sectionName: string,
) {
  const teachers = row.byClass[className]?.teachers ?? [];
  return (
    teachers.find(
      (t) => t.sectionName.toLowerCase() === sectionName.toLowerCase(),
    ) ?? null
  );
}

export function SchedulePrintView({
  scheduleId,
  scheduleName,
  organizationName,
  classColumns,
  sectionColumns,
  rows,
  initialBlocks,
}: {
  scheduleId: string;
  scheduleName: string;
  organizationName: string;
  classColumns: string[];
  sectionColumns: SchedulePrintSectionColumn[];
  rows: SchedulePrintRow[];
  initialBlocks?: PreviewBlock[];
}) {
  const rowById = useMemo(() => new Map(rows.map((r) => [r.id, r])), [rows]);

  const [fields, setFields] = useState<Record<FieldKey, boolean>>({
    date: true,
    returnDate: true,
    subject: true,
    teachers: true,
    syllabus: true,
    status: false,
  });

  const [blocks, setBlocks] = useState<PreviewBlock[]>(
    () =>
      initialBlocks ??
      rows.map((row) => ({
        key: `data-${row.id}`,
        kind: "data" as const,
        rowId: row.id,
      })),
  );

  const selectedCount = useMemo(
    () => FIELD_OPTIONS.filter((f) => fields[f.key]).length,
    [fields],
  );

  const colSpan = useMemo(() => {
    let n = 0;
    if (fields.date) n += 1;
    if (fields.returnDate) n += 1;
    if (fields.subject) n += 1;
    if (fields.teachers) n += classColumns.length;
    if (fields.syllabus) n += sectionColumns.length;
    return Math.max(n, 1);
  }, [fields, classColumns, sectionColumns]);

  function toggle(key: FieldKey) {
    setFields((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      if (!Object.values(next).some(Boolean)) return prev;
      return next;
    });
  }

  function insertRoundAt(index: number) {
    setBlocks((prev) => {
      const next = [...prev];
      next.splice(index, 0, {
        key: `round-${newKey()}`,
        kind: "round",
        title: "Round 1",
      });
      return next;
    });
  }

  function insertRoundAtTop() {
    setBlocks((prev) => {
      const next = [...prev];
      const firstDataIndex = next.findIndex((b) => b.kind === "data");
      const at = firstDataIndex === -1 ? next.length : firstDataIndex;
      next.splice(at, 0, {
        key: `round-${newKey()}`,
        kind: "round",
        title: "Round 1",
      });
      return next;
    });
  }

  function updateRoundTitle(key: string, title: string) {
    setBlocks((prev) =>
      prev.map((block) =>
        block.kind === "round" && block.key === key
          ? { ...block, title }
          : block,
      ),
    );
  }

  function removeRound(key: string) {
    setBlocks((prev) => prev.filter((block) => block.key !== key));
  }

  // Consecutive data rows that share a test date print under one merged date cell.
  const renderItems = useMemo(() => {
    const items: RenderItem[] = [];
    let index = 0;

    while (index < blocks.length) {
      const block = blocks[index]!;

      if (block.kind === "round") {
        items.push({ kind: "round", block, index });
        index += 1;
        continue;
      }

      const row = rowById.get(block.rowId);
      if (!row) {
        index += 1;
        continue;
      }

      const entries: Array<{ key: string; row: SchedulePrintRow }> = [
        { key: block.key, row },
      ];
      let next = index + 1;
      while (next < blocks.length) {
        const candidate = blocks[next]!;
        if (candidate.kind !== "data") break;
        const candidateRow = rowById.get(candidate.rowId);
        if (!candidateRow || candidateRow.dateLabel !== row.dateLabel) break;
        entries.push({ key: candidate.key, row: candidateRow });
        next += 1;
      }

      items.push({
        kind: "group",
        key: block.key,
        dateLabel: row.dateLabel,
        returnLabel: row.returnLabel,
        entries,
        index,
      });
      index = next;
    }

    return items;
  }, [blocks, rowById]);

  function renderRowCells(row: SchedulePrintRow) {
    return (
      <>
        {fields.subject ? (
          <td className="whitespace-nowrap border border-[rgba(15,40,70,0.12)] px-3 py-2.5 align-top font-semibold text-ink">
            {row.subjectName}
          </td>
        ) : null}
        {classColumns.map((className) => {
          if (!fields.teachers) return null;
          const cell = row.byClass[className];
          const teacherNames = [
            ...new Set(
              (cell?.teachers ?? [])
                .map((t) => t.name.trim())
                .filter(Boolean),
            ),
          ];

          return (
            <td
              key={`${row.id}-${className}-teachers`}
              className="border border-[rgba(15,40,70,0.12)] px-3 py-2.5 align-top text-ink"
            >
              {teacherNames.length > 0 ? (
                <p className="font-semibold text-ink">{teacherNames.join(", ")}</p>
              ) : (
                <span className="text-muted">—</span>
              )}
            </td>
          );
        })}
        {sectionColumns.map((sectionCol) => {
          if (!fields.syllabus) return null;
          const entry = findSectionEntry(
            row,
            sectionCol.className,
            sectionCol.sectionName,
          );
          return (
            <td
              key={`${row.id}-${sectionCol.key}-syllabus`}
              className="min-w-[7rem] border border-[rgba(15,40,70,0.12)] px-3 py-2.5 align-top text-ink"
            >
              {!entry ? (
                <span className="text-muted">—</span>
              ) : (
                <div>
                  <p className="text-[12px] leading-snug text-ink">
                    {entry.syllabusText?.trim()
                      ? entry.syllabusText.trim()
                      : "Not added"}
                  </p>
                  {fields.status ? (
                    <p className="mt-1 text-[11px] text-muted">{entry.status}</p>
                  ) : null}
                </div>
              )}
            </td>
          );
        })}
      </>
    );
  }

  return (
    <div className="print-page max-w-none">
      <div className="print-toolbar no-print">
        <div className="flex flex-wrap gap-2">
          <Link href={`/org-admin/schedules/${scheduleId}`}>
            <Button variant="outline" size="sm">
              Back to schedule
            </Button>
          </Link>
          <Link href="/org-admin/schedules">
            <Button variant="outline" size="sm">
              All schedules
            </Button>
          </Link>
        </div>
        <Button
          size="sm"
          disabled={selectedCount === 0}
          onClick={() => window.print()}
        >
          Print / Save PDF
        </Button>
      </div>

      <div className="no-print mb-4 rounded-[1.1rem] border border-[rgba(15,40,70,0.1)] bg-white p-4 shadow-[0_8px_24px_rgba(11,31,51,0.05)] sm:p-5">
        <p className="text-sm font-semibold text-ink">1. Select fields to print</p>
        <p className="mt-1 text-sm text-muted">
          Columns: Date, Returning date (4 working days after the test), Subject,
          class teachers (9 Teacher, 10 Teacher), then separate syllabus columns
          (9 Red, 9 Blue, 10 Red, …).
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {FIELD_OPTIONS.map((opt) => {
            const checked = fields[opt.key];
            return (
              <button
                key={opt.key}
                type="button"
                onClick={() => toggle(opt.key)}
                className={
                  checked
                    ? "rounded-full border border-brand bg-brand/10 px-3.5 py-2 text-sm font-semibold text-brand"
                    : "rounded-full border border-[rgba(15,40,70,0.12)] bg-white px-3.5 py-2 text-sm font-medium text-ink hover:border-brand/40"
                }
              >
                {checked ? "✓ " : ""}
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="no-print mb-5 rounded-[1.1rem] border border-[rgba(15,40,70,0.1)] bg-white p-4 shadow-[0_8px_24px_rgba(11,31,51,0.05)] sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-ink">
              2. Preview — rounds come from the schedule
            </p>
            <p className="mt-1 text-sm text-muted">
              Round headers are loaded from saved rounds. You can still add extra
              divider lines before printing if needed.
            </p>
          </div>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="gap-1.5"
            onClick={insertRoundAtTop}
          >
            <Plus className="h-3.5 w-3.5" />
            Add line at top
          </Button>
        </div>
      </div>

      <div className="schedule-print-sheet rounded-[1rem] border border-[rgba(15,40,70,0.12)] bg-white p-5 sm:p-6">
        <div className="mb-4 border-b border-[rgba(15,40,70,0.12)] pb-3">
          <p className="text-[11px] font-semibold tracking-[0.14em] text-muted uppercase">
            Test Schedule · Preview
          </p>
          <h1 className="mt-1 text-xl font-semibold text-ink">{scheduleName}</h1>
          <p className="mt-1 text-sm text-muted">{organizationName}</p>
        </div>

        {rows.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted">
            No rows to print on this schedule.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="schedule-print-table min-w-full border-collapse text-left text-sm">
              <thead>
                <tr>
                  {fields.date ? (
                    <th className="whitespace-nowrap border border-[rgba(15,40,70,0.15)] bg-[#f8fbfd] px-3 py-2.5 font-semibold text-ink">
                      Date
                    </th>
                  ) : null}
                  {fields.returnDate ? (
                    <th className="whitespace-nowrap border border-[rgba(15,40,70,0.15)] bg-[#f8fbfd] px-3 py-2.5 font-semibold text-ink">
                      Returning date
                    </th>
                  ) : null}
                  {fields.subject ? (
                    <th className="whitespace-nowrap border border-[rgba(15,40,70,0.15)] bg-[#f8fbfd] px-3 py-2.5 font-semibold text-ink">
                      Subject
                    </th>
                  ) : null}
                  {classColumns.map((className) =>
                    fields.teachers ? (
                      <th
                        key={`${className}-teachers`}
                        className="min-w-[7rem] whitespace-nowrap border border-[rgba(15,40,70,0.15)] bg-[#f8fbfd] px-3 py-2.5 font-semibold text-ink"
                      >
                        {shortClassLabel(className)} Teacher
                      </th>
                    ) : null,
                  )}
                  {sectionColumns.map((sectionCol) =>
                    fields.syllabus ? (
                      <th
                        key={`${sectionCol.key}-syllabus`}
                        className="min-w-[7rem] whitespace-nowrap border border-[rgba(15,40,70,0.15)] bg-[#f8fbfd] px-3 py-2.5 font-semibold text-ink"
                      >
                        {sectionCol.label}
                      </th>
                    ) : null,
                  )}
                </tr>
              </thead>
              <tbody>
                {renderItems.map((item) => {
                  if (item.kind === "round") {
                    const block = item.block;
                    const index = item.index;
                    return (
                      <Fragment key={block.key}>
                        <tr className="schedule-print-round-row">
                          <td
                            colSpan={colSpan}
                            className="border border-[rgba(15,40,70,0.15)] bg-[#eef6f4] px-3 py-2.5"
                          >
                            <div className="flex flex-wrap items-center gap-2">
                              <Input
                                value={block.title}
                                onChange={(e) =>
                                  updateRoundTitle(block.key, e.target.value)
                                }
                                className="no-print h-9 max-w-md border-brand/30 bg-white font-semibold"
                                placeholder="e.g. Round 1 / Mid Term"
                              />
                              <p className="print-only-round-title m-0 text-sm font-bold tracking-wide text-ink uppercase">
                                {block.title.trim() || "Untitled section"}
                              </p>
                              <button
                                type="button"
                                className="no-print inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[rgba(15,40,70,0.1)] bg-white text-[#b42318] hover:bg-red-50"
                                aria-label="Remove round line"
                                onClick={() => removeRound(block.key)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                        <tr className="no-print">
                          <td colSpan={colSpan} className="border-0 px-0 py-1">
                            <button
                              type="button"
                              onClick={() => insertRoundAt(index + 1)}
                              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold text-brand hover:bg-brand/5"
                            >
                              <Plus className="h-3 w-3" />
                              Add line below
                            </button>
                          </td>
                        </tr>
                      </Fragment>
                    );
                  }

                  return (
                    <Fragment key={item.key}>
                      {item.entries.map((entry, entryIndex) => (
                        <tr key={entry.key}>
                          {fields.date && entryIndex === 0 ? (
                            <td
                              rowSpan={item.entries.length}
                              className="whitespace-nowrap border border-[rgba(15,40,70,0.12)] px-3 py-2.5 align-top text-ink"
                            >
                              {item.dateLabel}
                            </td>
                          ) : null}
                          {fields.returnDate && entryIndex === 0 ? (
                            <td
                              rowSpan={item.entries.length}
                              className="whitespace-nowrap border border-[rgba(15,40,70,0.12)] px-3 py-2.5 align-top text-ink"
                            >
                              {item.returnLabel}
                            </td>
                          ) : null}
                          {renderRowCells(entry.row)}
                        </tr>
                      ))}
                      <tr className="no-print">
                        <td colSpan={colSpan} className="border-0 px-0 py-1">
                          <button
                            type="button"
                            onClick={() =>
                              insertRoundAt(item.index + item.entries.length)
                            }
                            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold text-brand hover:bg-brand/5"
                          >
                            <Plus className="h-3 w-3" />
                            Add line below
                          </button>
                        </td>
                      </tr>
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <p className="print-screen-hint no-print">
        Review the preview, edit round lines if needed, then Print / Save PDF. What you see on screen (selected fields and round lines) is what will print.
      </p>
    </div>
  );
}
