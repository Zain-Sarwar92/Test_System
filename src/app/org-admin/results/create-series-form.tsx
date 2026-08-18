"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createResultSeries } from "./actions";
import { academicSession } from "@/lib/results";

export function CreateSeriesForm({ sectionId }: { sectionId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function submit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await createResultSeries(formData);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.push(`/org-admin/results/sections/${sectionId}/series/${result.id}`);
      router.refresh();
    });
  }

  return (
    <form action={submit} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <input type="hidden" name="sectionId" value={sectionId} />
      <label className="block">
        <span className="mb-1 block text-xs font-semibold text-ink">Series name</span>
        <Input name="name" required placeholder="Regular Tests" maxLength={80} />
      </label>
      <label className="block">
        <span className="mb-1 block text-xs font-semibold text-ink">Session</span>
        <Input name="session" defaultValue={academicSession()} required />
      </label>
      <label className="block">
        <span className="mb-1 block text-xs font-semibold text-ink">Pass %</span>
        <Input name="passPercent" type="number" min={1} max={100} defaultValue={33} />
      </label>
      {error ? (
        <p className="sm:col-span-2 lg:col-span-4 text-sm font-medium text-red-700">{error}</p>
      ) : null}
      <div className="sm:col-span-2 lg:col-span-4">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Create / open series"}
        </Button>
      </div>
    </form>
  );
}
