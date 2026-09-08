"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { RichText } from "@/components/rich-text";
import {
  pickRandomQuestions,
  searchQuestionPool,
  type PoolQuestionCard,
  type QuestionMedium,
  type QuestionSourceFilter,
} from "@/app/teacher/generate/actions";
import {
  CLASS9_ENGLISH_QUESTION_TYPE_OPTIONS,
  DEFAULT_ENGLISH_TYPE_FIELD,
  ENGLISH_QUESTION_TYPE_OPTIONS,
  defaultEnglishFieldForType,
  englishTypeFieldSelectValue,
  isClass9EnglishClass,
  isEnglishSubjectName,
  parseEnglishTypeField,
  type EnglishFieldFilter,
} from "@/app/teacher/generate/english-fields";
import { replaceSectionOnSavedTest } from "./actions";

type QType = "MCQ" | "SHORT" | "LONG";

type ChapterOption = {
  id: string;
  name: string;
  topics: Array<{
    id: string;
    name: string;
    countsByType: { MCQ: number; SHORT: number; LONG: number };
  }>;
};

export type PaperSectionForPicker = {
  type: QType;
  marksEach: number;
  questions: PoolQuestionCard[];
};

const ALL_TYPES: QType[] = ["MCQ", "SHORT", "LONG"];

const TYPE_META: Record<
  QType,
  { label: string; short: string; urdu: string; defaultMarks: number }
> = {
  MCQ: {
    label: "Multiple Choice",
    short: "MCQs",
    urdu: "کثیر الانتخابی سوالات",
    defaultMarks: 1,
  },
  SHORT: {
    label: "Short Questions",
    short: "Short",
    urdu: "مختصر سوالات",
    defaultMarks: 2,
  },
  LONG: {
    label: "Long Questions",
    short: "Long",
    urdu: "تفصیلی سوالات",
    defaultMarks: 5,
  },
};

function sourceKind(source: string | null) {
  const s = (source ?? "").toLowerCase();
  if (s.includes("exercise")) return "exercise";
  if (s.includes("additional")) return "additional";
  return "other";
}

function sourceLabel(source: string | null) {
  const kind = sourceKind(source);
  if (kind === "exercise") return "Exercise";
  if (kind === "additional") return "Additional";
  return source?.trim() || "Other";
}

function QuestionBilingualText({
  text,
  textUrdu,
  medium,
}: {
  text: string;
  textUrdu: string | null;
  medium: QuestionMedium;
}) {
  if (medium === "URDU") {
    return (
      <RichText
        as="p"
        value={textUrdu || text}
        dir="rtl"
        className="text-sm text-ink"
      />
    );
  }
  if (medium === "ENGLISH") {
    return <RichText as="p" value={text} className="text-sm text-ink" />;
  }
  return (
    <div className="space-y-0.5">
      <RichText as="p" value={text} className="text-sm text-ink" />
      {textUrdu ? (
        <RichText
          as="p"
          value={textUrdu}
          dir="rtl"
          className="text-sm text-ink-soft"
        />
      ) : null}
    </div>
  );
}

function typeCountInChapters(chapters: ChapterOption[], type: QType) {
  return chapters.reduce(
    (sum, ch) =>
      sum + ch.topics.reduce((tSum, t) => tSum + t.countsByType[type], 0),
    0,
  );
}

function firstTypeWithQuestions(sections: PaperSectionForPicker[]): QType {
  for (const t of ALL_TYPES) {
    const s = sections.find((x) => x.type === t);
    if (s && s.questions.length > 0) return t;
  }
  return "MCQ";
}

