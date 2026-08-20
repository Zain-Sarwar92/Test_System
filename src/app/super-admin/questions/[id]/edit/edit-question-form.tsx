"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { updateQuestion } from "../../actions";

type QuestionData = {
  id: string;
  type: "MCQ" | "SHORT" | "LONG";
  text: string;
  textUrdu: string | null;
  marks: number;
  optionA: string | null;
  optionB: string | null;
  optionC: string | null;
  optionD: string | null;
  correctAnswer: string | null;
  source: string | null;
  topicId: string;
  path: string;
};

export function EditQuestionForm({ question }: { question: QuestionData }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [type, setType] = useState(question.type);

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const fd = new FormData(event.currentTarget);
    fd.set("id", question.id);
    fd.set("type", type);
    fd.set("topicId", question.topicId);

    startTransition(async () => {
      try {
        await updateQuestion(fd);
        router.push("/super-admin/questions/list");
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Update failed");
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="chart-card space-y-4 rounded-[1rem] bg-card p-4">
      <p className="text-sm text-muted">{question.path}</p>
      <label className="block">
        <span className="field-label">Type</span>
        <select
          className="mt-1 w-full rounded-xl border border-line bg-card px-3 py-2 text-sm"
          value={type}
          onChange={(e) => setType(e.target.value as typeof type)}
        >
          <option value="MCQ">MCQ</option>
          <option value="SHORT">Short</option>
          <option value="LONG">Long</option>
        </select>
      </label>
      <label className="block">
        <span className="field-label">English text</span>
        <textarea name="text" className="field-area mt-1" defaultValue={question.text} required />
      </label>
      <label className="block">
        <span className="field-label">Urdu text</span>
        <textarea name="textUrdu" className="field-area mt-1" defaultValue={question.textUrdu ?? ""} />
      </label>
      <label className="block">
        <span className="field-label">Marks</span>
        <Input name="marks" type="number" min={1} defaultValue={question.marks} className="mt-1 w-24" />
      </label>
      {type === "MCQ" ? (
        <div className="form-grid form-grid-2">
          <label>
            <span className="field-label">Option A</span>
            <Input name="optionA" defaultValue={question.optionA ?? ""} className="mt-1" />
          </label>
          <label>
            <span className="field-label">Option B</span>
            <Input name="optionB" defaultValue={question.optionB ?? ""} className="mt-1" />
          </label>
          <label>
            <span className="field-label">Option C</span>
            <Input name="optionC" defaultValue={question.optionC ?? ""} className="mt-1" />
          </label>
          <label>
            <span className="field-label">Option D</span>
            <Input name="optionD" defaultValue={question.optionD ?? ""} className="mt-1" />
          </label>
          <label className="md:col-span-2">
            <span className="field-label">Correct answer (A/B/C/D)</span>
            <Input name="correctAnswer" defaultValue={question.correctAnswer ?? ""} className="mt-1 w-24" />
          </label>
        </div>
      ) : null}
      <label className="block">
        <span className="field-label">Source</span>
        <Input name="source" defaultValue={question.source ?? ""} className="mt-1" />
      </label>
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save changes"}
        </Button>
        <Link href="/super-admin/questions/list">
          <Button type="button" variant="outline">
            Cancel
          </Button>
        </Link>
      </div>
    </form>
  );
}
