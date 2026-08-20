"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Camera, ImagePlus, Plus, RefreshCw, Trash2, Upload, X, ZoomIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  deleteAssessmentSheet,
  readMarksFromSheet,
  saveStudentMarks,
  uploadAssessmentSheet,
} from "@/app/org-admin/results/actions";
import { toast } from "@/components/ui/toast";
import { normalizeRollNumber, namesLikelyMatch } from "@/lib/roll-match";

type StudentRow = {
  id: string;
  isManual: boolean;
  rollNumber: string;
  name: string;
  fatherName: string;
  obtained: string;
  absent: boolean;
};

type Sheet = {
  id: string;
  originalName: string | null;
};

function dedupeSheets(list: Sheet[]) {
  const seen = new Set<string>();
  return list.filter((sheet) => {
    if (seen.has(sheet.id)) return false;
    seen.add(sheet.id);
    return true;
  });
}

export function MarksEntry({
  assessmentId,
  totalMarks: initialTotal,
  students: initialStudents,
  sheets,
  returnHref,
}: {
  assessmentId: string;
  totalMarks: string;
  students: StudentRow[];
  sheets: Sheet[];
  returnHref?: string;
}) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const rowsDirtyRef = useRef(false);
  const uploadingRef = useRef(false);
  const [pending, startTransition] = useTransition();
  const [totalMarks, setTotalMarks] = useState(initialTotal);
  const [rows, setRows] = useState(initialStudents);
  const [sheetList, setSheetList] = useState(() => dedupeSheets(sheets));
  const [selectedSheet, setSelectedSheet] = useState(sheets[0]?.id ?? "");
  const [pickedFileName, setPickedFileName] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);

  useEffect(() => {
    setTotalMarks(initialTotal);
  }, [initialTotal]);

  useEffect(() => {
    const next = dedupeSheets(sheets);
    setSheetList(next);
    setSelectedSheet((current) =>
      next.some((sheet) => sheet.id === current) ? current : (next[0]?.id ?? ""),
    );
  }, [sheets]);

  // Don't overwrite unsaved OCR/manual edits when the page refreshes.
  useEffect(() => {
    if (rowsDirtyRef.current) return;
    setRows(initialStudents);
  }, [initialStudents]);

  function markRowsDirty() {
    rowsDirtyRef.current = true;
  }

  const activeSheet =
    sheetList.find((sheet) => sheet.id === selectedSheet) ?? sheetList[0] ?? null;

  const entered = useMemo(
    () => rows.filter((row) => row.absent || row.obtained.trim()).length,
    [rows],
  );

  function updateRow(id: string, patch: Partial<StudentRow>) {
    markRowsDirty();
    setRows((current) =>
      current.map((row) => (row.id === id ? { ...row, ...patch } : row)),
    );
  }

  function addManualRow() {
    markRowsDirty();
    setRows((current) => [
      ...current,
      {
        id: `new-${crypto.randomUUID()}`,
        isManual: true,
        rollNumber: "",
        name: "",
        fatherName: "",
        obtained: "",
        absent: false,
      },
    ]);
  }

  function removeRow(id: string) {
    markRowsDirty();
    setRows((current) => current.filter((row) => row.id !== id));
  }

  function saveMarks() {
    const total = Number(totalMarks);
    if (!Number.isFinite(total) || total < 1) {
      toast.error("Set total marks to a number of 1 or more before saving.");
      return;
    }

    const studentMarks: Array<{ studentId: string; obtained: string; absent: boolean }> = [];
    const manualMarks: Array<{
      id?: string;
      rollNumber: string;
      name: string;
      fatherName: string;
      obtained: string;
      absent: boolean;
    }> = [];

    for (const row of rows) {
      if (row.isManual) {
        const roll = row.rollNumber.trim();
        const name = row.name.trim();
        const fatherName = row.fatherName.trim();
        const hasData =
          roll.length > 0 ||
          name.length > 0 ||
          fatherName.length > 0 ||
          row.absent ||
          row.obtained.trim().length > 0;
        if (!hasData) continue;
        if (!roll || !name) {
          toast.error("Each extra row needs a roll number and student name.");
          return;
        }
        manualMarks.push({
          id: row.id.startsWith("new-") ? undefined : row.id,
          rollNumber: roll,
          name,
          fatherName,
          obtained: row.obtained,
          absent: row.absent,
        });
      } else {
        studentMarks.push({
          studentId: row.id,
          obtained: row.obtained,
          absent: row.absent,
        });
      }

      if (row.absent) continue;
      const raw = row.obtained.trim();
      if (!raw) continue;
      const obtained = Number(raw);
      if (!Number.isFinite(obtained) || obtained < 0) {
        toast.error(`${row.name || row.rollNumber}: enter a valid mark of 0 or more.`);
        return;
      }
      if (obtained > total) {
        toast.error(
          `${row.name || row.rollNumber}: obtained marks cannot be higher than the total of ${total}.`,
        );
        return;
      }
    }

    const data = new FormData();
    data.set("assessmentId", assessmentId);
    data.set("totalMarks", totalMarks);
    data.set(
      "marks",
      JSON.stringify({
        studentMarks,
        manualMarks,
      }),
    );
    startTransition(async () => {
      const result = await saveStudentMarks(data);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      rowsDirtyRef.current = false;
      toast.success(`Marks saved for ${entered} of ${rows.length} students.`);
      if (returnHref) {
        router.push(returnHref);
      }
      router.refresh();
    });
  }

  /** Reads the photo and drops the marks into the table for review. */
  async function applySheetMarks(
    sheetId: string,
    sourceRows: StudentRow[] = rows,
  ) {
    const result = await readMarksFromSheet({ sheetId });
    if (!result.ok) {
      toast.error(result.error);
      return false;
    }

    if (sourceRows.length === 0) {
      toast.warning(
        "Photo saved. Add students to the table first, then upload again or enter marks manually.",
      );
      return true;
    }

    const tableRolls = new Set(
      sourceRows.map((row) => normalizeRollNumber(row.rollNumber)),
    );
    const byRoll = new Map(
      result.rows.map((row) => [normalizeRollNumber(row.rollNumber), row]),
    );

    function trustedMatch(row: StudentRow) {
      const match = byRoll.get(normalizeRollNumber(row.rollNumber));
      if (!match) return null;
      if (!namesLikelyMatch(match.studentName, row.name)) return null;
      return match;
    }

    let filled = 0;
    let absent = 0;
    for (const row of sourceRows) {
      const match = trustedMatch(row);
      if (!match) continue;
      if (match.absent) absent += 1;
      else if (match.obtainedMarks !== null) filled += 1;
    }

    markRowsDirty();
    setRows((current) =>
      current.map((row) => {
        const match = trustedMatch(row);
        if (!match) return row;
        if (match.absent) return { ...row, obtained: "", absent: true };
        if (match.obtainedMarks === null) return row;
        return { ...row, obtained: String(match.obtainedMarks), absent: false };
      }),
    );

    const readableOnPhoto = result.rows.filter(
      (row) => row.absent || row.obtainedMarks !== null,
    ).length;
    const sheetRolls = [
      ...new Set(result.rows.map((row) => normalizeRollNumber(row.rollNumber)).filter(Boolean)),
    ];
    const unmatchedSheetRolls = sheetRolls.filter((roll) => !tableRolls.has(roll));

    if (filled === 0 && absent === 0) {
      if (readableOnPhoto === 0) {
        toast.warning(
          "Photo saved, but no marks were found. Use a clearer photo of the handwritten OBT. MARKS column, or type marks manually.",
        );
      } else if (unmatchedSheetRolls.length > 0) {
        toast.warning(
          `Photo saved, but sheet rolls (${unmatchedSheetRolls.slice(0, 6).join(", ")}) don't match this list. Use Add row or the correct sheet.`,
        );
      } else {
        toast.warning(
          "Photo saved, but names or rolls did not match this list. Check the sheet or enter marks manually.",
        );
      }
      return true;
    }

    const unread = sourceRows.length - filled - absent;
    toast.success(
      `Read ${filled} mark${filled === 1 ? "" : "s"}${absent ? ` and ${absent} absent` : ""} from the photo.`,
    );
    if (unread > 0) {
      toast.warning(
        `${unread} row${unread === 1 ? "" : "s"} could not be read. Fill those by hand, then save.`,
      );
    }

    if (
      result.sheetTotalMarks !== null &&
      result.sheetTotalMarks !== Number(totalMarks)
    ) {
      setTotalMarks(String(result.sheetTotalMarks));
      toast.warning(
        `Sheet total is ${result.sheetTotalMarks}. Updated here — click Save marks to keep it.`,
      );
    }
    return true;
  }

  function uploadFromFile(file: File) {
    if (uploadingRef.current || pending) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Choose a JPG, PNG, or WebP photo of the filled marks sheet.");
      return;
    }
    const data = new FormData();
    data.set("assessmentId", assessmentId);
    data.set("sheet", file);
    setPickedFileName(file.name);
    uploadingRef.current = true;
    startTransition(async () => {
      try {
        const result = await uploadAssessmentSheet(data);
        if (!result.ok) {
          toast.error(result.error);
          return;
        }

        const newSheet = {
          id: result.sheetId,
          originalName: file.name.slice(0, 180),
        };
        setSheetList([newSheet]);
        setSelectedSheet(result.sheetId);
        setPickedFileName("");
        if (fileInputRef.current) fileInputRef.current.value = "";

        await applySheetMarks(result.sheetId);
      } finally {
        uploadingRef.current = false;
      }
    });
  }

  function onFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    uploadFromFile(file);
  }

  function onDrop(event: React.DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setDragOver(false);
    const file = event.dataTransfer.files?.[0];
    if (!file) return;
    uploadFromFile(file);
  }

  function readMarks() {
    if (!activeSheet) {
      toast.error("Upload a marks sheet photo first.");
      return;
    }
    startTransition(async () => {
      await applySheetMarks(activeSheet.id);
    });
  }

  function removeSheet(sheetId: string) {
    startTransition(async () => {
      try {
        const data = new FormData();
        data.set("id", sheetId);
        await deleteAssessmentSheet(data);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Could not remove photo.");
        return;
      }
      setSheetList((current) => current.filter((sheet) => sheet.id !== sheetId));
      if (selectedSheet === sheetId) {
        setSelectedSheet((current) => {
          const remaining = sheetList.filter((sheet) => sheet.id !== sheetId);
          return remaining[0]?.id ?? "";
        });
      }
      if (previewOpen) setPreviewOpen(false);
      router.refresh();
    });
  }

  const sheetUrl = activeSheet
    ? `/api/org-admin/result-sheets/${activeSheet.id}`
    : null;

  return (
    <div className="space-y-4">
      {previewOpen && sheetUrl ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(11,31,51,0.72)] p-4 backdrop-blur-sm"
          onClick={() => setPreviewOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label="Sheet photo preview"
        >
          <div
            className="relative max-h-[92vh] max-w-[min(920px,96vw)] overflow-hidden rounded-[1rem] bg-card shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setPreviewOpen(false)}
              className="absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-[rgba(11,31,51,0.65)] text-white"
              aria-label="Close preview"
            >
              <X className="h-4 w-4" />
            </button>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={sheetUrl}
              alt="Uploaded marks sheet full view"
              className="max-h-[92vh] w-full object-contain"
            />
          </div>
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
        <div className="rounded-[1.15rem] border border-[rgba(15,40,70,0.08)] bg-card p-4 sm:p-5">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand/10 text-brand">
              <Camera className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-ink">Upload filled sheet photo</p>
              <p className="mt-1 text-sm text-muted">
                Marks are read automatically as soon as the photo uploads.
              </p>
            </div>
            {activeSheet && sheetUrl ? (
              <button
                type="button"
                onClick={() => setPreviewOpen(true)}
                className="group relative h-20 w-16 shrink-0 overflow-hidden rounded-[0.7rem] bg-[#0b1f33] ring-2 ring-brand/25 ring-offset-2 ring-offset-white transition hover:ring-brand/50"
                title="Open full photo"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={sheetUrl}
                  alt="Sheet thumbnail"
                  className="h-full w-full object-cover object-top opacity-95 transition group-hover:opacity-80"
                />
                <span className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-0.5 bg-gradient-to-t from-[rgba(11,31,51,0.9)] to-transparent pb-1.5 pt-4 text-[9px] font-semibold tracking-wide text-white">
                  <ZoomIn className="h-2.5 w-2.5" />
                  View
                </span>
              </button>
            ) : null}
          </div>

          <label
            onDragOver={(event) => {
              event.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            className={`mt-4 flex cursor-pointer flex-col items-center justify-center rounded-[1rem] border-2 border-dashed px-4 py-6 text-center transition ${
              dragOver
                ? "border-brand bg-brand/10"
                : "border-[rgba(15,118,110,0.28)] bg-gradient-to-br from-[#f7fbfa] to-card hover:border-brand hover:bg-brand/5"
            } ${pending ? "pointer-events-none opacity-70" : ""}`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="sr-only"
              disabled={pending}
              onChange={onFileChange}
            />
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand/10 text-brand">
              {pending ? (
                <RefreshCw className="h-5 w-5 animate-spin" />
              ) : (
                <ImagePlus className="h-5 w-5" />
              )}
            </span>
            <p className="mt-2 text-sm font-semibold text-ink">
              {pending
                ? "Uploading and reading marks…"
                : pickedFileName
                  ? pickedFileName
                  : "Drop photo here, or click to browse"}
            </p>
            <p className="mt-1 text-xs text-muted">JPG, PNG, or WebP · max 8 MB</p>
            {!pending ? (
              <span className="mt-3 inline-flex items-center gap-2 rounded-[0.7rem] bg-brand px-3 py-2 text-xs font-semibold text-white">
                <Upload className="h-3.5 w-3.5" />
                Choose photo
              </span>
            ) : null}
          </label>

          {activeSheet ? (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {sheetList.length > 1 ? (
                <div className="flex flex-wrap gap-1.5">
                  {sheetList.map((sheet, index) => (
                    <button
                      key={sheet.id}
                      type="button"
                      onClick={() => setSelectedSheet(sheet.id)}
                      className={`rounded-md border px-2 py-1 text-[11px] font-semibold transition ${
                        activeSheet.id === sheet.id
                          ? "border-brand bg-brand text-white"
                          : "border-[rgba(15,40,70,0.12)] text-ink-soft hover:border-brand/30"
                      }`}
                      title={sheet.originalName || `Photo ${index + 1}`}
                    >
                      Photo {index + 1}
                    </button>
                  ))}
                </div>
              ) : (
                <span className="max-w-full truncate rounded-md bg-mist/70 px-2 py-1 text-[11px] font-medium text-ink-soft">
                  {activeSheet.originalName || "Uploaded photo"}
                </span>
              )}
              <Button type="button" size="sm" variant="outline" onClick={readMarks} disabled={pending}>
                <RefreshCw className={`h-3.5 w-3.5 ${pending ? "animate-spin" : ""}`} />
                Read again
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={pending}
                onClick={() => removeSheet(activeSheet.id)}
              >
                <Trash2 className="h-3.5 w-3.5" />
                Remove photo
              </Button>
            </div>
          ) : (
            <p className="mt-3 text-sm text-muted">
              No photo yet — upload one above, or type marks manually in the table.
            </p>
          )}
        </div>

        <div className="rounded-[1.15rem] border border-[rgba(15,40,70,0.08)] bg-card p-4 sm:p-5">
          <p className="font-semibold text-ink">Check and save marks</p>
          <p className="mt-1 text-sm text-muted">
            {entered} of {rows.length} students have marks.
          </p>
          <div className="mt-4">
            <label>
              <span className="mb-1 block text-xs font-semibold text-ink">Total marks</span>
              <Input
                type="number"
                min={1}
                max={1000}
                value={totalMarks}
                onChange={(event) => setTotalMarks(event.target.value)}
                className="w-28"
              />
            </label>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto rounded-[1.1rem] border border-[rgba(15,40,70,0.08)] bg-card">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[rgba(15,40,70,0.06)] px-3 py-2">
          
          <Button type="button" size="sm" variant="outline" onClick={addManualRow} disabled={pending}>
            <Plus className="h-3.5 w-3.5" />
            Add row
          </Button>
        </div>
        <table className="min-w-full text-left text-sm">
          <thead className="bg-mist/50 text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-3 py-2">Roll</th>
              <th className="px-3 py-2">Student</th>
              <th className="px-3 py-2">Father</th>
              <th className="px-3 py-2">Obt. marks</th>
              <th className="px-3 py-2">Total</th>
              <th className="px-3 py-2">Absent</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.id}
                className={`border-t border-[rgba(15,40,70,0.06)] ${row.isManual ? "bg-amber-500/10" : ""}`}
              >
                <td className="px-3 py-2">
                  {row.isManual ? (
                    <Input
                      value={row.rollNumber}
                      onChange={(event) => updateRow(row.id, { rollNumber: event.target.value })}
                      className="h-9 w-24"
                      placeholder="Roll"
                    />
                  ) : (
                    <span className="font-semibold">{row.rollNumber}</span>
                  )}
                </td>
                <td className="px-3 py-2">
                  {row.isManual ? (
                    <Input
                      value={row.name}
                      onChange={(event) => updateRow(row.id, { name: event.target.value })}
                      className="h-9 min-w-[9rem]"
                      placeholder="Student name"
                    />
                  ) : (
                    row.name
                  )}
                </td>
                <td className="px-3 py-2 text-muted">
                  {row.isManual ? (
                    <Input
                      value={row.fatherName}
                      onChange={(event) => updateRow(row.id, { fatherName: event.target.value })}
                      className="h-9 min-w-[9rem]"
                      placeholder="Father name"
                    />
                  ) : (
                    row.fatherName
                  )}
                </td>
                <td className="px-3 py-2">
                  <Input
                    value={row.obtained}
                    disabled={row.absent}
                    onChange={(event) => updateRow(row.id, { obtained: event.target.value })}
                    className="h-9 w-24"
                    inputMode="decimal"
                  />
                </td>
                <td className="px-3 py-2 text-muted">{totalMarks}</td>
                <td className="px-3 py-2">
                  <input
                    type="checkbox"
                    checked={row.absent}
                    onChange={(event) =>
                      updateRow(row.id, {
                        absent: event.target.checked,
                        obtained: event.target.checked ? "" : row.obtained,
                      })
                    }
                  />
                </td>
                <td className="px-3 py-2">
                  {row.isManual ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      disabled={pending}
                      onClick={() => removeRow(row.id)}
                      aria-label="Remove extra row"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Button onClick={saveMarks} disabled={pending}>
        {pending ? "Saving…" : "Save marks"}
      </Button>
    </div>
  );
}
