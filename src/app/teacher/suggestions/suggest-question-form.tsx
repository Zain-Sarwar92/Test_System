"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { toast } from "@/components/ui/toast";
import {
  QuestionFormFields,
  type QuestionFormBoard,
} from "@/components/question-form-fields";
import { submitSuggestion } from "./actions";

export function SuggestQuestionForm({
  boards,
}: {
  boards: QuestionFormBoard[];
}) {
  const [pending, startTransition] = useTransition();
  const [formKey, setFormKey] = useState(0);

  function onSubmit(formData: FormData) {
    startTransition(async () => {
      try {
        await submitSuggestion(formData);
        toast.success("Question submitted for Super Admin review.");
        setFormKey((current) => current + 1);
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : "Failed to submit the question suggestion.",
        );
      }
    });
  }

  return (
    <Card className="fade-up">
      <CardTitle>New suggestion</CardTitle>
      <CardDescription>
        You cannot edit the bank directly — suggestions stay pending until
        approved.
      </CardDescription>

      {boards.length === 0 ? (
        <p className="mt-5 rounded-xl bg-mist px-4 py-3 text-sm text-muted">
          No curriculum topics are available yet.
        </p>
      ) : (
        <form
          key={formKey}
          action={onSubmit}
          className="mt-6 space-y-5 text-left"
        >
          <QuestionFormFields boards={boards} includeUrdu />
          <Button type="submit" size="lg" disabled={pending}>
            {pending ? "Submitting..." : "Submit for review"}
          </Button>
        </form>
      )}
    </Card>
  );
}
