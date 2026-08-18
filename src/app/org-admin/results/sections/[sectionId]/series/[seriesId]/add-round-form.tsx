"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { addSeriesRound } from "../../../../actions";

export function AddRoundForm({
  sectionId,
  seriesId,
}: {
  sectionId: string;
  seriesId: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function submit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await addSeriesRound(formData);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.push(`/org-admin/results/sections/${sectionId}/exams/${result.id}`);
      router.refresh();
    });
  }

  return (
    <form action={submit} className="flex flex-wrap items-end gap-3">
      <input type="hidden" name="sectionId" value={sectionId} />
      <input type="hidden" name="seriesId" value={seriesId} />
      <label className="block">
        <span className="mb-1 block text-xs font-semibold text-ink">Round date (optional)</span>
        <Input name="examDate" type="date" />
      </label>
      {error ? <p className="w-full text-sm font-medium text-red-700">{error}</p> : null}
      <Button type="submit" disabled={pending}>
        {pending ? "Adding…" : "Add next round"}
      </Button>
    </form>
  );
}