export function QuestionPickerModal({
  testId,
  className,
  subjectName,
  chapters,
  paperSections,
  onClose,
  onAdded,
}: {
  testId: string;
  className?: string | null;
  subjectName?: string | null;
  chapters: ChapterOption[];
  paperSections: PaperSectionForPicker[];
  onClose: () => void;
  onAdded: () => void;
}) {
  const allTopicIds = useMemo(
    () => chapters.flatMap((c) => c.topics.map((t) => t.id)),
    [chapters],
  );
  const allChapterIds = useMemo(() => chapters.map((c) => c.id), [chapters]);

  const initialType = firstTypeWithQuestions(paperSections);
  const initialSection = paperSections.find((s) => s.type === initialType);

  const [pending, startTransition] = useTransition();
  const [activeType, setActiveType] = useState<QType>(initialType);
  const [medium, setMedium] = useState<QuestionMedium>("BOTH");
  const [sourceFilter, setSourceFilter] = useState<QuestionSourceFilter>("ALL");
  const [englishField, setEnglishField] = useState<EnglishFieldFilter>(
    DEFAULT_ENGLISH_TYPE_FIELD.field,
  );
  const [sectionChapterIds, setSectionChapterIds] = useState<string[]>(allChapterIds);
  const [requiredCount, setRequiredCount] = useState<number | "">(
    initialSection?.questions.length || "",
  );
  const [marksPerQuestion, setMarksPerQuestion] = useState<number | "">(
    initialSection?.marksEach ?? TYPE_META[initialType].defaultMarks,
  );
  const [pool, setPool] = useState<PoolQuestionCard[]>(
    initialSection?.questions ?? [],
  );
  const [poolTotal, setPoolTotal] = useState(initialSection?.questions.length ?? 0);
  const [draftSelected, setDraftSelected] = useState<PoolQuestionCard[]>(
    initialSection?.questions ?? [],
  );
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  // Keep prefill if paperSections refresh while modal open (after replace save)
  useEffect(() => {
    const section = paperSections.find((s) => s.type === activeType);
    if (section && section.questions.length > 0) {
      setRequiredCount(section.questions.length);
      setMarksPerQuestion(section.marksEach);
      setDraftSelected(section.questions);
      setPool(section.questions);
      setPoolTotal(section.questions.length);
    }
  }, [paperSections, activeType]);

  const isEnglishSubject = isEnglishSubjectName(subjectName);
  const isClass9English =
    isEnglishSubject && isClass9EnglishClass(className);
  const englishTypeOptions = isClass9English
    ? CLASS9_ENGLISH_QUESTION_TYPE_OPTIONS
    : ENGLISH_QUESTION_TYPE_OPTIONS;
  const englishTypeFieldValue = englishTypeFieldSelectValue(
    activeType,
    englishField,
    { class9: isClass9English },
  );

  const availableForType = typeCountInChapters(
    chapters.filter((c) => sectionChapterIds.includes(c.id)),
    activeType,
  );

  const topicIdsForSearch = useMemo(() => {
    return chapters
      .filter((c) => sectionChapterIds.includes(c.id))
      .flatMap((c) => c.topics.map((t) => t.id));
  }, [chapters, sectionChapterIds]);

  /** Other types already on paper — don't pick those into this section */
  const otherTypeExcludeIds = useMemo(() => {
    return paperSections
      .filter((s) => s.type !== activeType)
      .flatMap((s) => s.questions.map((q) => q.id));
  }, [paperSections, activeType]);

  function loadTypeFromPaper(type: QType) {
    const section = paperSections.find((s) => s.type === type);
    setActiveType(type);
    setEnglishField(defaultEnglishFieldForType(type, { class9: isClass9English }));
    setError(null);
    if (section && section.questions.length > 0) {
      setRequiredCount(section.questions.length);
      setMarksPerQuestion(section.marksEach);
      setDraftSelected(section.questions);
      setPool(section.questions);
      setPoolTotal(section.questions.length);
      setMessage(
        `${section.questions.length} ${TYPE_META[type].short} loaded from the test — use Replace, then Add.`,
      );
    } else {
      setRequiredCount("");
      setMarksPerQuestion(TYPE_META[type].defaultMarks);
      setDraftSelected([]);
      setPool([]);
      setPoolTotal(0);
      setMessage(`This test has no ${TYPE_META[type].short} yet — select new ones.`);
    }
  }

  function loadEnglishTypeField(value: string) {
    const parsed = parseEnglishTypeField(value, { class9: isClass9English });
    if (!parsed) return;
    const section = paperSections.find((s) => s.type === parsed.type);
    setActiveType(parsed.type);
    setEnglishField(parsed.field);
    setError(null);
    setPool([]);
    setPoolTotal(0);
    if (section && section.questions.length > 0 && parsed.field === "ALL") {
      setRequiredCount(section.questions.length);
      setMarksPerQuestion(section.marksEach);
      setDraftSelected(section.questions);
      setPool(section.questions);
      setPoolTotal(section.questions.length);
      setMessage(
        `${section.questions.length} ${TYPE_META[parsed.type].short} loaded from the test — use Replace, then Add.`,
      );
    } else {
      setRequiredCount(section?.questions.length || "");
      setMarksPerQuestion(section?.marksEach ?? TYPE_META[parsed.type].defaultMarks);
      setDraftSelected(section && parsed.field === "ALL" ? section.questions : []);
      setMessage(
        parsed.field === "ALL"
          ? `This test has no ${TYPE_META[parsed.type].short} yet — select new ones.`
          : `${TYPE_META[parsed.type].short} · field filter on — try Search or Random.`,
      );
    }
  }

  function toggleChapter(chapterId: string) {
    setSectionChapterIds((prev) => {
      if (prev.includes(chapterId)) {
        if (prev.length === 1) return prev;
        return prev.filter((id) => id !== chapterId);
      }
      return [...prev, chapterId];
    });
  }

  function runSearch() {
    setError(null);
    setMessage(null);
    if (topicIdsForSearch.length === 0) {
      setError("Select at least one chapter");
      return;
    }
    const currentSelected = draftSelected;
    startTransition(async () => {
      try {
        const result = await searchQuestionPool({
          topicIds: topicIdsForSearch.length > 0 ? topicIdsForSearch : allTopicIds,
          type: activeType,
          chapterIds: sectionChapterIds,
          excludeIds: otherTypeExcludeIds,
          source: isEnglishSubject ? "ALL" : sourceFilter,
          englishField: isEnglishSubject ? englishField : "ALL",
          medium,
        });
        // Keep currently selected at top, merge with search results
        const selectedIds = new Set(currentSelected.map((q) => q.id));
        const merged = [
          ...currentSelected,
          ...result.questions.filter((q) => !selectedIds.has(q.id)),
        ];
        setPool(merged);
        setPoolTotal(merged.length);
        setMessage(
          result.total === 0 && currentSelected.length === 0
            ? `No ${TYPE_META[activeType].short} found`
            : `${merged.length} ${TYPE_META[activeType].short} · ${currentSelected.length} selected`,
        );
      } catch (err) {
        setError(err instanceof Error ? err.message : "Search failed");
      }
    });
  }

  function runSelectRandom() {
    setError(null);
    setMessage(null);
    const need = typeof requiredCount === "number" ? requiredCount : 0;
    if (need < 1) {
      setError("Enter the required number of questions.");
      return;
    }
    const marks = typeof marksPerQuestion === "number" ? marksPerQuestion : 0;
    if (marks < 1) {
      setError("Enter marks for each question.");
      return;
    }
    if (sectionChapterIds.length === 0) {
      setError("Select at least one chapter");
      return;
    }
    startTransition(async () => {
      try {
        const result = await pickRandomQuestions({
          topicIds: topicIdsForSearch.length > 0 ? topicIdsForSearch : allTopicIds,
          type: activeType,
          count: need,
          chapterIds: sectionChapterIds,
          excludeIds: otherTypeExcludeIds,
          mode: "BALANCED",
          source: isEnglishSubject ? "ALL" : sourceFilter,
          englishField: isEnglishSubject ? englishField : "ALL",
          medium,
        });
        setPool(result.questions);
        setPoolTotal(result.questions.length);
        setDraftSelected(result.questions);
        setMessage(
          result.questions.length === 0
            ? "Not enough questions for random pick"
            : `Random selected · ${result.questions.length} questions`,
        );
      } catch (err) {
        setError(err instanceof Error ? err.message : "Random select failed");
      }
    });
  }

  function toggleDraftQuestion(question: PoolQuestionCard) {
    const need = typeof requiredCount === "number" ? requiredCount : 0;
    if (need < 1) {
      setError("Enter the required number of questions first.");
      return;
    }
    setDraftSelected((prev) => {
      const exists = prev.some((q) => q.id === question.id);
      if (exists) return prev.filter((q) => q.id !== question.id);
      if (prev.length >= need) {
        setError(`Required count is ${need}. Uncheck one, or use Replace.`);
        return prev;
      }
      setError(null);
      return [...prev, question];
    });
  }

  function replaceOneQuestion(question: PoolQuestionCard) {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      try {
        const result = await pickRandomQuestions({
          topicIds: topicIdsForSearch.length > 0 ? topicIdsForSearch : allTopicIds,
          type: activeType,
          count: 1,
          chapterIds: question.chapterId
            ? [question.chapterId]
            : sectionChapterIds,
          excludeIds: [
            ...otherTypeExcludeIds,
            ...draftSelected.map((q) => q.id),
          ],
          mode: "RANDOM",
          source: isEnglishSubject ? "ALL" : sourceFilter,
          englishField: isEnglishSubject ? englishField : "ALL",
          medium,
        });
        const replacement = result.questions[0];
        if (!replacement) {
          setError("No other question is available in this chapter to replace with.");
          return;
        }
        setDraftSelected((prev) =>
          prev.map((q) => (q.id === question.id ? replacement : q)),
        );
        setPool((prev) => {
          const withoutOld = prev.filter((q) => q.id !== question.id);
          if (withoutOld.some((q) => q.id === replacement.id)) return withoutOld;
          return [replacement, ...withoutOld];
        });
        setMessage("1 question replaced.");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Replace failed");
      }
    });
  }

  function addToPaper() {
    setError(null);
    const need = typeof requiredCount === "number" ? requiredCount : 0;
    const marks = typeof marksPerQuestion === "number" ? marksPerQuestion : 0;
    if (need < 1) {
      setError("Enter the required number of questions.");
      return;
    }
    if (marks < 1) {
      setError("Enter marks for each question.");
      return;
    }
    if (draftSelected.length === 0) {
      setError("Select at least one question");
      return;
    }
    if (draftSelected.length !== need) {
      setError(`Select exactly ${need} questions (currently ${draftSelected.length})`);
      return;
    }

    startTransition(async () => {
      try {
        await replaceSectionOnSavedTest({
          testId,
          type: activeType,
          questionIds: draftSelected.map((q) => q.id),
          marksEach: marks,
        });
        setMessage(
          `${TYPE_META[activeType].short} updated · ${draftSelected.length} questions (previous ones replaced).`,
        );
        onAdded();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Update failed");
      }
    });
  }

  return (
    <div className="pts-modal-backdrop pts-modal-backdrop-paper" role="dialog" aria-modal="true">
      <div className="pts-modal">
        <div className="pts-modal-header">
          <div>
            <p className="text-xs font-medium text-white/80">Select Your Questions Here</p>
            <h3 className="text-base font-bold">
              {className} — {subjectName}
            </h3>
          </div>
          <button
            type="button"
            className="rounded-lg bg-card/15 px-3 py-1.5 text-sm font-semibold hover:bg-card/25"
            onClick={onClose}
          >
            Close
          </button>
        </div>

        <div className="bg-gradient-to-r from-[#1a3350] to-[#0f766e] px-4 py-3">
          <p className="mb-2 text-xs font-bold uppercase tracking-wider text-white/70">
            Chapters for this section
          </p>
          <div className="flex flex-wrap gap-1.5">
            {chapters.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => toggleChapter(c.id)}
                className={cn(
                  "rounded-lg px-3 py-1.5 text-xs font-semibold transition-all",
                  sectionChapterIds.includes(c.id)
                    ? "bg-card text-[#1a3350] shadow-sm"
                    : "bg-card/15 text-white/80 hover:bg-card/25",
                )}
              >
                {c.name.replace(/^(\d+\.\s*)/, "Ch ")}
              </button>
            ))}
          </div>
        </div>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4 sm:p-5">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <label className="text-xs font-semibold text-muted">
              Question type
              {isEnglishSubject ? (
                <select
                  className="mt-1 h-10 w-full rounded-xl border border-[rgba(15,40,70,0.12)] bg-card px-3 text-sm"
                  value={englishTypeFieldValue}
                  onChange={(e) => loadEnglishTypeField(e.target.value)}
                >
                  {englishTypeOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              ) : (
                <select
                  className="mt-1 h-10 w-full rounded-xl border border-[rgba(15,40,70,0.12)] bg-card px-3 text-sm"
                  value={activeType}
                  onChange={(e) => loadTypeFromPaper(e.target.value as QType)}
                >
                  {ALL_TYPES.map((t) => {
                    const onPaper =
                      paperSections.find((s) => s.type === t)?.questions.length ??
                      0;
                    return (
                      <option key={t} value={t}>
                        {TYPE_META[t].label} ({TYPE_META[t].urdu})
                        {onPaper > 0
                          ? ` — test: ${onPaper}`
                          : ` — ${typeCountInChapters(chapters, t)} available`}
                      </option>
                    );
                  })}
                </select>
              )}
            </label>
            <label className="text-xs font-semibold text-muted">
              Medium
              <select
                className="mt-1 h-10 w-full rounded-xl border border-[rgba(15,40,70,0.12)] bg-card px-3 text-sm"
                value={medium}
                onChange={(e) => setMedium(e.target.value as QuestionMedium)}
              >
                <option value="BOTH">Dual Medium</option>
                <option value="ENGLISH">English</option>
                <option value="URDU">Urdu</option>
              </select>
            </label>
            {isEnglishSubject ? null : (
              <label className="text-xs font-semibold text-muted">
                Source
                <select
                  className="mt-1 h-10 w-full rounded-xl border border-[rgba(15,40,70,0.12)] bg-card px-3 text-sm"
                  value={sourceFilter}
                  onChange={(e) =>
                    setSourceFilter(e.target.value as QuestionSourceFilter)
                  }
                >
                  <option value="ALL">All (Smart Syllabus)</option>
                  <option value="EXERCISE">Exercise</option>
                  <option value="ADDITIONAL">Additional</option>
                </select>
              </label>
            )}
            <div className="flex items-end">
              <p className="w-full rounded-xl bg-[#ecfdf5] px-3 py-2 text-center text-sm font-bold text-brand">
                Selected {draftSelected.length}
                {typeof requiredCount === "number" && requiredCount > 0
                  ? ` / ${requiredCount}`
                  : ""}{" "}
                · pool {poolTotal || availableForType}
              </p>
            </div>
          </div>

          <div className="grid gap-2 sm:grid-cols-3">
            <label className="text-xs font-semibold text-muted">
              Required questions *
              <Input
                className="mt-1"
                type="number"
                min={1}
                value={requiredCount}
                onChange={(e) =>
                  setRequiredCount(
                    e.target.value === "" ? "" : Math.max(0, Number(e.target.value)),
                  )
                }
              />
            </label>
            <label className="text-xs font-semibold text-muted">
              Each Q marks *
              <Input
                className="mt-1"
                type="number"
                min={1}
                value={marksPerQuestion}
                onChange={(e) =>
                  setMarksPerQuestion(
                    e.target.value === "" ? "" : Math.max(0, Number(e.target.value)),
                  )
                }
              />
            </label>
            <label className="text-xs font-semibold text-muted">
              Attempt any (optional)
              <Input className="mt-1" type="number" min={0} placeholder="—" disabled />
            </label>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button onClick={runSearch} disabled={pending}>
              {pending ? "…" : "Search"}
            </Button>
            <Button variant="outline" onClick={runSelectRandom} disabled={pending}>
              Random Select
            </Button>
            {draftSelected.length > 0 ? (
              <Button
                variant="outline"
                onClick={() => loadTypeFromPaper(activeType)}
              >
                Reset to test
              </Button>
            ) : null}
          </div>

          {error ? <p className="text-sm font-medium text-red-700">{error}</p> : null}
          {message && !error ? (
            <p className="text-sm font-medium text-brand">{message}</p>
          ) : null}

          {pool.length > 0 ? (
            <div className="overflow-hidden rounded-xl border border-[rgba(15,40,70,0.1)]">
              <div className="bg-[#3b0764] px-3 py-2 text-xs font-bold tracking-wide text-white uppercase">
                {TYPE_META[activeType].label} · {pool.length} shown
                {pending ? " · loading…" : ""}
              </div>
              <div className="max-h-[42vh] divide-y divide-[rgba(15,40,70,0.08)] overflow-y-auto">
                {pool.map((q, idx) => {
                  const selected = draftSelected.some((d) => d.id === q.id);
                  return (
                    <div
                      key={q.id}
                      className={cn(
                        "flex w-full gap-3 px-3 py-2.5 text-left transition-colors",
                        selected ? "bg-[#ecfdf5]" : "bg-card hover:bg-mist",
                      )}
                    >
                      <button
                        type="button"
                        className="mt-1 shrink-0"
                        onClick={() => toggleDraftQuestion(q)}
                        aria-label={selected ? "Unselect question" : "Select question"}
                      >
                        <input type="checkbox" readOnly checked={selected} />
                      </button>
                      <button
                        type="button"
                        className="min-w-0 flex-1 text-left"
                        onClick={() => toggleDraftQuestion(q)}
                      >
                        <div className="mb-1 flex flex-wrap items-center gap-2">
                          <span className="text-xs font-bold text-muted">{idx + 1}</span>
                          <span
                            className={cn(
                              "source-chip",
                              sourceKind(q.source) === "exercise" &&
                                "source-chip-exercise",
                              sourceKind(q.source) === "additional" &&
                                "source-chip-additional",
                              sourceKind(q.source) === "other" && "source-chip-other",
                            )}
                          >
                            {sourceLabel(q.source)}
                          </span>
                          <span className="truncate text-[10px] text-muted">
                            {q.topicName}
                          </span>
                        </div>
                        <QuestionBilingualText
                          text={q.text}
                          textUrdu={q.textUrdu}
                          medium={medium}
                        />
                        {activeType === "MCQ" ? (
                          <div className="mt-1 grid gap-0.5 text-[11px] text-ink-soft sm:grid-cols-2">
                            {[q.optionA, q.optionB, q.optionC, q.optionD].map(
                              (opt, i) =>
                                opt ? (
                                  <p key={i}>
                                    ({String.fromCharCode(65 + i)}) {opt}
                                  </p>
                                ) : null,
                            )}
                          </div>
                        ) : null}
                      </button>
                      {selected ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="mt-0.5 shrink-0"
                          disabled={pending}
                          onClick={() => replaceOneQuestion(q)}
                        >
                          Replace
                        </Button>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <p className="rounded-xl border border-dashed border-[rgba(15,40,70,0.15)] bg-mist px-4 py-8 text-center text-sm text-muted">
              {pending
                ? "Questions load ho rahe hain…"
                : "Click Search or Random Select first — matching questions will appear here."}
            </p>
          )}
        </div>

        <div className="sticky bottom-0 flex flex-wrap items-center justify-between gap-2 border-t border-[rgba(15,40,70,0.1)] bg-mist px-3 py-3 sm:px-4">
          <p className="text-xs font-semibold text-ink">
            Selected {draftSelected.length}
            {typeof requiredCount === "number" && requiredCount > 0
              ? ` / ${requiredCount}`
              : ""}{" "}
            ·{" "}
            <span className="font-normal text-muted">
              Add will replace the existing {TYPE_META[activeType].short} section (it will not append).
            </span>
          </p>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={onClose}>
              View test
            </Button>
            <Button
              onClick={addToPaper}
              disabled={pending || draftSelected.length === 0}
            >
              Add Question&apos;s →
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
