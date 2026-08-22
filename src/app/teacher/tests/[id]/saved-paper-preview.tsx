"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageStack } from "@/components/page-header";
import {
  ExamPaperSheet,
  type ExamPaperMeta,
  type ExamPaperSection,
  type ExamQuestionPatch,
} from "@/components/exam-paper-sheet";
import { cn } from "@/lib/utils";
import { sectionTotalMarks } from "@/lib/paper-marks";
import type { PoolQuestionCard } from "@/app/teacher/generate/actions";
import { saveSavedPaper } from "./actions";
import {
  QuestionPickerModal,
  type PaperSectionForPicker,
} from "./question-picker-modal";

type PreviewSection = {
  type: "MCQ" | "SHORT" | "LONG";
  title: string;
  marksEach: number;
  attemptCount?: number;
  questions: PoolQuestionCard[];
};

type ChapterOption = {
  id: string;
  name: string;
  topics: Array<{
    id: string;
    name: string;
    countsByType: { MCQ: number; SHORT: number; LONG: number };
  }>;
};

const TYPE_SHORT: Record<PreviewSection["type"], string> = {
  MCQ: "MCQs",
  SHORT: "Short",
  LONG: "Long",
};

function toDateInputValue(iso: string | null | undefined) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function SavedPaperPreview({
  testId,
  meta,
  initialSections,
  boardName,
  className,
  subjectName,
  chapters,
}: {
  testId: string;
  meta: ExamPaperMeta;
  initialSections: PreviewSection[];
  boardName?: string | null;
  className?: string | null;
  subjectName?: string | null;
  chapters: ChapterOption[];
}) {
  const router = useRouter();
  const [sections, setSections] = useState(initialSections);
  const [paperMeta, setPaperMeta] = useState(meta);
  const [manualEditMode, setManualEditMode] = useState(false);
  const [questionsDirty, setQuestionsDirty] = useState(false);
  const [editQuestionsOpen, setEditQuestionsOpen] = useState(false);
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  // Form fields for save popup
  const [title, setTitle] = useState(meta.title);
  const [classSection, setClassSection] = useState(meta.classSection ?? "");
  const [examDate, setExamDate] = useState(toDateInputValue(meta.examDate));
  const [durationMinutes, setDurationMinutes] = useState<number | "">(
    meta.durationMinutes ?? 60,
  );
  const [paperCode, setPaperCode] = useState(meta.paperCode ?? "");
  const [examLabel, setExamLabel] = useState(meta.examLabel ?? "");
  const [syllabusNote, setSyllabusNote] = useState(meta.syllabusNote ?? "");
  const [preparedBy, setPreparedBy] = useState(meta.preparedBy ?? "");

  useEffect(() => {
    if (!questionsDirty) {
      setSections(initialSections);
    }
  }, [initialSections, questionsDirty]);

  useEffect(() => {
    setPaperMeta(meta);
    if (!saveModalOpen) {
      setTitle(meta.title);
      setClassSection(meta.classSection ?? "");
      setExamDate(toDateInputValue(meta.examDate));
      setDurationMinutes(meta.durationMinutes ?? 60);
      setPaperCode(meta.paperCode ?? "");
      setExamLabel(meta.examLabel ?? "");
      setSyllabusNote(meta.syllabusNote ?? "");
      setPreparedBy(meta.preparedBy ?? "");
    }
  }, [meta, saveModalOpen]);

  const questionCount = useMemo(
    () => sections.reduce((sum, s) => sum + s.questions.length, 0),
    [sections],
  );
  const totalMarks = useMemo(
    () =>
      sections.reduce(
        (sum, s) =>
          sum +
          sectionTotalMarks({
            questionCount: s.questions.length,
            marksEach: s.marksEach,
            attemptCount: s.attemptCount,
          }),
        0,
      ),
    [sections],
  );

  const paperSectionsForPicker: PaperSectionForPicker[] = useMemo(
    () =>
      sections.map((s) => ({
        type: s.type,
        marksEach: s.marksEach,
        questions: s.questions,
      })),
    [sections],
  );

  function updateQuestion(
    sectionType: PreviewSection["type"],
    questionId: string,
    patch: ExamQuestionPatch,
  ) {
    setQuestionsDirty(true);
    setSections((prev) =>
      prev.map((section) => {
        if (section.type !== sectionType) return section;
        return {
          ...section,
          questions: section.questions.map((q) =>
            q.id === questionId ? { ...q, ...patch } : q,
          ),
        };
      }),
    );
  }

  function openSaveModal() {
    setError(null);
    setTitle(paperMeta.title);
    setClassSection(paperMeta.classSection ?? "");
    setExamDate(toDateInputValue(paperMeta.examDate));
    setDurationMinutes(paperMeta.durationMinutes ?? 60);
    setPaperCode(paperMeta.paperCode ?? "");
    setExamLabel(paperMeta.examLabel ?? "");
    setSyllabusNote(paperMeta.syllabusNote ?? "");
    setPreparedBy(paperMeta.preparedBy ?? "");
    setSaveModalOpen(true);
  }

  function confirmSave() {
    setError(null);
    const duration =
      typeof durationMinutes === "number" ? durationMinutes : 0;
    if (!title.trim() || title.trim().length < 2) {
      setError("Test name required");
      return;
    }
    if (duration < 5) {
      setError("Duration at least 5 minutes");
      return;
    }
    if (!examDate) {
      setError("Select an exam date.");
      return;
    }

    startTransition(async () => {
      try {
        await saveSavedPaper({
          testId,
          title: title.trim(),
          classSection: classSection.trim() || undefined,
          examDate,
          durationMinutes: duration,
          paperCode: paperCode.trim() || undefined,
          examLabel: examLabel.trim() || undefined,
          syllabusNote: syllabusNote.trim() || undefined,
          preparedBy: preparedBy.trim() || undefined,
          questionOverrides: questionsDirty
            ? sections.flatMap((s) =>
                s.questions.map((q) => ({
                  questionId: q.id,
                  text: q.text,
                  textUrdu: q.textUrdu,
                  optionA: q.optionA,
                  optionB: q.optionB,
                  optionC: q.optionC,
                  optionD: q.optionD,
                })),
              )
            : undefined,
        });

        setPaperMeta((prev) => ({
          ...prev,
          title: title.trim(),
          classSection: classSection.trim() || null,
          examDate: new Date(`${examDate}T00:00:00`).toISOString(),
          durationMinutes: duration,
          paperCode: paperCode.trim() || null,
          examLabel: examLabel.trim() || null,
          syllabusNote: syllabusNote.trim() || null,
          preparedBy: preparedBy.trim() || null,
        }));
        setManualEditMode(false);
        setQuestionsDirty(false);
        setSaveModalOpen(false);
        setMessage("Test saved");
        router.push("/teacher/tests");
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Save failed");
      }
    });
  }

  const examSections: ExamPaperSection[] = sections.map((s) => ({
    type: s.type,
    title: s.title,
    marksEach: s.marksEach,
    attemptCount: s.attemptCount,
    questions: s.questions,
  }));

  return (
    <PageStack wide className="gap-4">
      <div className="pts-paper-sticky-chrome">
        <div className="responsive-toolbar">
          <div className="min-w-0">
            <p className="page-kicker">Saved test</p>
            <h2 className="page-title">Test Preview</h2>
            <div className="pts-crumb">
              {boardName ? <span>{boardName.replace(/ Board$/i, "")}</span> : null}
              {className ? (
                <>
                  <span className="pts-crumb-sep">›</span>
                  <span>{className}</span>
                </>
              ) : null}
              {subjectName ? (
                <>
                  <span className="pts-crumb-sep">›</span>
                  <span>{subjectName}</span>
                </>
              ) : null}
              <span className="pts-crumb-sep">›</span>
              <span className="pts-crumb-current">Test</span>
            </div>
          </div>
          <div className="responsive-toolbar-actions">
            <Link href="/teacher/tests">
              <Button variant="outline">Back</Button>
            </Link>
            <Button
              variant="outline"
              onClick={() => setEditQuestionsOpen(true)}
              disabled={pending || chapters.length === 0}
            >
              Edit Questions
            </Button>
            <Button
              variant={manualEditMode ? "default" : "outline"}
              onClick={() => {
                setManualEditMode((on) => !on);
                setMessage(null);
                setError(null);
              }}
              disabled={pending || questionCount === 0}
            >
              {manualEditMode ? "Exit Manual Edit" : "Manual Edit"}
            </Button>
            <Button onClick={openSaveModal} disabled={pending}>
              {pending ? "Saving…" : "Save"}
            </Button>
            <Link href={`/teacher/tests/${testId}/print`}>
              <Button variant="outline">Print / PDF</Button>
            </Link>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-[1rem] border border-[rgba(15,40,70,0.08)] bg-card px-4 py-3">
          <div className="flex flex-wrap gap-2 text-sm">
            <span className="rounded-lg bg-brand/10 px-2.5 py-1 font-semibold text-brand">
              {questionCount} questions
            </span>
            <span className="rounded-lg bg-[#eef2f6] px-2.5 py-1 font-semibold text-ink-soft">
              {totalMarks} marks
            </span>
            {sections.map((s) => (
              <span
                key={s.type}
                className="rounded-lg border border-[rgba(15,40,70,0.1)] bg-card px-2.5 py-1 font-medium"
              >
                {TYPE_SHORT[s.type]}: {s.questions.length}
              </span>
            ))}
            <span
              className={cn(
                "rounded-lg px-2.5 py-1 text-xs font-semibold",
                manualEditMode || questionsDirty
                  ? "bg-sky-50 text-sky-800"
                  : "bg-[#ecfdf5] text-brand",
              )}
            >
              {manualEditMode
                ? "Manual edit on · click Save to keep changes"
                : questionsDirty
                  ? "Unsaved text edits · click Save"
                  : "Saved test · use Save to edit date/name"}
            </span>
          </div>
        </div>
      </div>

      {error && !saveModalOpen ? (
        <p className="text-sm font-medium text-red-700">{error}</p>
      ) : null}
      {message && !error ? (
        <p className="text-sm font-medium text-brand">{message}</p>
      ) : null}

      <ExamPaperSheet
        meta={{ ...paperMeta, totalMarks }}
        sections={examSections}
        medium="BOTH"
        editable={manualEditMode}
        onQuestionChange={updateQuestion}
      />

      {editQuestionsOpen ? (
        <QuestionPickerModal
          testId={testId}
          className={className}
          subjectName={subjectName}
          chapters={chapters}
          paperSections={paperSectionsForPicker}
          onClose={() => setEditQuestionsOpen(false)}
          onAdded={() => {
            router.refresh();
          }}
        />
      ) : null}

      {saveModalOpen ? (
        <div
          className="pts-modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby="save-paper-title"
        >
          <div className="pts-modal" style={{ width: "min(560px, 100%)" }}>
            <div className="pts-modal-header">
              <div>
                <p className="text-xs font-medium text-white/80">Save test</p>
                <h3 id="save-paper-title" className="text-base font-bold">
                  Edit test details
                </h3>
              </div>
              <button
                type="button"
                className="rounded-lg bg-card/15 px-3 py-1.5 text-sm font-semibold hover:bg-card/25"
                onClick={() => setSaveModalOpen(false)}
              >
                Close
              </button>
            </div>

            <div className="nice-scroll flex-1 space-y-4 overflow-y-auto p-5">
              <label className="block text-sm font-semibold text-ink">
                Test name <span className="text-red-500">*</span>
                <Input
                  className="mt-1.5 h-11"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Biology Mid Term"
                />
              </label>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="block text-sm font-semibold text-ink">
                  Section
                  <Input
                    className="mt-1.5 h-11"
                    value={classSection}
                    onChange={(e) => setClassSection(e.target.value)}
                    placeholder="e.g. Red, A"
                    maxLength={120}
                  />
                  <span className="mt-1 block text-[11px] font-normal text-muted">
                    Same test for multiple sections? Write them here, e.g. Red, A or Red + A
                  </span>
                </label>
                <label className="block text-sm font-semibold text-ink">
                  Duration (min) <span className="text-red-500">*</span>
                  <Input
                    className="mt-1.5 h-11"
                    type="number"
                    min={5}
                    value={durationMinutes}
                    onChange={(e) =>
                      setDurationMinutes(
                        e.target.value === ""
                          ? ""
                          : Math.max(0, Number(e.target.value)),
                      )
                    }
                  />
                </label>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="block text-sm font-semibold text-ink">
                  Test code
                  <Input
                    className="mt-1.5 h-11"
                    value={paperCode}
                    onChange={(e) => setPaperCode(e.target.value)}
                    placeholder="7578"
                  />
                </label>
                <label className="block text-sm font-semibold text-ink">
                  Exam label
                  <Input
                    className="mt-1.5 h-11"
                    value={examLabel}
                    onChange={(e) => setExamLabel(e.target.value)}
                    placeholder="T3"
                  />
                </label>
              </div>

              <label className="block text-sm font-semibold text-ink">
                Exam syllabus
                <Input
                  className="mt-1.5 h-11"
                  value={syllabusNote}
                  onChange={(e) => setSyllabusNote(e.target.value)}
                  placeholder="CHAP 4"
                />
              </label>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="block text-sm font-semibold text-ink">
                  Exam date <span className="text-red-500">*</span>
                  <Input
                    className="mt-1.5 h-11"
                    type="date"
                    value={examDate}
                    onChange={(e) => setExamDate(e.target.value)}
                  />
                </label>
                <label className="block text-sm font-semibold text-ink">
                  Prepared by
                  <Input
                    className="mt-1.5 h-11"
                    value={preparedBy}
                    onChange={(e) => setPreparedBy(e.target.value)}
                  />
                </label>
              </div>

              {questionsDirty ? (
                <p className="rounded-xl bg-sky-50 px-3 py-2 text-sm text-sky-900">
                  Manual text edits will also be saved with this Save.
                </p>
              ) : null}

              {error ? (
                <p className="text-sm font-medium text-red-700">{error}</p>
              ) : null}
            </div>

            <div className="flex items-center justify-between gap-3 border-t border-[rgba(15,40,70,0.1)] bg-mist px-5 py-3">
              <p className="text-sm font-semibold text-ink">
                Total marks: {totalMarks}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => setSaveModalOpen(false)}
                  disabled={pending}
                >
                  Cancel
                </Button>
                <Button onClick={confirmSave} disabled={pending}>
                  {pending ? "Saving…" : "Save test"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </PageStack>
  );
}
