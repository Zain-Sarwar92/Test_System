"use client";

import { useMemo, useState } from "react";
import { Layers, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";

type SectionOption = { id: string; name: string; studentCount: number };
type ExamOption = { id: string; name: string; session: string };

export function CombineSectionsForm({
  classId,
  sections,
  exams,
}: {
  classId: string;
  sections: SectionOption[];
  exams: ExamOption[];
}) {
  const canCombine = sections.length >= 2 && exams.length > 0;
  const [panelOpen, setPanelOpen] = useState(false);
  const [selectedSections, setSelectedSections] = useState<string[]>(() =>
    sections.map((s) => s.id),
  );
  const [examId, setExamId] = useState(exams[0]?.id ?? "");
  const [stream, setStream] = useState<"SCIENCE" | "ARTS">("SCIENCE");

  const selected = useMemo(
    () => sections.filter((s) => selectedSections.includes(s.id)),
    [sections, selectedSections],
  );
  const selectedStudents = selected.reduce((sum, s) => sum + s.studentCount, 0);
  const selectedExam = exams.find((e) => e.id === examId);

  function toggleSection(id: string) {
    setSelectedSections((current) =>
      current.includes(id) ? current.filter((row) => row !== id) : [...current, id],
    );
  }

  function openCombined() {
    if (selectedSections.length < 2) {
      toast.error("Select at least 2 sections to combine.");
      return;
    }
    if (!examId) {
      toast.error("Select an exam / round.");
      return;
    }
    const params = new URLSearchParams({
      sections: selectedSections.join(","),
      examId,
      stream,
    });
    const href = `/org-admin/results/classes/${classId}/combine?${params.toString()}`;
    window.open(href, "_blank", "noopener,noreferrer");
  }

  if (!canCombine) {
    return null;
  }

  if (!panelOpen) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-[1.15rem] border border-line bg-card px-4 py-3.5 md:px-5">
        <div>
          <p className="font-display text-base font-semibold text-ink">
            Combine result
          </p>
          <p className="mt-0.5 text-sm text-muted">
            Merge 2+ sections into one class-wide gazette.
          </p>
        </div>
        <Button type="button" onClick={() => setPanelOpen(true)}>
          <Layers className="h-4 w-4" />
          Combine result
        </Button>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-[1.25rem] border border-line bg-card shadow-[0_1px_0_rgba(15,23,42,0.04)]">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line bg-mist/35 px-4 py-4 md:px-5">
        <div className="flex gap-3">
          <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand/12 text-brand">
            <Layers className="h-5 w-5" />
          </span>
          <div>
            <h3 className="font-display text-lg font-semibold text-ink">
              Combine sections
            </h3>
            <p className="mt-0.5 text-sm text-muted">
              One gazette, class-wide positions. Rolls show as Section-Roll (e.g. A-901).
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <p className="rounded-full border border-line bg-card px-3 py-1 text-xs font-semibold text-ink-soft">
            {selected.length} sections · {selectedStudents} students
          </p>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setPanelOpen(false)}
            aria-label="Close combine panel"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="space-y-5 p-4 md:p-5">
        <div>
          <div className="mb-2 flex items-baseline justify-between gap-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">
              1 · Sections
            </p>
            <button
              type="button"
              className="text-xs font-semibold text-brand hover:underline"
              onClick={() =>
                setSelectedSections(
                  selectedSections.length === sections.length
                    ? []
                    : sections.map((s) => s.id),
                )
              }
            >
              {selectedSections.length === sections.length ? "Clear all" : "Select all"}
            </button>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {sections.map((section) => {
              const on = selectedSections.includes(section.id);
              return (
                <button
                  key={section.id}
                  type="button"
                  onClick={() => toggleSection(section.id)}
                  className={
                    on
                      ? "flex items-center justify-between gap-3 rounded-xl border border-brand/45 bg-brand/10 px-3.5 py-3 text-left transition"
                      : "flex items-center justify-between gap-3 rounded-xl border border-line bg-mist/25 px-3.5 py-3 text-left transition hover:border-line-strong"
                  }
                >
                  <span>
                    <span className="block text-base font-semibold text-ink">
                      Section {section.name}
                    </span>
                    <span className="mt-0.5 block text-xs text-muted">
                      {section.studentCount} student
                      {section.studentCount === 1 ? "" : "s"}
                    </span>
                  </span>
                  <span
                    className={
                      on
                        ? "flex h-5 w-5 items-center justify-center rounded-md bg-brand text-[0.65rem] font-bold text-white"
                        : "flex h-5 w-5 items-center justify-center rounded-md border border-line text-[0.65rem] text-muted"
                    }
                    aria-hidden
                  >
                    {on ? "✓" : ""}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted">
              2 · Exam / Round
            </span>
            <select
              value={examId}
              onChange={(event) => setExamId(event.target.value)}
              className="field-control h-11 w-full"
            >
              {exams.map((exam) => (
                <option key={exam.id} value={exam.id}>
                  {exam.name} · {exam.session}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted">
              3 · Stream
            </span>
            <select
              value={stream}
              onChange={(event) => setStream(event.target.value as "SCIENCE" | "ARTS")}
              className="field-control h-11 w-full"
            >
              <option value="SCIENCE">Science (Bio / Comp)</option>
              <option value="ARTS">Arts</option>
            </select>
          </label>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
          <p className="text-sm text-muted">
            {selectedExam ? (
              <>
                Opening <strong className="text-ink">{selectedExam.name}</strong> for{" "}
                <strong className="text-ink">
                  {selected.map((s) => s.name).join(" + ") || "—"}
                </strong>
              </>
            ) : (
              "Pick an exam to continue."
            )}
          </p>
          <Button type="button" onClick={openCombined} disabled={selected.length < 2}>
            Open combined gazette
          </Button>
        </div>
      </div>
    </div>
  );
}
