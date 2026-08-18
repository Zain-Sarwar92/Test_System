"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  deleteAssessmentSheet,
  readMarksFromSheet,
  saveStudentMarks,
  updateAssessmentTotal,
  uploadAssessmentSheet,
} from "@/app/org-admin/results/actions";
import { normalizeRollNumber } from "@/lib/roll-match";

type StudentRow = {
  id: string;
  rollNumber: string;
  name: string;
  fatherName: string;
  obtained: string;
  absent: boolean;
};

type Sheet = {
  id: string;
  imagePath: string;
  originalName: string | null;
};

export function MarksEntry({
  assessmentId,
  totalMarks: initialTotal,
  students: initialStudents,
  sheets,
}: {
  assessmentId: string;
  totalMarks: string;
  students: StudentRow[];
  sheets: Sheet[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [totalMarks, setTotalMarks] = useState(initialTotal);
  const [rows, setRows] = useState(initialStudents);
  const [selectedSheet, setSelectedSheet] = useState(sheets[0]?.id ?? "");

  // Newly uploaded sheets arrive via props, so fall back instead of stale state.
  const activeSheet =
    sheets.find((sheet) => sheet.id === selectedSheet) ?? sheets[0] ?? null;

  const entered = useMemo(
    () => rows.filter((row) => row.absent || row.obtained.trim()).length,
    [rows],
  );

  function updateRow(id: string, patch: Partial<StudentRow>) {
    setRows((current) =>
      current.map((row) => (row.id === id ? { ...row, ...patch } : row)),
    );
  }

  function saveMarks() {
    setError(null);
    setMessage(null);
    const data = new FormData();
    data.set("assessmentId", assessmentId);
    data.set(
      "marks",
      JSON.stringify(
        rows.map((row) => ({
          studentId: row.id,
          obtained: row.obtained,
          absent: row.absent,
        })),
      ),
    );
    startTransition(async () => {
      const result = await saveStudentMarks(data);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setMessage(`Saved ${entered} of ${rows.length} students.`);
      router.refresh();
    });
  }

  function saveTotal(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await updateAssessmentTotal(formData);
      if (!result.ok) setError(result.error);
    });
  }

  function uploadSheet(formData: FormData) {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const result = await uploadAssessmentSheet(formData);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setSelectedSheet(result.sheetId);
      router.refresh();
      await applySheetMarks(result.sheetId);
    });
  }

  /** Reads the photo and drops the marks into the table for review. */
  async function applySheetMarks(sheetId: string) {
    const result = await readMarksFromSheet({
      sheetId,
      rollNumbers: rows.map((row) => row.rollNumber),
    });
    if (!result.ok) {
      setError(result.error);
      return;
    }

    const byRoll = new Map(
      result.rows.map((row) => [normalizeRollNumber(row.rollNumber), row]),
    );
    let filled = 0;
    let absent = 0;
    for (const row of rows) {
      const match = byRoll.get(normalizeRollNumber(row.rollNumber));
      if (!match) continue;
      if (match.absent) absent += 1;
      else if (match.obtainedMarks !== null) filled += 1;
    }

    setRows((current) =>
      current.map((row) => {
        const match = byRoll.get(normalizeRollNumber(row.rollNumber));
        if (!match) return row;
        if (match.absent) return { ...row, obtained: "", absent: true };
        if (match.obtainedMarks === null) return row;
        return { ...row, obtained: String(match.obtainedMarks), absent: false };
      }),
    );

    const unread = rows.length - filled - absent;
    setMessage(
      `Read ${filled} mark${filled === 1 ? "" : "s"}${absent ? ` and ${absent} absent` : ""} from the photo. ` +
        `${unread > 0 ? `${unread} row${unread === 1 ? "" : "s"} could not be read — fill those by hand. ` : ""}` +
        "Check every value, then press Save marks.",
    );

    if (
      result.sheetTotalMarks !== null &&
      result.sheetTotalMarks !== result.totalMarks
    ) {
      setError(
        `This sheet is printed out of ${result.sheetTotalMarks} marks, but this paper is set to ${result.totalMarks}. ` +
          `Set total marks to ${result.sheetTotalMarks} and save it, otherwise percentages will be wrong.`,
      );
    }
  }

  function readMarks() {
    if (!activeSheet) return;
    setError(null);
    setMessage(null);
    const sheetId = activeSheet.id;
    startTransition(async () => {
      await applySheetMarks(sheetId);
    });
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <div className="rounded-[1.1rem] border border-[rgba(15,40,70,0.08)] bg-white p-4">
          <p className="font-semibold text-ink">1. Upload filled sheet photo</p>
          <p className="mt-1 text-sm text-muted">
            Photograph the printed award list after marks are written. The marks are read
            from the photo automatically — verify them below before saving.
          </p>
          <form action={uploadSheet} className="mt-3 flex flex-wrap items-end gap-2">
            <input type="hidden" name="assessmentId" value={assessmentId} />
            <label className="min-w-[14rem] flex-1">
              <span className="mb-1 block text-xs font-semibold text-ink">Sheet image</span>
              <Input name="sheet" type="file" accept="image/jpeg,image/png,image/webp" required />
            </label>
            <Button type="submit" variant="secondary" disabled={pending}>
              {pending ? "Reading…" : "Upload and read marks"}
            </Button>
          </form>
          {sheets.length ? (
            <div className="mt-4 space-y-2">
              <div className="flex flex-wrap gap-2">
                {sheets.map((sheet) => (
                  <button
                    key={sheet.id}
                    type="button"
                    onClick={() => setSelectedSheet(sheet.id)}
                    className={`rounded-lg border px-2 py-1 text-xs font-semibold ${
                      activeSheet?.id === sheet.id
                        ? "border-brand text-brand"
                        : "border-[rgba(15,40,70,0.12)] text-ink-soft"
                    }`}
                  >
                    {sheet.originalName || "Sheet"}
                  </button>
                ))}
              </div>
              {activeSheet ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={activeSheet.imagePath}
                    alt="Uploaded marks sheet"
                    className="max-h-[28rem] w-full rounded-xl border border-[rgba(15,40,70,0.08)] object-contain bg-[#f7fafc]"
                  />
                  <div className="flex flex-wrap items-center gap-2">
                    <Button type="button" onClick={readMarks} disabled={pending}>
                      {pending ? "Reading…" : "Read marks again"}
                    </Button>
                    <span className="text-xs text-muted">
                      Fills the table below — always check the numbers before saving.
                    </span>
                  </div>
                </>
              ) : null}
              {sheets.map((sheet) => (
                <form key={`del-${sheet.id}`} action={deleteAssessmentSheet} className="inline-block">
                  <input type="hidden" name="id" value={sheet.id} />
                  <Button type="submit" size="sm" variant="ghost">
                    Remove {sheet.originalName || "photo"}
                  </Button>
                </form>
              ))}
            </div>
          ) : (
            <p className="mt-3 text-sm text-muted">No sheet uploaded yet.</p>
          )}
        </div>

        <div className="rounded-[1.1rem] border border-[rgba(15,40,70,0.08)] bg-white p-4">
          <p className="font-semibold text-ink">2. Check and save marks</p>
          <p className="mt-1 text-sm text-muted">
            {entered} of {rows.length} students have marks. Edit anything the photo read
            wrong, leave blank until entered, or mark absent.
          </p>
          <form action={saveTotal} className="mt-3 flex flex-wrap items-end gap-2">
            <input type="hidden" name="assessmentId" value={assessmentId} />
            <label>
              <span className="mb-1 block text-xs font-semibold text-ink">Total marks</span>
              <Input
                name="totalMarks"
                type="number"
                min={1}
                max={1000}
                value={totalMarks}
                onChange={(event) => setTotalMarks(event.target.value)}
                className="w-28"
              />
            </label>
            <Button type="submit" variant="outline" disabled={pending}>
              Save total
            </Button>
          </form>
        </div>
      </div>

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {error}
        </div>
      ) : null}
      {message ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
          {message}
        </div>
      ) : null}

      <div className="overflow-x-auto rounded-[1.1rem] border border-[rgba(15,40,70,0.08)] bg-white">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-mist/50 text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-3 py-2">Roll</th>
              <th className="px-3 py-2">Student</th>
              <th className="px-3 py-2">Father</th>
              <th className="px-3 py-2">Obt. marks</th>
              <th className="px-3 py-2">Total</th>
              <th className="px-3 py-2">Absent</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-t border-[rgba(15,40,70,0.06)]">
                <td className="px-3 py-2 font-semibold">{row.rollNumber}</td>
                <td className="px-3 py-2">{row.name}</td>
                <td className="px-3 py-2 text-muted">{row.fatherName}</td>
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
