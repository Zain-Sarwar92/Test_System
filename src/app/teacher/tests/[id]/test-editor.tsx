"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { PageHeader, PageStack } from "@/components/page-header";
import {
  addTestQuestion,
  removeTestQuestion,
  reorderTestQuestion,
  replaceTestQuestion,
  updateTestMeta,
} from "./actions";

type TestQuestionRow = {
  id: string;
  order: number;
  marks: number;
  question: {
    id: string;
    type: string;
    text: string;
    textUrdu: string | null;
    optionA: string | null;
    optionB: string | null;
    optionC: string | null;
    optionD: string | null;
    topic: {
      id: string;
      name: string;
      chapter: { id: string; name: string };
    };
  };
};

type CandidateQuestion = {
  id: string;
  type: string;
  text: string;
  marks: number;
  topic: {
    name: string;
    chapter: { name: string };
  };
};

export function TestEditor({
  test,
  candidates,
}: {
  test: {
    id: string;
    title: string;
    instructions: string | null;
    durationMinutes: number;
    totalMarks: number;
    classSection: string | null;
    examDate: string | null;
    preparedBy: string | null;
    status: "FINAL";
    distributionMode: string;
    questions: TestQuestionRow[];
  };
  candidates: CandidateQuestion[];
}) {
  const usedIds = useMemo(
    () => new Set(test.questions.map((q) => q.question.id)),
    [test.questions],
  );
  const available = candidates.filter((q) => !usedIds.has(q.id));
  const [replaceFor, setReplaceFor] = useState<string | null>(null);
  const [addQuestionId, setAddQuestionId] = useState(available[0]?.id ?? "");

  return (
    <PageStack wide>
      <PageHeader
        kicker="Editor"
        title="Edit Test"
        description={`Replace, remove, add, or reorder questions · Mode: ${test.distributionMode}`}
        actions={
          <div className="flex flex-wrap gap-2">
            <Link href={`/teacher/tests/${test.id}`}>
              <Button variant="outline" type="button">
                Paper Preview
              </Button>
            </Link>
            <Link href={`/teacher/tests/${test.id}/print`}>
              <Button variant="outline" type="button">
                Print / PDF
              </Button>
            </Link>
          </div>
        }
      />

      <Card>
        <CardTitle>Paper settings</CardTitle>
        <form action={updateTestMeta} className="form-grid form-grid-2 mt-5">
          <input type="hidden" name="testId" value={test.id} />
          <label>
            <span className="field-label">Test name</span>
            <Input name="title" defaultValue={test.title} required />
          </label>
          <label>
            <span className="field-label">Class section</span>
            <Input
              name="classSection"
              defaultValue={test.classSection ?? ""}
              placeholder="A / Blue"
            />
          </label>
          <label>
            <span className="field-label">Exam date</span>
            <Input name="examDate" type="date" defaultValue={test.examDate ?? ""} />
          </label>
          <label>
            <span className="field-label">By</span>
            <Input name="preparedBy" defaultValue={test.preparedBy ?? ""} />
          </label>
          <label>
            <span className="field-label">Duration (minutes)</span>
            <Input
              name="durationMinutes"
              type="number"
              min={5}
              defaultValue={test.durationMinutes}
              required
            />
          </label>
          <input type="hidden" name="status" value="FINAL" />
          <div className="flex h-11 items-center rounded-[0.875rem] border border-[rgba(15,40,70,0.1)] bg-[#e8f7f4] px-3 text-sm font-medium text-brand-deep">
            Status: Final
          </div>
          <div className="flex h-11 items-center rounded-[0.875rem] border border-[rgba(15,40,70,0.1)] bg-mist/60 px-3 text-sm text-ink-soft">
            Total marks: {test.totalMarks} · Questions: {test.questions.length}
          </div>
          <textarea
            name="instructions"
            defaultValue={test.instructions ?? ""}
            className="field-area md:col-span-2"
            placeholder="Instructions"
          />
          <div className="md:col-span-2">
            <Button type="submit">Save settings</Button>
          </div>
        </form>
      </Card>

      <Card className="space-y-3">
        <CardTitle>Add question</CardTitle>
        {available.length === 0 ? (
          <CardDescription>No more unused questions in this subject.</CardDescription>
        ) : (
          <form action={addTestQuestion} className="flex flex-col gap-3 sm:flex-row">
            <input type="hidden" name="testId" value={test.id} />
            <select
              name="questionId"
              value={addQuestionId}
              onChange={(e) => setAddQuestionId(e.target.value)}
              className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
            >
              {available.map((q) => (
                <option key={q.id} value={q.id}>
                  [{q.type}] {q.topic.chapter.name} · {q.text.slice(0, 80)}
                </option>
              ))}
            </select>
            <Button type="submit">Add</Button>
          </form>
        )}
      </Card>

      <div className="space-y-3">
        {test.questions.map((item, index) => (
          <Card key={item.id} className="space-y-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-medium tracking-wide text-slate-500 uppercase">
                  Q{item.order} · {item.question.type} · {item.marks} marks
                </p>
                <CardDescription>
                  {item.question.topic.chapter.name} → {item.question.topic.name}
                </CardDescription>
              </div>
              <div className="flex flex-wrap gap-2">
                <form action={reorderTestQuestion}>
                  <input type="hidden" name="testId" value={test.id} />
                  <input type="hidden" name="testQuestionId" value={item.id} />
                  <input type="hidden" name="direction" value="up" />
                  <Button type="submit" size="sm" variant="outline" disabled={index === 0}>
                    Up
                  </Button>
                </form>
                <form action={reorderTestQuestion}>
                  <input type="hidden" name="testId" value={test.id} />
                  <input type="hidden" name="testQuestionId" value={item.id} />
                  <input type="hidden" name="direction" value="down" />
                  <Button
                    type="submit"
                    size="sm"
                    variant="outline"
                    disabled={index === test.questions.length - 1}
                  >
                    Down
                  </Button>
                </form>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() =>
                    setReplaceFor(replaceFor === item.id ? null : item.id)
                  }
                >
                  Replace
                </Button>
                <form action={removeTestQuestion}>
                  <input type="hidden" name="testId" value={test.id} />
                  <input type="hidden" name="testQuestionId" value={item.id} />
                  <Button type="submit" size="sm" variant="danger">
                    Remove
                  </Button>
                </form>
              </div>
            </div>

            <p className="text-sm text-slate-800">{item.question.text}</p>
            {item.question.textUrdu ? (
              <p className="text-sm text-slate-600" dir="rtl">
                {item.question.textUrdu}
              </p>
            ) : null}
            {item.question.type === "MCQ" ? (
              <ul className="grid gap-1 text-sm text-slate-600 md:grid-cols-2">
                <li>A. {item.question.optionA}</li>
                <li>B. {item.question.optionB}</li>
                <li>C. {item.question.optionC}</li>
                <li>D. {item.question.optionD}</li>
              </ul>
            ) : null}

            {replaceFor === item.id ? (
              <form
                action={replaceTestQuestion}
                className="flex flex-col gap-2 border-t border-slate-100 pt-3 sm:flex-row"
              >
                <input type="hidden" name="testId" value={test.id} />
                <input type="hidden" name="testQuestionId" value={item.id} />
                <select
                  name="newQuestionId"
                  className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
                  defaultValue={available[0]?.id}
                  required
                >
                  {available.map((q) => (
                    <option key={q.id} value={q.id}>
                      [{q.type}] {q.topic.chapter.name} · {q.text.slice(0, 80)}
                    </option>
                  ))}
                </select>
                <Button type="submit" size="sm">
                  Confirm replace
                </Button>
              </form>
            ) : null}
          </Card>
        ))}
      </div>
    </PageStack>
  );
}
