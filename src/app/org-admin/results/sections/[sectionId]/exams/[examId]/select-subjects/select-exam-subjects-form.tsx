"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { MultiSearchSelect } from "@/components/ui/multi-search-select";
import { saveExamSectionSubjects } from "../../../../../actions";
import { toast } from "@/components/ui/toast";

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

export function SelectExamSubjectsForm({
  sectionId,
  examId,
  examName,
  subjects,
  initialSubjectIds,
}: {
  sectionId: string;
  examId: string;
  examName: string;
  subjects: SubjectOption[];
  initialSubjectIds: string[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [selectedIds, setSelectedIds] = useState<string[]>(initialSubjectIds);

  const options = useMemo(
    () =>
      subjects.map((subject) => ({
        value: subject.id,
        label: subject.name,
        hint: subject.electiveGroup
          ? "Elective"
          : trackLabel(subject.track),
      })),
    [subjects],
  );

  function submit() {
    if (selectedIds.length === 0) {
      toast.error("Select at least one subject.");
      return;
    }
    const formData = new FormData();
    formData.set("sectionId", sectionId);
    formData.set("examTermId", examId);
    for (const id of selectedIds) {
      formData.append("subjectIds", id);
    }
    startTransition(async () => {
      const result = await saveExamSectionSubjects(formData);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Exam subjects saved successfully.");
      router.push(`/org-admin/results/sections/${sectionId}/exams/${examId}`);
      router.refresh();
    });
  }

  return (
    <div className="space-y-5">
      <div className="rounded-[1.15rem] border border-line bg-mist/35 p-4 shadow-[var(--shadow-soft)]">
        <p className="text-sm font-semibold text-ink">{examName}</p>
        <p className="mt-1 text-xs text-muted">
          Pick every subject that should appear on this exam result.
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
        <span className="mt-1.5 block text-xs text-muted">
          {selectedIds.length} subject{selectedIds.length === 1 ? "" : "s"} selected
        </span>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button type="button" disabled={pending} onClick={submit}>
          {pending ? "Saving…" : "Save subjects"}
        </Button>
        <Link href={`/org-admin/results/sections/${sectionId}`}>
          <Button type="button" variant="secondary" disabled={pending}>
            Cancel
          </Button>
        </Link>
      </div>
    </div>
  );
}
