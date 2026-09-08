"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { MultiSearchSelect } from "@/components/ui/multi-search-select";
import { addExamSectionSubjects } from "./actions";
import { toast } from "@/components/ui/toast";

type SubjectOption = {
  id: string;
  name: string;
  track: "COMMON" | "SCIENCE" | "ARTS";
  electiveGroup: string | null;
};

function hintFor(subject: SubjectOption) {
  if (subject.electiveGroup === "ARTS_ELECTIVE") return "Arts elective";
  if (subject.electiveGroup) return "Elective";
  if (subject.track === "ARTS") return "Arts";
  if (subject.track === "SCIENCE") return "Science";
  return "Common";
}

export function AddExamSubjectForm({
  sectionId,
  examId,
  availableSubjects,
}: {
  sectionId: string;
  examId: string;
  availableSubjects: SubjectOption[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [open, setOpen] = useState(false);

  const options = useMemo(
    () =>
      availableSubjects.map((subject) => ({
        value: subject.id,
        label: subject.name,
        hint: hintFor(subject),
      })),
    [availableSubjects],
  );

  if (availableSubjects.length === 0) {
    return (
      <p className="text-sm text-muted">
        All class subjects are already on this result.
      </p>
    );
  }

  function submit() {
    if (selectedIds.length === 0) {
      toast.error("Select at least one subject to add.");
      return;
    }
    const formData = new FormData();
    formData.set("sectionId", sectionId);
    formData.set("examTermId", examId);
    for (const id of selectedIds) {
      formData.append("subjectIds", id);
    }
    startTransition(async () => {
      const result = await addExamSectionSubjects(formData);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(
        selectedIds.length === 1
          ? "Subject added to this result."
          : `${selectedIds.length} subjects added to this result.`,
      );
      setSelectedIds([]);
      setOpen(false);
      router.refresh();
    });
  }

  if (!open) {
    return (
      <Button type="button" variant="outline" onClick={() => setOpen(true)}>
        Add subject
      </Button>
    );
  }

  return (
    <div className="space-y-3 rounded-[1.15rem] border border-line bg-mist/35 p-4 shadow-[var(--shadow-soft)]">
      <div>
        <p className="text-sm font-semibold text-ink">Add subject</p>
        <p className="mt-0.5 text-xs text-muted">
          Pick any remaining class subject (including Arts).
        </p>
      </div>
      <MultiSearchSelect
        values={selectedIds}
        options={options}
        onChange={setSelectedIds}
        placeholder="Search & select subjects"
        searchPlaceholder="Search subjects…"
        ariaLabel="Subjects to add"
        className="h-11 w-full"
      />
      <div className="flex flex-wrap gap-2">
        <Button type="button" disabled={pending} onClick={submit}>
          {pending ? "Adding…" : "Add selected"}
        </Button>
        <Button
          type="button"
          variant="secondary"
          disabled={pending}
          onClick={() => {
            setOpen(false);
            setSelectedIds([]);
          }}
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}
