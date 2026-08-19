"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/toast";
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

  function submit(formData: FormData) {
    startTransition(async () => {
      const result = await addSeriesRound(formData);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Next round added successfully.");
      router.push(`/org-admin/results/sections/${sectionId}/exams/${result.id}`);
      router.refresh();
    });
  }

  return (
    <form action={submit} className="flex flex-wrap items-end gap-3">
      <input type="hidden" name="sectionId" value={sectionId} />
      <input type="hidden" name="seriesId" value={seriesId} />
      <label className="block">
        <span className="mb-1 block text-sm font-semibold text-ink">Round date (optional)</span>
        <Input name="examDate" type="date" />
      </label>
      <Button type="submit" disabled={pending}>
        {pending ? "Adding…" : "Add next round"}
      </Button>
    </form>
  );
}
