"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { deleteSectionExamResult } from "./actions";
import { ConfirmForm } from "./confirm-form";

type ExamItem = {
  id: string;
  name: string;
  session: string;
  passPercent: number;
  subjectCount: number;
};

export function ResultExamList({
  sectionId,
  sectionName,
  exams,
}: {
  sectionId: string;
  sectionName: string;
  exams: ExamItem[];
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<string[]>([]);

  function toggle(examId: string) {
    setSelected((current) =>
      current.includes(examId)
        ? current.filter((id) => id !== examId)
        : [...current, examId],
    );
  }

  function selectedExamsQuery() {
    return new URLSearchParams({ exams: selected.join(",") }).toString();
  }

  function generateCombined() {
    if (selected.length === 0) return;
    router.push(
      `/org-admin/results/sections/${sectionId}/combined?${selectedExamsQuery()}`,
    );
  }

  function openCombinedReportCards() {
    if (selected.length === 0) return;
    if (selected.length === 1) {
      router.push(
        `/org-admin/results/sections/${sectionId}/exams/${selected[0]}/report-cards`,
      );
      return;
    }
    router.push(
      `/org-admin/results/sections/${sectionId}/combined/report-cards?${selectedExamsQuery()}`,
    );
  }

  return (
    <div className="space-y-4">
      {selected.length > 0 ? (
        <div className="sticky top-3 z-10 flex flex-wrap items-center justify-between gap-3 rounded-[1rem] border border-brand/25 bg-card/95 p-4 shadow-lg backdrop-blur">
          <p className="text-sm font-semibold text-ink">
            {selected.length} exam{selected.length === 1 ? "" : "s"} selected
          </p>
          <div className="flex flex-wrap gap-2">
            {selected.length > 1 ? (
              <Button type="button" variant="secondary" onClick={generateCombined}>
                Combine result
              </Button>
            ) : null}
            <Button type="button" onClick={openCombinedReportCards}>
              {selected.length > 1 ? "Combined report cards" : "Report cards"}
            </Button>
          </div>
        </div>
      ) : null}

      <div className="list-stack">
        {exams.map((exam) => {
          const hasResult = exam.subjectCount > 0;
          const checked = selected.includes(exam.id);
          return (
            <div
              key={exam.id}
              className={`chart-card flex flex-col gap-3 rounded-[1.15rem] border bg-card px-4 py-4 shadow-[var(--shadow-soft)] sm:flex-row sm:items-center sm:justify-between ${
                checked
                  ? "border-brand/40 ring-2 ring-brand/10"
                  : "border-line"
              }`}
            >
              <div className="flex min-w-0 items-start gap-3">
                <label className="mt-1 flex cursor-pointer items-center">
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-[var(--color-brand)]"
                    disabled={!hasResult}
                    checked={checked}
                    onChange={() => toggle(exam.id)}
                    aria-label={`Select ${exam.name}`}
                  />
                </label>
                <div className="min-w-0">
                  <p className="font-display text-lg font-semibold text-ink">
                    {exam.name}
                  </p>
                  <p className="mt-1 text-sm text-muted">
                    Session {exam.session}
                    {hasResult
                      ? ` · ${exam.subjectCount} subject${exam.subjectCount === 1 ? "" : "s"} with marks`
                      : " · Enter marks to include in result"}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Link
                  href={`/org-admin/results/sections/${sectionId}/exams/${exam.id}`}
                >
                  <Button variant="secondary" size="sm">
                    Open
                  </Button>
                </Link>
                {hasResult ? (
                  <Link
                    href={`/org-admin/results/sections/${sectionId}/exams/${exam.id}/report-cards`}
                  >
                    <Button size="sm">Report cards</Button>
                  </Link>
                ) : null}
                <ConfirmForm
                  action={deleteSectionExamResult}
                  message={`Delete "${exam.name}" result for ${sectionName} only? Marks for this section will be cleared.`}
                >
                  <input type="hidden" name="sectionId" value={sectionId} />
                  <input type="hidden" name="examTermId" value={exam.id} />
                  <Button type="submit" variant="danger" size="sm">
                    Delete
                  </Button>
                </ConfirmForm>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
