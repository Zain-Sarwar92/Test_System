"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/toast";
import { createExamTerm } from "./actions";
import { academicSession } from "@/lib/results";

export function CreateExamForm({ sectionId }: { sectionId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function submit(formData: FormData) {
    const name = String(formData.get("name") ?? "").trim();
    const session = String(formData.get("session") ?? "").trim();

    if (name.length < 2) {
      toast.error("Enter an exam name (at least 2 characters).");
      return;
    }
    if (session.length < 4) {
      toast.error("Enter the academic session, for example 2025-26.");
      return;
    }

    formData.set("passPercent", "33");

    startTransition(async () => {
      const result = await createExamTerm(formData);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Exam saved successfully.");
      router.push(
        `/org-admin/results/sections/${sectionId}/exams/${result.id}`,
      );
      router.refresh();
    });
  }

  return (
    <form action={submit} className="grid gap-3 sm:grid-cols-2">
      <input type="hidden" name="sectionId" value={sectionId} />
      <label className="block">
        <span className="mb-1 block text-sm font-semibold text-ink">
          Exam name
        </span>
        <Input
          name="name"
          required
          placeholder="e.g. March Test"
          maxLength={80}
        />
      </label>
      <label className="block">
        <span className="mb-1 block text-sm font-semibold text-ink">
          Session
        </span>
        <Input name="session" defaultValue={academicSession()} required />
      </label>
      <div className="sm:col-span-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Create / open exam"}
        </Button>
      </div>
    </form>
  );
}
