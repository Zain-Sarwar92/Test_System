"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { MultiSearchSelect } from "@/components/ui/multi-search-select";
import { saveExamSectionSubjects } from "../../../../../actions";
import { toast } from "@/components/ui/toast";

import {
  isDefaultResultSubjectForStream,
  type ResultSheetStream,
} from "@/lib/subject-stream";

type SubjectOption = {
  id: string;
  name: string;
  track: "COMMON" | "SCIENCE" | "ARTS";
  electiveGroup: string | null;
};

function trackLabel(track: SubjectOption["track"]) {
  if (track === "SCIENCE") return "Science";
  if (track === "ARTS") return "Arts";
  return "Common";
}

function isArtsOption(subject: SubjectOption) {
  return subject.track === "ARTS" || subject.electiveGroup === "ARTS_ELECTIVE";
}

function isScienceOption(subject: SubjectOption) {
  return subject.track === "SCIENCE" || subject.electiveGroup === "SCIENCE_ELECTIVE";
}

export function SelectExamSubjectsForm({
  sectionId,
  examId,
  examName,
  subjects,
  initialSubjectIds,
  siblingSectionCount,
  sheetStream = "SCIENCE",
  chosenElectiveIds = [],
}: {
  sectionId: string;
  examId: string;
  examName: string;
  subjects: SubjectOption[];
  initialSubjectIds: string[];
  siblingSectionCount: number;
  sheetStream?: ResultSheetStream;
  chosenElectiveIds?: string[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const electiveSet = useMemo(() => new Set(chosenElectiveIds), [chosenElectiveIds]);
  const defaultIds = useMemo(() => {
    if (initialSubjectIds.length > 0) return initialSubjectIds;
    return subjects
      .filter((subject) =>
        isDefaultResultSubjectForStream(subject, sheetStream, electiveSet),
      )
      .map((subject) => subject.id);
  }, [initialSubjectIds, subjects, sheetStream, electiveSet]);
  const [selectedIds, setSelectedIds] = useState<string[]>(defaultIds);
  const [applyToAllSections, setApplyToAllSections] = useState(false);

  const options = useMemo(
    () =>
      subjects.map((subject) => ({
        value: subject.id,
        label: subject.name,
        hint: subject.electiveGroup
          ? subject.electiveGroup === "ARTS_ELECTIVE"
            ? "Arts elective"
            : "Elective"
          : trackLabel(subject.track),
      })),
    [subjects],
  );

  const artsCount = subjects.filter(isArtsOption).length;
  const scienceCount = subjects.filter(isScienceOption).length;

  function selectSheetDefaults() {
    setSelectedIds(
      subjects
        .filter((subject) =>
          isDefaultResultSubjectForStream(subject, sheetStream, electiveSet),
        )
        .map((s) => s.id),
    );
  }

  function submit() {
    if (selectedIds.length === 0) {
      toast.error("Select at least one subject.");
      return;
    }
    const formData = new FormData();
    formData.set("sectionId", sectionId);
    formData.set("examTermId", examId);
    if (applyToAllSections) formData.set("applyToAllSections", "1");
    for (const id of selectedIds) {
      formData.append("subjectIds", id);
    }
    startTransition(async () => {
      const result = await saveExamSectionSubjects(formData);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(
        applyToAllSections
          ? "Subjects saved for this section and added to other sections of the class."
          : "Exam subjects saved successfully.",
      );
      router.push(`/org-admin/results/sections/${sectionId}/exams/${examId}`);
      router.refresh();
    });
  }

  return (
    <div className="space-y-5">
      <div className="rounded-[1.15rem] border border-line bg-mist/35 p-4 shadow-[var(--shadow-soft)]">
        <p className="text-sm font-semibold text-ink">{examName}</p>
        <p className="mt-1 text-xs text-muted">
          {sheetStream === "ARTS"
            ? "This section looks Arts-heavy — defaults are common + Arts subjects (and roster electives). Science subjects stay off unless you add them."
            : "This section looks Science-heavy — defaults are Science + common subjects. Arts subjects stay off unless you add them."}
        </p>
      </div>

      <div className="block">
        <span className="mb-1.5 block text-sm font-semibold text-ink">
          Subjects <span className="text-red-500">*</span>
        </span>
        <MultiSearchSelect
          values={selectedIds}
          options={options}
          onChange={setSelectedIds}
          placeholder="Select subjects"
          searchPlaceholder="Search subjects…"
          ariaLabel="Exam subjects"
          className="h-11 w-full"
        />
        <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-muted">
          <span>
            {selectedIds.length} subject{selectedIds.length === 1 ? "" : "s"} selected
          </span>
          <button
            type="button"
            className="font-semibold text-brand underline-offset-2 hover:underline"
            onClick={selectSheetDefaults}
          >
            {sheetStream === "ARTS" ? "Arts + common" : "Science + common"}
          </button>
          {sheetStream === "SCIENCE" && artsCount > 0 ? (
            <button
              type="button"
              className="font-semibold text-brand underline-offset-2 hover:underline"
              onClick={() => setSelectedIds(subjects.map((subject) => subject.id))}
            >
              Include Arts too
            </button>
          ) : null}
          {sheetStream === "ARTS" && scienceCount > 0 ? (
            <button
              type="button"
              className="font-semibold text-brand underline-offset-2 hover:underline"
              onClick={() => setSelectedIds(subjects.map((subject) => subject.id))}
            >
              Include Science too
            </button>
          ) : null}
        </div>
      </div>

      {siblingSectionCount > 0 ? (
        <label className="flex cursor-pointer items-start gap-3 rounded-[1rem] border border-line bg-card px-4 py-3">
          <input
            type="checkbox"
            className="mt-1 h-4 w-4 accent-[var(--brand)]"
            checked={applyToAllSections}
            onChange={(event) => setApplyToAllSections(event.target.checked)}
          />
          <span>
            <span className="block text-sm font-semibold text-ink">
              Apply to all sections of this class
            </span>
            <span className="mt-0.5 block text-xs text-muted">
              Adds these subjects to the other {siblingSectionCount} section
              {siblingSectionCount === 1 ? "" : "s"} for the same exam. Existing
              marks are never removed. Avoid this when mixing Arts and Science sections.
            </span>
          </span>
        </label>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Button type="button" disabled={pending} onClick={submit}>
          {pending ? "Saving…" : "Save subjects"}
        </Button>
        <Link href={`/org-admin/results/sections/${sectionId}/exams/${examId}`}>
          <Button type="button" variant="secondary" disabled={pending}>
            Cancel
          </Button>
        </Link>
      </div>
    </div>
  );
}
