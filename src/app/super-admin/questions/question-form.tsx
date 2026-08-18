"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { BookPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { toast } from "@/components/ui/toast";
import {
  QuestionFormFields,
  type QuestionFormBoard,
} from "@/components/question-form-fields";
import { PageHeader, PageStack } from "@/components/page-header";
import { createQuestion } from "./actions";

export function AddQuestionForm({ boards }: { boards: QuestionFormBoard[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [formKey, setFormKey] = useState(0);

  function onSubmit(formData: FormData) {
    startTransition(async () => {
      try {
        await createQuestion(formData);
        toast.success("Question published to the global bank.");
        setFormKey((current) => current + 1);
        router.refresh();
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Failed to add question.",
        );
      }
    });
  }

  if (boards.length === 0) {
    return (
      <PageStack>
        <PageHeader
          kicker="Content"
          title="Add Questions"
          description="Import curriculum data first, then add questions against topics."
        />
        <Card>
          <CardTitle>No curriculum found</CardTitle>
          <CardDescription>
            Add boards, classes, subjects, chapters, and topics before publishing
            questions.
          </CardDescription>
        </Card>
      </PageStack>
    );
  }

  return (
    <PageStack>
      <PageHeader
        kicker="Content"
        title="Add Questions"
        description="Select the topic path and publish a question. It becomes available to all teachers immediately."
      />
      <Card className="fade-up">
        <div className="flex items-start gap-3">
          <span className="stat-icon">
            <BookPlus className="h-4 w-4" />
          </span>
          <div>
            <CardTitle>New question</CardTitle>
            <CardDescription>
              Required fields are marked with <span className="req-mark">*</span>
            </CardDescription>
          </div>
        </div>

        <form
          key={formKey}
          action={onSubmit}
          className="mt-6 space-y-5 text-left"
        >
          <QuestionFormFields boards={boards} includeAdminFields />
          <Button type="submit" size="lg" disabled={pending}>
            {pending ? "Publishing..." : "Publish question"}
          </Button>
        </form>
      </Card>
    </PageStack>
  );
}
