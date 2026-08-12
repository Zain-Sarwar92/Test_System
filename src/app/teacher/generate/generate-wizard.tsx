"use client";

import { useMemo, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { PageHeader, PageStack } from "@/components/page-header";
import {
  ExamPaperSheet,
  type ExamQuestionPatch,
} from "@/components/exam-paper-sheet";
import { cn } from "@/lib/utils";
import { RichText } from "@/components/rich-text";
import {
  Atom,
  BookMarked,
  BookOpen,
  Brain,
  Briefcase,
  Calculator,
  ChevronRight,
  FlaskConical,
  Globe2,
  Landmark,
  Languages,
  Library,
  type LucideIcon,
} from "lucide-react";
import {
  pickRandomQuestions,
  saveSectionBuiltTest,
  searchQuestionPool,
  type PoolQuestionCard,
  type QuestionMedium,
  type QuestionSourceFilter,
} from "./actions";
import {
  DEFAULT_ENGLISH_TYPE_FIELD,
  ENGLISH_QUESTION_TYPE_OPTIONS,
  defaultEnglishFieldForType,
  englishTypeFieldSelectValue,
  isEnglishSubjectName,
  parseEnglishTypeField,
  type EnglishFieldFilter,
} from "./english-fields";

export type HierarchyBoard = {
  id: string;
  name: string;
  classes: Array<{
    id: string;
    name: string;
    subjects: Array<{
      id: string;
      name: string;
      chapters: Array<{
        id: string;
        name: string;
        order: number;
        topics: Array<{
          id: string;
          name: string;
          order: number;
          questionCount: number;
          countsByType: { MCQ: number; SHORT: number; LONG: number };
        }>;
      }>;
    }>;
  }>;
};

type Step = "board" | "class" | "subject" | "chapters" | "workspace" | "paper";
type QType = "MCQ" | "SHORT" | "LONG";
type SelectionMode = "random" | "manual";

type PaperSection = {
  type: QType;
  attemptCount: number;
  marksEach: number;
  questions: PoolQuestionCard[];
};

type ChapterPlanRow = {
  chapterId: string;
  mcqCount: number | "";
  shortCount: number | "";
  longCount: number | "";
};

const ALL_TYPES: QType[] = ["MCQ", "SHORT", "LONG"];

const WIZARD_STEPS: Array<{ id: Step; label: string }> = [
  { id: "board", label: "Board" },
  { id: "class", label: "Class" },
  { id: "subject", label: "Subject" },
  { id: "chapters", label: "Syllabus" },
  { id: "workspace", label: "Build" },
  { id: "paper", label: "Paper" },
];

type PaperPreset = {
  id: string;
  label: string;
  duration: number;
  mcq: number;
  short: number;
  long: number;
};

const PAPER_PRESETS: PaperPreset[] = [
  { id: "quiz", label: "Quiz 20", duration: 30, mcq: 10, short: 5, long: 0 },
  { id: "class", label: "Class test 40", duration: 60, mcq: 15, short: 8, long: 2 },
  { id: "mid", label: "Mid 60", duration: 90, mcq: 20, short: 10, long: 4 },
  { id: "board", label: "Board 75", duration: 150, mcq: 15, short: 18, long: 6 },
];

const MEDIUM_OPTIONS: Array<{ value: QuestionMedium; label: string }> = [
  { value: "ENGLISH", label: "English" },
  { value: "URDU", label: "Urdu" },
  { value: "BOTH", label: "Dual" },
];

function WizardActionBar({
  summary,
  children,
}: {
  summary: ReactNode;
  children: ReactNode;
}) {
  return (
    <>
      <div className="wizard-action-spacer" aria-hidden />
      <div className="wizard-action-bar">
        <div className="wizard-action-bar-inner">
          <div className="wizard-action-bar-summary">{summary}</div>
          <div className="wizard-action-bar-actions">{children}</div>
        </div>
      </div>
    </>
  );
}

function subjectIconFor(name: string): LucideIcon {
  const n = name.toLowerCase();
  if (/math|حساب|الجبرا|geometry/.test(n)) return Calculator;
  if (/chem|کیمیا/.test(n)) return FlaskConical;
  if (/phys|طبیعیات|فزکس/.test(n)) return Atom;
  if (/bio|حیاتیات/.test(n)) return BookOpen;
  if (/eng|انگریزی/.test(n)) return Languages;
  if (/urd|اردو|اُردو/.test(n)) return BookMarked;
  if (/isl|اسلام|قرآن|tarjama|ترجم/.test(n)) return Landmark;
  if (/comp|کمپیوٹر|ict/.test(n)) return Brain;
  if (/geo|جغراف/.test(n)) return Globe2;
  if (/hist|تاریخ|pak.?stud|پاکستان/.test(n)) return Landmark;
  if (/econ|commerce|account|business|معاش|تجارت|محاسب/.test(n)) return Briefcase;
  if (/psych|socio|civics|educat|ethic/.test(n)) return Brain;
  return BookMarked;
}

function chapterTypeTotals(
  chapter: HierarchyBoard["classes"][number]["subjects"][number]["chapters"][number],
  topicIds?: Set<string>,
) {
  const topics = topicIds
    ? chapter.topics.filter((t) => topicIds.has(t.id))
    : chapter.topics;
  return topics.reduce(
    (acc, topic) => ({
      MCQ: acc.MCQ + topic.countsByType.MCQ,
      SHORT: acc.SHORT + topic.countsByType.SHORT,
      LONG: acc.LONG + topic.countsByType.LONG,
    }),
    { MCQ: 0, SHORT: 0, LONG: 0 },
  );
}

/** Spread a total count across chapters by available capacity (greedy). */
function distributeCount(
  available: number[],
  total: number,
): number[] {
  const n = available.length;
  const out = Array.from({ length: n }, () => 0);
  if (n === 0 || total <= 0) return out;

  let remaining = total;
  // First pass: 1 each where available, round-robin
  let progressed = true;
  while (remaining > 0 && progressed) {
    progressed = false;
    for (let i = 0; i < n && remaining > 0; i++) {
      if (out[i] < available[i]) {
        out[i] += 1;
        remaining -= 1;
        progressed = true;
      }
    }
  }
  return out;
}

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

function typeMetaWithDefaults(defaults: {
  mcqMarks: number;
  shortMarks: number;
  longMarks: number;
}) {
  return {
    MCQ: { ...TYPE_META.MCQ, defaultMarks: defaults.mcqMarks },
    SHORT: { ...TYPE_META.SHORT, defaultMarks: defaults.shortMarks },
    LONG: { ...TYPE_META.LONG, defaultMarks: defaults.longMarks },
  };
}

function shortClassBadge(className: string) {
  const match = className.trim().match(/(\d+[A-Za-z]*)\s*$/);
  if (match) return match[1];
  const word = className.trim().split(/\s+/).pop() ?? className;
  return word.slice(0, 4);
}

function typeCountInTopics(
  chapters: HierarchyBoard["classes"][number]["subjects"][number]["chapters"],
  topicIds: string[],
  type: QType,
) {
  const set = new Set(topicIds);
  return chapters
    .flatMap((c) => c.topics)
    .filter((t) => set.has(t.id))
    .reduce((sum, t) => sum + t.countsByType[type], 0);
}

function sourceKind(source: string | null) {
  if (!source) return "other" as const;
  if (/exercise/i.test(source)) return "exercise" as const;
  if (/additional/i.test(source)) return "additional" as const;
  return "other" as const;
}

function sourceLabel(source: string | null) {
  const kind = sourceKind(source);
  if (kind === "exercise") return "Exercise";
  if (kind === "additional") return "Additional";
  return source ?? "Other";
}



function QuestionBilingualText({
  text,
  textUrdu,
  medium,
  className,
}: {
  text: string;
  textUrdu: string | null;
  medium: QuestionMedium;
  className?: string;
}) {
  if (medium === "ENGLISH") {
    return (
      <RichText
        as="p"
        value={text}
        className={cn("text-sm font-medium text-ink whitespace-pre-wrap", className)}
      />
    );
  }
  if (medium === "URDU") {
    return (
      <RichText
        as="p"
        value={textUrdu || text}
        dir="rtl"
        className={cn("text-sm font-medium text-ink whitespace-pre-wrap", className)}
      />
    );
  }
  return (
    <div className={cn("grid gap-2 sm:grid-cols-2", className)}>
      <RichText
        as="p"
        value={text}
        className="text-sm font-medium text-ink whitespace-pre-wrap"
      />
      <RichText
        as="p"
        value={textUrdu || "—"}
        dir="rtl"
        className="text-sm font-medium text-ink whitespace-pre-wrap"
      />
    </div>
  );
}

export function GenerateWizard({
  boards,
  teacherName,
  organization,
  scheduleContext = null,
  systemDefaults = {
    durationMinutes: 60,
    mcqMarks: 1,
    shortMarks: 2,
    longMarks: 5,
  },
}: {
  boards: HierarchyBoard[];
  teacherName: string;
  organization?: {
    name: string;
    logoUrl?: string | null;
    address?: string | null;
    phone?: string | null;
  } | null;
  scheduleContext?: {
    assignmentId: string;
    scheduleName: string;
    boardId: string;
    classId: string;
    subjectId: string;
    classSection?: string | null;
    testDate: string;
    syllabusText?: string | null;
  } | null;
  systemDefaults?: {
    durationMinutes: number;
    mcqMarks: number;
    shortMarks: number;
    longMarks: number;
  };
}) {
  const typeMeta = typeMetaWithDefaults(systemDefaults);

  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const lockedFromSchedule = Boolean(scheduleContext);

  const [step, setStep] = useState<Step>(
    scheduleContext ? "chapters" : "board",
  );
  const [boardId, setBoardId] = useState<string | null>(
    scheduleContext?.boardId ?? null,
  );
  const [classId, setClassId] = useState<string | null>(
    scheduleContext?.classId ?? null,
  );
  const [subjectId, setSubjectId] = useState<string | null>(
    scheduleContext?.subjectId ?? null,
  );
  const [selectedChapterIds, setSelectedChapterIds] = useState<string[]>([]);
  const [selectedTopicIds, setSelectedTopicIds] = useState<string[]>([]);

  const [modalOpen, setModalOpen] = useState(false);
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [activeType, setActiveType] = useState<QType>("MCQ");
  const [requiredCount, setRequiredCount] = useState<number | "">("");
  const [attemptCount, setAttemptCount] = useState<number | "">("");
  const [marksPerQuestion, setMarksPerQuestion] = useState<number | "">("");
  const [medium, setMedium] = useState<QuestionMedium>("BOTH");
  const [sourceFilter, setSourceFilter] = useState<QuestionSourceFilter>("ALL");
  const [englishField, setEnglishField] = useState<EnglishFieldFilter>(
    DEFAULT_ENGLISH_TYPE_FIELD.field,
  );
  const [poolView, setPoolView] = useState<"browse" | "selected">("browse");
  const [sectionChapterIds, setSectionChapterIds] = useState<string[]>([]);
  const [pool, setPool] = useState<PoolQuestionCard[]>([]);
  const [poolTotal, setPoolTotal] = useState(0);
  const [draftSelected, setDraftSelected] = useState<PoolQuestionCard[]>([]);
  const [paperSections, setPaperSections] = useState<PaperSection[]>([]);
  const [chapterPlan, setChapterPlan] = useState<ChapterPlanRow[]>([]);
  const [selectionMode, setSelectionMode] = useState<SelectionMode | null>(null);
  const [manualEditMode, setManualEditMode] = useState(false);
  const [showAnswerKey, setShowAnswerKey] = useState(false);
  const [activePresetId, setActivePresetId] = useState<string | null>(null);
  const [presetTargets, setPresetTargets] = useState<{
    mcq: number;
    short: number;
    long: number;
  } | null>(null);

  const [title, setTitle] = useState("");
  const [durationMinutes, setDurationMinutes] = useState<number | "">(
    systemDefaults.durationMinutes,
  );
  const [classSection, setClassSection] = useState(
    scheduleContext?.classSection ?? "",
  );
  const [examDate, setExamDate] = useState(scheduleContext?.testDate ?? "");
  const [preparedBy, setPreparedBy] = useState(teacherName);
  const [instructions, setInstructions] = useState("");
  const [paperCode, setPaperCode] = useState("");
  const [examLabel, setExamLabel] = useState("");
  const [syllabusNote, setSyllabusNote] = useState(
    scheduleContext?.syllabusText ?? "",
  );
  const [testType, setTestType] = useState(scheduleContext?.scheduleName ?? "");

  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const isMultiChapter = selectedChapterIds.length > 1;
  const questionsLocked = selectionMode === "random";

  const selectedBoard = boards.find((b) => b.id === boardId);
  const selectedClass = selectedBoard?.classes.find((c) => c.id === classId);
  const selectedSubject = selectedClass?.subjects.find((s) => s.id === subjectId);
  const chapters = selectedSubject?.chapters ?? [];
  const isEnglishSubject = isEnglishSubjectName(selectedSubject?.name);
  const englishTypeFieldValue = englishTypeFieldSelectValue(
    activeType,
    englishField,
  );

  const usedQuestionIds = useMemo(
    () => new Set(paperSections.flatMap((s) => s.questions.map((q) => q.id))),
    [paperSections],
  );

  const paperQuestionCount = paperSections.reduce(
    (sum, s) => sum + s.questions.length,
    0,
  );
  const paperMarks = paperSections.reduce(
    (sum, s) => sum + s.questions.length * s.marksEach,
    0,
  );

  const derivedSyllabus = useMemo(() => {
    const selected = chapters.filter((c) => selectedChapterIds.includes(c.id));
    if (selected.length === 0) return "";
    return selected
      .map((c) => {
        const m = c.name.match(/(\d+)/);
        return m ? `CHAP ${m[1]}` : c.name;
      })
      .join(", ");
  }, [chapters, selectedChapterIds]);

  const selectedChapters = useMemo(
    () => chapters.filter((chapter) => selectedChapterIds.includes(chapter.id)),
    [chapters, selectedChapterIds],
  );

  const chapterPlanRows = useMemo(() => {
    const planByChapter = new Map(chapterPlan.map((item) => [item.chapterId, item]));
    const topicSet = new Set(selectedTopicIds);
    return selectedChapters.map((chapter) => {
      const available = chapterTypeTotals(chapter, topicSet);
      const plan = planByChapter.get(chapter.id);
      const requested = {
        MCQ: typeof plan?.mcqCount === "number" ? plan.mcqCount : 0,
        SHORT: typeof plan?.shortCount === "number" ? plan.shortCount : 0,
        LONG: typeof plan?.longCount === "number" ? plan.longCount : 0,
      };
      return {
        chapter,
        available,
        requested,
        total: requested.MCQ + requested.SHORT + requested.LONG,
      };
    });
  }, [chapterPlan, selectedChapters, selectedTopicIds]);

  const plannerTotals = useMemo(
    () =>
      chapterPlanRows.reduce(
        (acc, row) => ({
          MCQ: acc.MCQ + row.requested.MCQ,
          SHORT: acc.SHORT + row.requested.SHORT,
          LONG: acc.LONG + row.requested.LONG,
        }),
        { MCQ: 0, SHORT: 0, LONG: 0 },
      ),
    [chapterPlanRows],
  );

  const plannerQuestionTotal =
    plannerTotals.MCQ + plannerTotals.SHORT + plannerTotals.LONG;
  const plannerEstimatedMarks =
    plannerTotals.MCQ * typeMeta.MCQ.defaultMarks +
    plannerTotals.SHORT * typeMeta.SHORT.defaultMarks +
    plannerTotals.LONG * typeMeta.LONG.defaultMarks;

  const paperMeta = {
    title: title || `${selectedSubject?.name ?? "Subject"} Paper`,
    boardName: selectedBoard?.name,
    className: selectedClass?.name,
    subjectName: selectedSubject?.name,
    classSection: classSection || null,
    examDate: examDate || null,
    durationMinutes: typeof durationMinutes === "number" ? durationMinutes : null,
    totalMarks: paperMarks,
    preparedBy: preparedBy || teacherName,
    instructions: instructions || null,
    paperCode: paperCode || null,
    examLabel: examLabel || null,
    syllabusNote: syllabusNote || derivedSyllabus || null,
    organization: organization ?? null,
  };

  const visiblePool = poolView === "selected" ? draftSelected : pool;
  const availableForType = typeCountInTopics(chapters, selectedTopicIds, activeType);

  function goToStep(next: Step) {
    setError(null);
    setMessage(null);
    if (next !== "paper") setManualEditMode(false);
    setStep(next);
  }

  function resetPicker() {
    setRequiredCount("");
    setAttemptCount("");
    setMarksPerQuestion("");
    setMedium("BOTH");
    setSourceFilter("ALL");
    setEnglishField(DEFAULT_ENGLISH_TYPE_FIELD.field);
    setPoolView("browse");
    setPool([]);
    setPoolTotal(0);
    setDraftSelected([]);
  }

  function resetBuildState() {
    resetPicker();
    setActiveType("MCQ");
    setSectionChapterIds([]);
    setPaperSections([]);
    setChapterPlan([]);
    setSelectionMode(null);
    setModalOpen(false);
    setShowAnswerKey(false);
    setActivePresetId(null);
    setPresetTargets(null);
  }

  function applyPreset(preset: PaperPreset) {
    setActivePresetId(preset.id);
    setPresetTargets({
      mcq: preset.mcq,
      short: preset.short,
      long: preset.long,
    });
    setDurationMinutes(preset.duration);
    setError(null);
    setMessage(
      `Preset · ${preset.label} · ${preset.duration} min · MCQ ${preset.mcq} · Short ${preset.short} · Long ${preset.long}`,
    );

    if (selectedChapterIds.length > 1 && chapterPlan.length > 0) {
      fillPlanFromPreset(preset);
    }
  }

  function fillPlanFromPreset(preset: PaperPreset) {
    const topicSet = new Set(selectedTopicIds);
    const rows = selectedChapters.map((chapter) => ({
      chapterId: chapter.id,
      available: chapterTypeTotals(chapter, topicSet),
    }));
    const mcqDist = distributeCount(
      rows.map((r) => r.available.MCQ),
      preset.mcq,
    );
    const shortDist = distributeCount(
      rows.map((r) => r.available.SHORT),
      preset.short,
    );
    const longDist = distributeCount(
      rows.map((r) => r.available.LONG),
      preset.long,
    );
    setChapterPlan(
      rows.map((row, i) => ({
        chapterId: row.chapterId,
        mcqCount: mcqDist[i] > 0 ? mcqDist[i] : "",
        shortCount: shortDist[i] > 0 ? shortDist[i] : "",
        longCount: longDist[i] > 0 ? longDist[i] : "",
      })),
    );
  }

  function openWorkspace() {
    if (selectedTopicIds.length === 0) {
      setError("Select at least one chapter or topic");
      return;
    }
    setSectionChapterIds([...selectedChapterIds]);
    setPaperSections([]);
    resetPicker();
    setActiveType("MCQ");
    setMarksPerQuestion(typeMeta.MCQ.defaultMarks);
    setTitle("");
    setTestType(scheduleContext?.scheduleName ?? "");
    setDurationMinutes(systemDefaults.durationMinutes);
    setClassSection(scheduleContext?.classSection ?? "");
    setExamDate(scheduleContext?.testDate ?? "");
    setPreparedBy(teacherName);
    setInstructions("");
    setSyllabusNote(scheduleContext?.syllabusText ?? "");
    setError(null);
    setMessage(null);

    // Single chapter: skip planner → paper preview + question picker popup
    if (selectedChapterIds.length <= 1) {
      setChapterPlan([]);
      setSelectionMode("manual");
      setModalOpen(true);
      goToStep("paper");
      // Prefill picker counts from preset without changing flow
      if (presetTargets) {
        const firstType: QType =
          presetTargets.mcq > 0
            ? "MCQ"
            : presetTargets.short > 0
              ? "SHORT"
              : presetTargets.long > 0
                ? "LONG"
                : "MCQ";
        setActiveType(firstType);
        const count =
          firstType === "MCQ"
            ? presetTargets.mcq
            : firstType === "SHORT"
              ? presetTargets.short
              : presetTargets.long;
        setRequiredCount(count > 0 ? count : "");
        setMarksPerQuestion(typeMeta[firstType].defaultMarks);
      }
      return;
    }

    // Multi chapter: show distribution planner first
    if (presetTargets) {
      const topicSet = new Set(selectedTopicIds);
      const rows = selectedChapters.map((chapter) => ({
        chapterId: chapter.id,
        available: chapterTypeTotals(chapter, topicSet),
      }));
      const mcqDist = distributeCount(
        rows.map((r) => r.available.MCQ),
        presetTargets.mcq,
      );
      const shortDist = distributeCount(
        rows.map((r) => r.available.SHORT),
        presetTargets.short,
      );
      const longDist = distributeCount(
        rows.map((r) => r.available.LONG),
        presetTargets.long,
      );
      setChapterPlan(
        rows.map((row, i) => ({
          chapterId: row.chapterId,
          mcqCount: mcqDist[i] > 0 ? mcqDist[i] : "",
          shortCount: shortDist[i] > 0 ? shortDist[i] : "",
          longCount: longDist[i] > 0 ? longDist[i] : "",
        })),
      );
    } else {
      setChapterPlan(
        selectedChapterIds.map((chapterId) => ({
          chapterId,
          mcqCount: "",
          shortCount: "",
          longCount: "",
        })),
      );
    }
    setSelectionMode(null);
    setModalOpen(false);
    goToStep("workspace");
  }

  function goToPaperView() {
    if (paperSections.length === 0) {
      setError("Add at least one section first (MCQ / Short / Long).");
      return;
    }
    setModalOpen(false);
    setError(null);
    setManualEditMode(false);
    goToStep("paper");
  }

  function updatePaperQuestion(
    sectionType: QType,
    questionId: string,
    patch: ExamQuestionPatch,
  ) {
    setPaperSections((prev) =>
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

  function plannedCountForType(type: QType) {
    return chapterPlan.reduce((sum, item) => {
      const value =
        type === "MCQ"
          ? item.mcqCount
          : type === "SHORT"
            ? item.shortCount
            : item.longCount;
      return sum + (typeof value === "number" ? value : 0);
    }, 0);
  }

  function plannedQuotaForChapter(chapterId: string, type: QType) {
    const item = chapterPlan.find((row) => row.chapterId === chapterId);
    if (!item) return null;
    const value =
      type === "MCQ"
        ? item.mcqCount
        : type === "SHORT"
          ? item.shortCount
          : item.longCount;
    return typeof value === "number" ? value : 0;
  }

  function hasChapterPlan() {
    return isMultiChapter && chapterPlan.length > 0 && plannerQuestionTotal > 0;
  }

  function chapterQuotasForType(type: QType) {
    return chapterPlan
      .map((item) => ({
        chapterId: item.chapterId,
        count: plannedQuotaForChapter(item.chapterId, type) ?? 0,
      }))
      .filter((item) => item.count > 0);
  }

  function activateTypeWithPlan(type: QType) {
    const planned = plannedCountForType(type);
    setActiveType(type);
    setRequiredCount(planned > 0 ? planned : "");
    setMarksPerQuestion(typeMeta[type].defaultMarks);
    setAttemptCount("");
    setEnglishField(defaultEnglishFieldForType(type));
    setPool([]);
    setPoolTotal(0);
    setDraftSelected([]);
    setPoolView("browse");
    if (hasChapterPlan()) {
      const allowed = chapterQuotasForType(type).map((q) => q.chapterId);
      setSectionChapterIds(allowed.length > 0 ? allowed : [...selectedChapterIds]);
    }
  }

  function openPickerFromPlanner() {
    const plannerError = validateChapterPlan();
    if (plannerError) {
      setError(plannerError);
      return;
    }

    const firstType =
      ALL_TYPES.find((type) => plannedCountForType(type) > 0) ?? "MCQ";

    setSelectionMode("manual");
    setPaperSections([]);
    setError(null);
    setMessage(
      `Planner ready · ${plannerTotals.MCQ} MCQ · ${plannerTotals.SHORT} Short · ${plannerTotals.LONG} Long`,
    );
    activateTypeWithPlan(firstType);
    setModalOpen(true);
    goToStep("paper");
  }

  function activateType(type: QType) {
    if (hasChapterPlan()) {
      activateTypeWithPlan(type);
      return;
    }
    setActiveType(type);
    setAttemptCount("");
    setEnglishField(defaultEnglishFieldForType(type));
    setPool([]);
    setPoolTotal(0);
    setDraftSelected([]);
    setPoolView("browse");
    if (presetTargets) {
      const count =
        type === "MCQ"
          ? presetTargets.mcq
          : type === "SHORT"
            ? presetTargets.short
            : presetTargets.long;
      setRequiredCount(count > 0 ? count : "");
      setMarksPerQuestion(typeMeta[type].defaultMarks);
    } else {
      setRequiredCount("");
      setMarksPerQuestion(typeMeta[type].defaultMarks);
    }
  }

  function activateEnglishTypeField(value: string) {
    const parsed = parseEnglishTypeField(value);
    if (!parsed) return;

    if (hasChapterPlan()) {
      activateTypeWithPlan(parsed.type);
      setEnglishField(parsed.field);
      return;
    }

    setActiveType(parsed.type);
    setRequiredCount("");
    setMarksPerQuestion(typeMeta[parsed.type].defaultMarks);
    setAttemptCount("");
    setEnglishField(parsed.field);
    setPool([]);
    setPoolTotal(0);
    setDraftSelected([]);
    setPoolView("browse");
  }

  function parsedRequired() {
    return typeof requiredCount === "number" ? requiredCount : 0;
  }
  function parsedMarks() {
    return typeof marksPerQuestion === "number" ? marksPerQuestion : 0;
  }
  function parsedAttempt() {
    return typeof attemptCount === "number" ? attemptCount : 0;
  }

  function updateChapterPlan(
    chapterId: string,
    type: QType,
    value: number | "",
  ) {
    setChapterPlan((prev) =>
      prev.map((item) =>
        item.chapterId !== chapterId
          ? item
          : {
              ...item,
              ...(type === "MCQ"
                ? { mcqCount: value }
                : type === "SHORT"
                  ? { shortCount: value }
                  : { longCount: value }),
            },
      ),
    );
  }

  function clearChapterPlan() {
    setChapterPlan((prev) =>
      prev.map((item) => ({
        ...item,
        mcqCount: "",
        shortCount: "",
        longCount: "",
      })),
    );
  }

  function autofillChapterPlan() {
    const topicSet = new Set(selectedTopicIds);
    setChapterPlan(
      selectedChapters.map((chapter) => {
        const available = chapterTypeTotals(chapter, topicSet);
        return {
          chapterId: chapter.id,
          mcqCount: available.MCQ > 0 ? 1 : "",
          shortCount: available.SHORT > 0 ? 1 : "",
          longCount: available.LONG > 0 ? 1 : "",
        };
      }),
    );
  }

  function validateChapterPlan() {
    if (chapterPlanRows.length === 0) {
      return "Select at least one chapter first.";
    }
    if (plannerQuestionTotal === 0) {
      return "Enter the required question counts for each chapter and type.";
    }
    for (const row of chapterPlanRows) {
      if (row.requested.MCQ > row.available.MCQ) {
        return `${row.chapter.name}: MCQ available ${row.available.MCQ} hain`;
      }
      if (row.requested.SHORT > row.available.SHORT) {
        return `${row.chapter.name}: Short available ${row.available.SHORT} hain`;
      }
      if (row.requested.LONG > row.available.LONG) {
        return `${row.chapter.name}: Long available ${row.available.LONG} hain`;
      }
    }
    return null;
  }

  function selectBoard(id: string) {
    setBoardId(id);
    setClassId(null);
    setSubjectId(null);
    setSelectedChapterIds([]);
    setSelectedTopicIds([]);
    resetBuildState();
    goToStep("class");
  }

  function selectClass(id: string) {
    setClassId(id);
    setSubjectId(null);
    setSelectedChapterIds([]);
    setSelectedTopicIds([]);
    resetBuildState();
    goToStep("subject");
  }

  function selectSubject(id: string) {
    setSubjectId(id);
    setSelectedChapterIds([]);
    setSelectedTopicIds([]);
    resetBuildState();
    setTitle("");
    goToStep("chapters");
  }

  function toggleChapter(chapterId: string) {
    const chapter = chapters.find((c) => c.id === chapterId);
    if (!chapter) return;
    const isSelected = selectedChapterIds.includes(chapterId);
    if (isSelected) {
      setSelectedChapterIds((prev) => prev.filter((id) => id !== chapterId));
      const topicIds = new Set(chapter.topics.map((t) => t.id));
      setSelectedTopicIds((prev) => prev.filter((id) => !topicIds.has(id)));
    } else {
      setSelectedChapterIds((prev) => [...prev, chapterId]);
      setSelectedTopicIds((prev) => {
        const next = new Set(prev);
        for (const t of chapter.topics) next.add(t.id);
        return [...next];
      });
    }
  }

  function toggleTopic(topicId: string, chapterId: string) {
    setSelectedTopicIds((prev) => {
      const exists = prev.includes(topicId);
      const next = exists ? prev.filter((id) => id !== topicId) : [...prev, topicId];
      const chapter = chapters.find((c) => c.id === chapterId);
      if (chapter) {
        const anySelected = chapter.topics.some((t) => next.includes(t.id));
        setSelectedChapterIds((chaptersPrev) => {
          if (anySelected && !chaptersPrev.includes(chapterId)) {
            return [...chaptersPrev, chapterId];
          }
          if (!anySelected) return chaptersPrev.filter((id) => id !== chapterId);
          return chaptersPrev;
        });
      }
      return next;
    });
  }

  function selectAllChapters() {
    setSelectedChapterIds(chapters.map((c) => c.id));
    setSelectedTopicIds(chapters.flatMap((c) => c.topics.map((t) => t.id)));
  }

  function clearChapters() {
    setSelectedChapterIds([]);
    setSelectedTopicIds([]);
  }

  function toggleSectionChapter(chapterId: string) {
    setSectionChapterIds((prev) =>
      prev.includes(chapterId)
        ? prev.filter((id) => id !== chapterId)
        : [...prev, chapterId],
    );
    setPool([]);
    setDraftSelected([]);
    setPoolView("browse");
  }

  function runSearch() {
    setError(null);
    setMessage(null);
    if (selectedTopicIds.length === 0) {
      setError("No topics selected");
      return;
    }
    if (sectionChapterIds.length === 0) {
      setError("Select at least one chapter");
      return;
    }
    startTransition(async () => {
      try {
        const result = await searchQuestionPool({
          topicIds: selectedTopicIds,
          type: activeType,
          chapterIds: sectionChapterIds,
          excludeIds: [...usedQuestionIds],
          source: isEnglishSubject ? "ALL" : sourceFilter,
          englishField: isEnglishSubject ? englishField : "ALL",
          medium,
        });
        setPool(result.questions);
        setPoolTotal(result.total);
        setDraftSelected([]);
        setPoolView("browse");
        setMessage(
          result.total === 0
            ? `No ${TYPE_META[activeType].short} found`
            : `${result.total} ${TYPE_META[activeType].short} available`,
        );
      } catch (err) {
        setError(err instanceof Error ? err.message : "Search failed");
      }
    });
  }

  function runSelectRandom() {
    setError(null);
    setMessage(null);
    const need = parsedRequired();
    if (need < 1) {
      setError("Enter the required number of questions.");
      return;
    }
    if (parsedMarks() < 1) {
      setError("Enter marks for each question.");
      return;
    }
    if (sectionChapterIds.length === 0) {
      setError("Select at least one chapter");
      return;
    }

    const quotas = hasChapterPlan()
      ? chapterQuotasForType(activeType).filter((q) =>
          sectionChapterIds.includes(q.chapterId),
        )
      : [];

    if (hasChapterPlan()) {
      const plannedTotal = quotas.reduce((sum, q) => sum + q.count, 0);
      if (plannedTotal !== need) {
        setError(
          `The planner requires ${need} ${TYPE_META[activeType].short}. Random select will use that count.`,
        );
      }
      if (plannedTotal < 1) {
        setError(`No chapter quota is set for this question type in the planner.`);
        return;
      }
    }

    startTransition(async () => {
      try {
        const result = await pickRandomQuestions({
          topicIds: selectedTopicIds,
          type: activeType,
          count: hasChapterPlan()
            ? quotas.reduce((sum, q) => sum + q.count, 0)
            : need,
          chapterIds: sectionChapterIds,
          chapterQuotas: quotas.length > 0 ? quotas : undefined,
          excludeIds: [...usedQuestionIds],
          mode: "BALANCED",
          source: isEnglishSubject ? "ALL" : sourceFilter,
          englishField: isEnglishSubject ? englishField : "ALL",
          medium,
        });
        setPool(result.questions);
        setPoolTotal(result.questions.length);
        setDraftSelected(result.questions);
        setPoolView("selected");
        if (hasChapterPlan()) {
          setRequiredCount(result.questions.length);
        }
        setMessage(
          result.questions.length === 0
            ? "Not enough questions for random pick"
            : hasChapterPlan()
              ? `Random · planner quotas applied · ${result.questions.length} questions`
              : `Random selected · ${result.questions.length} questions`,
        );
      } catch (err) {
        setError(err instanceof Error ? err.message : "Random select failed");
      }
    });
  }

  function toggleDraftQuestion(question: PoolQuestionCard) {
    const need = parsedRequired();
    if (need < 1) {
      setError("Enter the required number of questions first.");
      return;
    }
    setDraftSelected((prev) => {
      const exists = prev.some((q) => q.id === question.id);
      if (exists) return prev.filter((q) => q.id !== question.id);

      if (prev.length >= need) {
        setError(`Required count is ${need}. Uncheck one to replace.`);
        return prev;
      }

      if (hasChapterPlan()) {
        const quota = plannedQuotaForChapter(question.chapterId, activeType) ?? 0;
        const fromChapter = prev.filter((q) => q.chapterId === question.chapterId).length;
        if (fromChapter >= quota) {
          const chapterName =
            chapters.find((c) => c.id === question.chapterId)?.name ?? "Chapter";
          setError(
            `${chapterName}: you can select up to ${quota} ${TYPE_META[activeType].short} (planner limit).`,
          );
          return prev;
        }
      }

      setError(null);
      return [...prev, question];
    });
  }

  function replaceOneQuestion(question: PoolQuestionCard) {
    setError(null);
    setMessage(null);
    const excludeIds = [
      ...usedQuestionIds,
      ...draftSelected.map((q) => q.id),
    ];

    startTransition(async () => {
      try {
        const result = await pickRandomQuestions({
          topicIds: selectedTopicIds,
          type: activeType,
          count: 1,
          chapterIds: [question.chapterId],
          chapterQuotas: [{ chapterId: question.chapterId, count: 1 }],
          excludeIds,
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
        setPoolView("selected");
        setMessage("1 question replaced.");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Replace failed");
      }
    });
  }

  function replacePaperQuestion(sectionType: QType, questionId: string) {
    if (manualEditMode) return;
    const section = paperSections.find((s) => s.type === sectionType);
    const current = section?.questions.find((q) => q.id === questionId);
    if (!current) return;

    setError(null);
    setMessage(null);
    startTransition(async () => {
      try {
        const result = await pickRandomQuestions({
          topicIds: selectedTopicIds,
          type: sectionType,
          count: 1,
          chapterIds: [current.chapterId],
          chapterQuotas: [{ chapterId: current.chapterId, count: 1 }],
          excludeIds: [...usedQuestionIds],
          mode: "RANDOM",
          source: isEnglishSubject ? "ALL" : sourceFilter,
          englishField: isEnglishSubject ? englishField : "ALL",
          medium,
        });
        const replacement = result.questions[0];
        if (!replacement) {
          setError("No other question is available to replace with.");
          return;
        }
        setPaperSections((prev) =>
          prev.map((s) =>
            s.type !== sectionType
              ? s
              : {
                  ...s,
                  questions: s.questions.map((q) =>
                    q.id === questionId ? replacement : q,
                  ),
                },
          ),
        );
        setMessage("Question replaced.");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Replace failed");
      }
    });
  }

  function addSectionToPaper() {
    setError(null);
    const need = parsedRequired();
    const marks = parsedMarks();
    const attempt = parsedAttempt();
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

    if (hasChapterPlan()) {
      for (const quota of chapterQuotasForType(activeType)) {
        const picked = draftSelected.filter((q) => q.chapterId === quota.chapterId).length;
        if (picked !== quota.count) {
          const chapterName =
            chapters.find((c) => c.id === quota.chapterId)?.name ?? "Chapter";
          setError(
            `${chapterName}: ${quota.count} ${TYPE_META[activeType].short} required; ${picked} currently selected.`,
          );
          return;
        }
      }
    }

    const existing = paperSections.find((s) => s.type === activeType);
    if (existing) {
      const ok = window.confirm(
        `A ${TYPE_META[activeType].label} section is already on this paper (${existing.questions.length} questions). Replace it?`,
      );
      if (!ok) return;
    }

    setPaperSections((prev) => {
      const without = prev.filter((s) => s.type !== activeType);
      return [
        ...without,
        {
          type: activeType,
          attemptCount: attempt > 0 && attempt < draftSelected.length ? attempt : 0,
          marksEach: marks,
          questions: draftSelected,
        },
      ].sort((a, b) => {
        const order = { MCQ: 0, SHORT: 1, LONG: 2 };
        return order[a.type] - order[b.type];
      });
    });

    const addedLabel = TYPE_META[activeType].label;
    const covered = new Set(
      [...paperSections.filter((s) => s.type !== activeType).map((s) => s.type), activeType],
    );
    const nextType =
      ALL_TYPES.find((t) => {
        if (covered.has(t)) return false;
        if (hasChapterPlan()) return plannedCountForType(t) > 0;
        return true;
      }) ?? null;

    resetPicker();
    if (nextType) {
      activateType(nextType);
      setMessage(
        `${addedLabel} added to the paper. Preview updated — select ${TYPE_META[nextType].label} next.`,
      );
    } else {
      setMessage(`${addedLabel} added. Paper is ready — check the preview or open View paper.`);
    }
    // Keep the picker open so the paper preview can update live behind it.
    setSelectionMode("manual");
  }

  function removeSection(type: QType) {
    setPaperSections((prev) => prev.filter((s) => s.type !== type));
    setMessage(`${TYPE_META[type].label} removed`);
  }

  function openSaveModal() {
    if (paperSections.length === 0) {
      setError("Add at least one section first (MCQ / Short / Long).");
      return;
    }
    if (scheduleContext?.testDate && !examDate) {
      setExamDate(scheduleContext.testDate);
    }
    if (scheduleContext?.scheduleName && !testType.trim()) {
      setTestType(scheduleContext.scheduleName);
    }
    if (!title.trim() && selectedSubject?.name) {
      setTitle(`${selectedSubject.name} Paper`);
    }
    setModalOpen(false);
    setError(null);
    setSaveModalOpen(true);
  }

  function savePaper() {
    setError(null);
    if (!subjectId) {
      setError("Subject missing");
      return;
    }
    if (!title.trim()) {
      setError("Enter a test name.");
      return;
    }
    if (!preparedBy.trim()) {
      setError("Enter the teacher name (Prepared by).");
      return;
    }
    const effectiveExamDate = examDate || scheduleContext?.testDate || "";
    if (!effectiveExamDate) {
      setError("Select an exam date.");
      return;
    }
    const duration = typeof durationMinutes === "number" ? durationMinutes : 0;
    if (duration < 5) {
      setError("Duration must be at least 5 minutes.");
      return;
    }
    if (paperSections.length === 0) {
      setError("Paper is empty");
      return;
    }

    startTransition(async () => {
      try {
        const result = await saveSectionBuiltTest({
          title,
          instructions: instructions || undefined,
          durationMinutes: duration,
          classSection: classSection || undefined,
          examDate: effectiveExamDate,
          preparedBy: preparedBy || undefined,
          paperCode: paperCode || undefined,
          examLabel: examLabel || undefined,
          syllabusNote: syllabusNote || derivedSyllabus || undefined,
          testType: testType || undefined,
          subjectId,
          assignmentId: scheduleContext?.assignmentId,
          mode: selectionMode === "random" ? "RANDOM" : "BALANCED",
          medium,
          sections: paperSections.map((s) => ({
            type: s.type,
            attemptCount: s.attemptCount || undefined,
            marksEach: s.marksEach,
            questionIds: s.questions.map((q) => q.id),
          })),
        });
        // Same destination as normal generate — Saved Papers list
        router.push("/teacher/tests");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Save failed");
      }
    });
  }

  function goBack() {
    if (step === "class") {
      setBoardId(null);
      goToStep("board");
    } else if (step === "subject") {
      setClassId(null);
      goToStep("class");
    } else if (step === "chapters") {
      if (lockedFromSchedule) {
        router.push("/teacher/schedules");
        return;
      }
      setSubjectId(null);
      setSelectedChapterIds([]);
      setSelectedTopicIds([]);
      goToStep("subject");
    } else if (step === "paper") {
      setModalOpen(false);
      setManualEditMode(false);
      if (questionsLocked) {
        setPaperSections([]);
        setSelectionMode(null);
        goToStep(isMultiChapter ? "workspace" : "chapters");
      } else if (isMultiChapter) {
        goToStep("workspace");
      } else {
        // Single chapter: Back → syllabus (not stuck on empty workspace)
        goToStep("chapters");
      }
    } else if (step === "workspace") {
      setModalOpen(false);
      setPaperSections([]);
      setSelectionMode(null);
      resetPicker();
      goToStep("chapters");
    }
  }

  function jumpTo(target: Step) {
    if (
      lockedFromSchedule &&
      (target === "board" || target === "class" || target === "subject")
    ) {
      return;
    }
    if (target === "board") {
      setBoardId(null);
      setClassId(null);
      setSubjectId(null);
      setSelectedChapterIds([]);
      setSelectedTopicIds([]);
      resetBuildState();
      goToStep("board");
      return;
    }
    if (target === "class" && boardId) {
      setClassId(null);
      setSubjectId(null);
      setSelectedChapterIds([]);
      setSelectedTopicIds([]);
      resetBuildState();
      goToStep("class");
      return;
    }
    if (target === "subject" && classId) {
      setSubjectId(null);
      setSelectedChapterIds([]);
      setSelectedTopicIds([]);
      resetBuildState();
      goToStep("subject");
      return;
    }
    if (target === "chapters" && subjectId) {
      setModalOpen(false);
      setPaperSections([]);
      setSelectionMode(null);
      resetPicker();
      goToStep("chapters");
    }
  }

  const examSections = paperSections.map((s) => ({
    type: s.type,
    title: TYPE_META[s.type].label,
    marksEach: s.marksEach,
    attemptCount: s.attemptCount || undefined,
    questions: s.questions.map((q) => ({
      id: q.id,
      text: q.text,
      textUrdu: q.textUrdu,
      optionA: q.optionA,
      optionB: q.optionB,
      optionC: q.optionC,
      optionD: q.optionD,
      correctAnswer: q.correctAnswer,
    })),
  }));

  if (boards.length === 0) {
    return (
      <PageStack>
        <PageHeader
          title="Generate Paper"
          description="No boards available yet. Ask Super Admin to add curriculum content."
        />
      </PageStack>
    );
  }

  return (
    <PageStack wide className="wizard-flow gap-4">
      {scheduleContext ? (
        <div className="rounded-[0.9rem] border border-[#f0d9a8] bg-[#fff8eb] px-4 py-3 text-sm text-[#8a5a00]">
          Creating paper for assigned schedule:{" "}
          <strong>{scheduleContext.scheduleName}</strong>. Subject is locked to the
          schedule.
        </div>
      ) : null}
      <div className={cn(step === "paper" && "pts-paper-sticky-chrome")}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="page-kicker">Generate paper</p>
            <h2 className="page-title">
              {step === "board"
                ? "Select Board"
                : step === "class"
                  ? "Select Class"
                  : step === "subject"
                    ? "Select Subject"
                    : step === "chapters"
                      ? "Select Syllabus"
                      : step === "paper"
                        ? "Paper Preview"
                        : isMultiChapter
                          ? "Chapter Distribution"
                          : "Select Questions"}
            </h2>
            {step === "board" ? (
              <p className="mt-1 max-w-xl text-sm text-muted">
                Choose the education board for this paper.
              </p>
            ) : null}
            {step === "class" ? (
              <p className="mt-1 max-w-xl text-sm text-muted">
                Pick the class level under{" "}
                <span className="font-semibold text-brand">
                  {selectedBoard?.name.replace(/ Board$/i, "")}
                </span>
                .
              </p>
            ) : null}
            {step === "subject" ? (
              <p className="mt-1 max-w-xl text-sm text-muted">
                Select the subject for{" "}
                <span className="font-semibold text-brand">
                  {selectedClass?.name}
                </span>
                .
              </p>
            ) : null}
            {selectedBoard ? (
              <div className="pts-crumb">
                {lockedFromSchedule ? (
                  <span>{selectedBoard.name.replace(/ Board$/i, "")}</span>
                ) : (
                  <button type="button" onClick={() => jumpTo("board")}>
                    {selectedBoard.name.replace(/ Board$/i, "")}
                  </button>
                )}
                {selectedClass ? (
                  <>
                    <span className="pts-crumb-sep">›</span>
                    {lockedFromSchedule ? (
                      <span>{selectedClass.name}</span>
                    ) : (
                      <button type="button" onClick={() => jumpTo("class")}>
                        {selectedClass.name}
                      </button>
                    )}
                  </>
                ) : null}
                {selectedSubject ? (
                  <>
                    <span className="pts-crumb-sep">›</span>
                    {lockedFromSchedule ? (
                      <span>{selectedSubject.name}</span>
                    ) : (
                      <button type="button" onClick={() => jumpTo("subject")}>
                        {selectedSubject.name}
                      </button>
                    )}
                  </>
                ) : null}
                {step === "chapters" || step === "workspace" || step === "paper" ? (
                  <>
                    <span className="pts-crumb-sep">›</span>
                    <button type="button" onClick={() => jumpTo("chapters")}>
                      Syllabus
                    </button>
                  </>
                ) : null}
                {step === "workspace" ? (
                  <>
                    <span className="pts-crumb-sep">›</span>
                    <span className="pts-crumb-current">
                      {isMultiChapter ? "Distribute" : "Build"}
                    </span>
                  </>
                ) : null}
                {step === "paper" ? (
                  <>
                    <span className="pts-crumb-sep">›</span>
                    <span className="pts-crumb-current">Paper</span>
                  </>
                ) : null}
              </div>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-2">
            {step !== "board" ? (
              <Button variant="outline" onClick={goBack} disabled={pending}>
                Back
              </Button>
            ) : null}
            {step === "workspace" && !isMultiChapter ? (
              <Button variant="outline" onClick={() => setModalOpen(true)} disabled={pending}>
                Add Questions
              </Button>
            ) : null}
            {step === "paper" ? (
              <>
                <div className="pts-medium-seg" role="group" aria-label="Question medium">
                  {MEDIUM_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      aria-pressed={medium === opt.value}
                      onClick={() => setMedium(opt.value)}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                {!questionsLocked ? (
                  <Button
                    variant="outline"
                    onClick={() => {
                      setManualEditMode(false);
                      setModalOpen(true);
                    }}
                    disabled={pending}
                  >
                    Edit Questions
                  </Button>
                ) : null}
                <Button
                  variant={showAnswerKey ? "default" : "outline"}
                  onClick={() => setShowAnswerKey((v) => !v)}
                  disabled={paperSections.length === 0}
                >
                  {showAnswerKey ? "Hide Key" : "Answer Key"}
                </Button>
                <Button
                  variant={manualEditMode ? "default" : "outline"}
                  onClick={() => setManualEditMode((v) => !v)}
                  disabled={pending || paperSections.length === 0}
                >
                  {manualEditMode ? "Done Editing" : "Manual Edit"}
                </Button>
                <Button onClick={openSaveModal} disabled={pending || paperSections.length === 0}>
                  Save Paper
                </Button>
              </>
            ) : null}
          </div>
        </div>

        {step === "paper" ? (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-[1rem] border border-[rgba(15,40,70,0.08)] bg-white px-4 py-3">
            <div className="flex flex-wrap gap-2 text-sm">
              <span className="rounded-lg bg-brand/10 px-2.5 py-1 font-semibold text-brand">
                {paperQuestionCount} questions
              </span>
              <span className="rounded-lg bg-[#eef2f6] px-2.5 py-1 font-semibold text-ink-soft">
                {paperMarks} marks
              </span>
              {paperSections.map((s) => (
                <span
                  key={s.type}
                  className="rounded-lg border border-[rgba(15,40,70,0.1)] bg-white px-2.5 py-1 font-medium"
                >
                  {TYPE_META[s.type].short}: {s.questions.length}
                </span>
              ))}
              {manualEditMode ? (
                <span className="rounded-lg bg-sky-50 px-2.5 py-1 text-xs font-semibold text-sky-800">
                  Editing on paper · change text then Done Editing
                </span>
              ) : questionsLocked ? (
                <span className="rounded-lg bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800">
                  Random paper · questions locked
                </span>
              ) : (
                <span className="rounded-lg bg-[#ecfdf5] px-2.5 py-1 text-xs font-semibold text-brand">
                  Manual paper · edit allowed
                </span>
              )}
            </div>
            <Button onClick={openSaveModal} disabled={pending || paperSections.length === 0}>
              Save Paper
            </Button>
          </div>
        ) : null}
      </div>

      {step !== "paper" ? (
        <nav className="pts-steps" aria-label="Paper generation steps">
          {WIZARD_STEPS.map((item, index) => {
            const currentIndex = WIZARD_STEPS.findIndex((s) => s.id === step);
            const state =
              index < currentIndex
                ? "done"
                : index === currentIndex
                  ? "current"
                  : "todo";
            return (
              <div key={item.id} className="pts-steps-item">
                {index > 0 ? <span className="pts-steps-line" aria-hidden /> : null}
                <span
                  className={cn(
                    "pts-steps-dot",
                    state === "done" && "pts-steps-dot--done",
                    state === "current" && "pts-steps-dot--current",
                  )}
                >
                  {index + 1}
                </span>
                <span
                  className={cn(
                    "pts-steps-label",
                    state === "current" && "pts-steps-label--current",
                    state === "todo" && "pts-steps-label--todo",
                  )}
                >
                  {item.label}
                </span>
              </div>
            );
          })}
        </nav>
      ) : null}

      {/* BOARD */}
      {step === "board" ? (
        <div className="pts-choice-grid pts-choice-grid--boards">
          {boards.map((board) => (
              <button
                key={board.id}
                type="button"
                className="pts-choice-card pts-choice-card--board"
                onClick={() => selectBoard(board.id)}
              >
                <span className="pts-choice-icon" aria-hidden>
                  <Library className="h-5 w-5" />
                </span>
                <span className="pts-choice-body">
                  <span className="pts-choice-title">
                    {board.name.replace(/ Board$/i, "")}
                  </span>
                </span>
                <ChevronRight className="pts-choice-chevron" aria-hidden />
              </button>
          ))}
        </div>
      ) : null}

      {/* CLASS */}
      {step === "class" && selectedBoard ? (
        selectedBoard.classes.length === 0 ? (
          <p className="text-sm text-muted">No classes found for this board.</p>
        ) : (
          <div className="pts-choice-grid pts-choice-grid--classes">
            {selectedBoard.classes.map((klass) => (
                <button
                  key={klass.id}
                  type="button"
                  className="pts-choice-card"
                  onClick={() => selectClass(klass.id)}
                >
                  <span className="pts-choice-badge" aria-hidden>
                    {shortClassBadge(klass.name)}
                  </span>
                  <span className="pts-choice-body">
                    <span className="pts-choice-title">{klass.name}</span>
                  </span>
                  <ChevronRight className="pts-choice-chevron" aria-hidden />
                </button>
            ))}
          </div>
        )
      ) : null}

      {/* SUBJECT */}
      {step === "subject" && selectedClass ? (
        selectedClass.subjects.length === 0 ? (
          <p className="text-sm text-muted">No subjects found for this class.</p>
        ) : (
          <div className="pts-choice-grid pts-choice-grid--subjects">
            {selectedClass.subjects.map((subject) => {
              const Icon = subjectIconFor(subject.name);
              return (
                <button
                  key={subject.id}
                  type="button"
                  className="pts-choice-card"
                  onClick={() => selectSubject(subject.id)}
                >
                  <span className="pts-choice-icon pts-choice-icon--soft" aria-hidden>
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="pts-choice-body">
                    <span className="pts-choice-title">{subject.name}</span>
                  </span>
                  <ChevronRight className="pts-choice-chevron" aria-hidden />
                </button>
              );
            })}
          </div>
        )
      ) : null}

      {/* CHAPTERS */}
      {step === "chapters" ? (
        <>
          <div className="pts-syllabus-toolbar">
            <label className="flex min-w-0 flex-1 items-center gap-2.5 text-sm font-semibold text-ink">
              <input
                type="checkbox"
                checked={
                  chapters.length > 0 && selectedChapterIds.length === chapters.length
                }
                onChange={(e) => {
                  if (e.target.checked) selectAllChapters();
                  else clearChapters();
                }}
              />
              Select all chapters
            </label>
            <Button variant="outline" size="sm" onClick={clearChapters}>
              Clear
            </Button>
          </div>

          <div className="pts-chapter-grid">
            {chapters.map((chapter) => {
              const checked = selectedChapterIds.includes(chapter.id);
              const selectedTopicsInChapter = chapter.topics.filter((topic) =>
                selectedTopicIds.includes(topic.id),
              ).length;
              return (
                <div
                  key={chapter.id}
                  className={cn(
                    "pts-chapter-card",
                    checked && "pts-chapter-card--selected",
                  )}
                >
                  <label className="pts-chapter-card-head cursor-pointer">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleChapter(chapter.id)}
                    />
                    <span className="min-w-0">
                      <span className="pts-chapter-card-title">{chapter.name}</span>
                      <span className="pts-chapter-card-meta">
                        {chapter.topics.length} topics
                        {checked
                          ? ` · ${selectedTopicsInChapter} selected`
                          : ""}
                      </span>
                    </span>
                  </label>
                  {checked ? (
                    <div className="pts-chapter-topics nice-scroll">
                      {chapter.topics.map((topic) => (
                        <label key={topic.id} className="pts-chapter-topic cursor-pointer">
                          <input
                            type="checkbox"
                            checked={selectedTopicIds.includes(topic.id)}
                            onChange={() => toggleTopic(topic.id, chapter.id)}
                          />
                          <span className="min-w-0">{topic.name}</span>
                        </label>
                      ))}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>

          <WizardActionBar
            summary={
              <>
                <strong className="font-semibold text-ink">
                  {selectedChapterIds.length}
                </strong>{" "}
                chapters ·{" "}
                <strong className="font-semibold text-ink">
                  {selectedTopicIds.length}
                </strong>{" "}
                topics
                {selectedChapterIds.length > 1
                  ? " · distribution planner next"
                  : " · question picker next"}
              </>
            }
          >
            <Button
              onClick={openWorkspace}
              disabled={selectedTopicIds.length === 0}
              className="min-w-[10rem]"
            >
              {selectedChapterIds.length > 1
                ? "Continue → Distribution"
                : "Continue → Select Questions"}
            </Button>
          </WizardActionBar>
        </>
      ) : null}

      {/* WORKSPACE */}
      {step === "workspace" ? (
        <div className="space-y-4">
          {isMultiChapter && !modalOpen ? (
            <Card className="chart-card">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <CardTitle>Chapter-wise Distribution Planner</CardTitle>
                  <CardDescription className="mt-1">
                    Set how many MCQ, Short, and Long questions you need from each chapter. Next opens the question picker — search manually or use Random Select.
                  </CardDescription>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="outline" onClick={autofillChapterPlan}>
                    Auto fill evenly
                  </Button>
                  <Button type="button" variant="outline" onClick={clearChapterPlan}>
                    Clear all
                  </Button>
                </div>
              </div>

              <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
                <div className="overflow-x-auto rounded-[1rem] border border-[rgba(15,40,70,0.08)]">
                  <table className="w-full min-w-[760px] text-left text-sm">
                    <thead className="bg-[#f8fafc] text-xs uppercase tracking-wide text-muted">
                      <tr>
                        <th className="px-4 py-3 font-semibold">Chapter</th>
                        <th className="px-4 py-3 font-semibold">MCQ</th>
                        <th className="px-4 py-3 font-semibold">Short</th>
                        <th className="px-4 py-3 font-semibold">Long</th>
                        <th className="px-4 py-3 font-semibold">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {chapterPlanRows.map((row) => (
                        <tr
                          key={row.chapter.id}
                          className="border-t border-[rgba(15,40,70,0.06)] bg-white align-top"
                        >
                          <td className="px-4 py-3">
                            <p className="font-semibold text-ink">{row.chapter.name}</p>
                            <p className="mt-1 text-xs text-muted">
                              {row.chapter.topics.filter((topic) =>
                                selectedTopicIds.includes(topic.id),
                              ).length}{" "}
                              selected topics
                            </p>
                          </td>
                          <td className="px-4 py-3">
                            <Input
                              type="number"
                              min={0}
                              max={row.available.MCQ}
                              value={row.requested.MCQ}
                              disabled={row.available.MCQ === 0}
                              onChange={(e) =>
                                updateChapterPlan(
                                  row.chapter.id,
                                  "MCQ",
                                  e.target.value === ""
                                    ? ""
                                    : Math.min(
                                        row.available.MCQ,
                                        Math.max(0, Number(e.target.value)),
                                      ),
                                )
                              }
                              className="h-10 min-w-[92px]"
                            />
                          </td>
                          <td className="px-4 py-3">
                            <Input
                              type="number"
                              min={0}
                              max={row.available.SHORT}
                              value={row.requested.SHORT}
                              disabled={row.available.SHORT === 0}
                              onChange={(e) =>
                                updateChapterPlan(
                                  row.chapter.id,
                                  "SHORT",
                                  e.target.value === ""
                                    ? ""
                                    : Math.min(
                                        row.available.SHORT,
                                        Math.max(0, Number(e.target.value)),
                                      ),
                                )
                              }
                              className="h-10 min-w-[92px]"
                            />
                          </td>
                          <td className="px-4 py-3">
                            <Input
                              type="number"
                              min={0}
                              max={row.available.LONG}
                              value={row.requested.LONG}
                              disabled={row.available.LONG === 0}
                              onChange={(e) =>
                                updateChapterPlan(
                                  row.chapter.id,
                                  "LONG",
                                  e.target.value === ""
                                    ? ""
                                    : Math.min(
                                        row.available.LONG,
                                        Math.max(0, Number(e.target.value)),
                                      ),
                                )
                              }
                              className="h-10 min-w-[92px]"
                            />
                          </td>
                          <td className="px-4 py-3">
                            <span className="font-semibold text-ink">{row.total}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="space-y-3">
                  <div className="rounded-[1rem] border border-[rgba(15,40,70,0.08)] bg-[#f8fafc] p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                      Planner Summary
                    </p>
                    <div className="mt-3 space-y-2 text-sm">
                      <div className="flex items-center justify-between">
                        <span>MCQs</span>
                        <span className="font-semibold">{plannerTotals.MCQ}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Short</span>
                        <span className="font-semibold">{plannerTotals.SHORT}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Long</span>
                        <span className="font-semibold">{plannerTotals.LONG}</span>
                      </div>
                      <div className="flex items-center justify-between border-t border-[rgba(15,40,70,0.08)] pt-2">
                        <span>Total Questions</span>
                        <span className="font-semibold">{plannerQuestionTotal}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Estimated Marks</span>
                        <span className="font-semibold">{plannerEstimatedMarks}</span>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-[1rem] border border-[rgba(15,40,70,0.08)] bg-white p-4 space-y-3 hidden md:block">
                    <p className="text-sm text-muted">
                      Next opens the question picker. Required counts are prefilled from the planner. Manual selection respects each chapter’s limit. Random Select also follows the planner counts.
                    </p>
                    <Button
                      type="button"
                      className="w-full"
                      onClick={openPickerFromPlanner}
                      disabled={pending || plannerQuestionTotal === 0}
                    >
                      Next → Select Questions
                    </Button>
                  </div>
                </div>
              </div>

              <WizardActionBar
                summary={
                  <>
                    Planner:{" "}
                    <strong className="font-semibold text-ink">
                      {plannerQuestionTotal}
                    </strong>{" "}
                    questions ·{" "}
                    <strong className="font-semibold text-ink">
                      {plannerEstimatedMarks}
                    </strong>{" "}
                    marks
                  </>
                }
              >
                <Button
                  type="button"
                  onClick={openPickerFromPlanner}
                  disabled={pending || plannerQuestionTotal === 0}
                  className="min-w-[10rem]"
                >
                  Next → Select Questions
                </Button>
              </WizardActionBar>
            </Card>
          ) : !modalOpen ? (
            <Card className="border-dashed">
              <CardTitle>Select questions</CardTitle>
              <CardDescription className="mt-1">
                A single chapter is selected, so the planner is not needed. Use the question picker to choose MCQ, Short, and Long questions.
              </CardDescription>
              <div className="mt-4 hidden flex-wrap gap-2 md:flex">
                <Button
                  onClick={() => {
                    setModalOpen(true);
                    goToStep("paper");
                  }}
                >
                  Open Question Picker
                </Button>
                {paperSections.length > 0 ? (
                  <Button variant="outline" onClick={goToPaperView}>
                    View Paper →
                  </Button>
                ) : null}
              </div>
              {paperSections.length > 0 ? (
                <p className="mt-3 text-sm text-muted">
                  {paperQuestionCount} questions ready · {paperMarks} marks
                </p>
              ) : null}

              <WizardActionBar
                summary={
                  paperSections.length > 0
                    ? `${paperQuestionCount} questions ready · ${paperMarks} marks`
                    : "Open the question picker to build your paper."
                }
              >
                <Button
                  onClick={() => {
                    setModalOpen(true);
                    goToStep("paper");
                  }}
                >
                  Open Question Picker
                </Button>
                {paperSections.length > 0 ? (
                  <Button variant="outline" onClick={goToPaperView}>
                    View Paper
                  </Button>
                ) : null}
              </WizardActionBar>
            </Card>
          ) : null}
        </div>
      ) : null}

      {/* PAPER ONLY PAGE */}
      {step === "paper" ? (
        <div className="space-y-4">
          <ExamPaperSheet
            meta={paperMeta}
            sections={examSections}
            medium={medium}
            editable={manualEditMode}
            showAnswerKey={showAnswerKey}
            onQuestionChange={updatePaperQuestion}
            onReplaceQuestion={
              manualEditMode
                ? undefined
                : (sectionType, questionId) =>
                    replacePaperQuestion(sectionType, questionId)
            }
            replaceDisabled={pending}
          />
        </div>
      ) : null}

      {/* SAVE MODAL */}
      {saveModalOpen ? (
        <div className="pts-modal-backdrop" role="dialog" aria-modal="true">
          <div className="flex flex-col overflow-hidden rounded-2xl bg-white shadow-2xl" style={{ width: "min(520px, 95vw)", maxHeight: "calc(100dvh - 2rem)" }}>
            <div className="flex items-center justify-between gap-3 bg-gradient-to-r from-[#1a3350] to-[#0f766e] px-5 py-4 text-white">
              <div>
                <p className="text-xs font-medium text-white/70">Save Paper</p>
                <h3 className="text-base font-bold">Fill paper details</h3>
              </div>
              <button
                type="button"
                className="rounded-lg bg-white/15 px-3 py-1.5 text-sm font-semibold hover:bg-white/25"
                onClick={() => setSaveModalOpen(false)}
              >
                Close
              </button>
            </div>

            <div className="nice-scroll flex-1 space-y-4 overflow-y-auto p-5">
              <label className="block text-sm font-semibold text-ink">
                Paper name <span className="text-red-500">*</span>
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
                    Same paper for multiple sections? Write them here, e.g. Red, A or Red + A
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
                        e.target.value === "" ? "" : Math.max(0, Number(e.target.value)),
                      )
                    }
                  />
                </label>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="block text-sm font-semibold text-ink">
                  Paper code
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
                  value={syllabusNote || derivedSyllabus}
                  onChange={(e) => setSyllabusNote(e.target.value)}
                  placeholder="CHAP 4"
                />
              </label>
              <label className="block text-sm font-semibold text-ink">
                Test type
                <Input
                  className="mt-1.5 h-11"
                  value={testType}
                  onChange={(e) => setTestType(e.target.value)}
                  placeholder="e.g. Half Book, Unit Test, Monthly Test"
                />
              </label>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="block text-sm font-semibold text-ink">
                  Exam date <span className="text-red-500">*</span>
                  <Input
                    className="mt-1.5 h-11"
                    type="date"
                    value={examDate || scheduleContext?.testDate || ""}
                    onChange={(e) => setExamDate(e.target.value)}
                    disabled={lockedFromSchedule}
                    readOnly={lockedFromSchedule}
                  />
                  {lockedFromSchedule ? (
                    <span className="mt-1 block text-xs font-medium text-muted">
                      Locked to schedule test date — cannot be changed.
                    </span>
                  ) : null}
                </label>
                <label className="block text-sm font-semibold text-ink">
                  Prepared by <span className="text-red-500">*</span>
                  <Input
                    className="mt-1.5 h-11"
                    value={preparedBy}
                    onChange={(e) => setPreparedBy(e.target.value)}
                  />
                </label>
              </div>
              <label className="block text-sm font-semibold text-ink">
                Instructions (optional)
                <textarea
                  className="mt-1.5 min-h-20 w-full rounded-xl border border-[rgba(15,40,70,0.12)] bg-white px-3 py-2.5 text-sm"
                  value={instructions}
                  onChange={(e) => setInstructions(e.target.value)}
                  placeholder="Leave blank to use the default instructions"
                />
              </label>

              {error ? (
                <p className="text-sm font-medium text-red-700">{error}</p>
              ) : null}
            </div>

            <div className="flex items-center justify-between gap-3 border-t border-[rgba(15,40,70,0.1)] bg-[#f8fafc] px-5 py-3">
              <p className="text-sm font-semibold text-ink">
                Total marks: {paperMarks}
              </p>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setSaveModalOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={savePaper} disabled={pending}>
                  {pending ? "Saving…" : "Save Paper"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {error ? <p className="text-sm font-medium text-red-700">{error}</p> : null}
      {message && !error ? (
        <p className="text-sm font-medium text-brand">{message}</p>
      ) : null}

      {/* QUESTION PICKER MODAL — opens over Paper Preview */}
      {step === "paper" && modalOpen ? (
        <div className="pts-modal-backdrop pts-modal-backdrop-paper" role="dialog" aria-modal="true">
          <div className="pts-modal">
            <div className="pts-modal-header">
              <div>
                <p className="text-xs font-medium text-white/80">Select Your Questions Here</p>
                <h3 className="text-base font-bold">
                  {selectedClass?.name} — {selectedSubject?.name}
                </h3>
              </div>
              <button
                type="button"
                className="rounded-lg bg-white/15 px-3 py-1.5 text-sm font-semibold hover:bg-white/25"
                onClick={() => setModalOpen(false)}
              >
                Close
              </button>
            </div>

            {/* Chapters selection strip - top blue area */}
            <div className="bg-gradient-to-r from-[#1a3350] to-[#0f766e] px-4 py-3">
              <p className="mb-2 text-xs font-bold uppercase tracking-wider text-white/70">
                {hasChapterPlan()
                  ? `Chapters for ${TYPE_META[activeType].short} (planner quotas)`
                  : "Chapters for this section"}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {chapters
                  .filter((c) => selectedChapterIds.includes(c.id))
                  .map((c) => {
                    const quota = hasChapterPlan()
                      ? plannedQuotaForChapter(c.id, activeType)
                      : null;
                    const picked = draftSelected.filter((q) => q.chapterId === c.id).length;
                    const enabled =
                      !hasChapterPlan() || (quota !== null && quota > 0);
                    return (
                      <button
                        key={c.id}
                        type="button"
                        disabled={hasChapterPlan() && !enabled}
                        onClick={() => {
                          if (hasChapterPlan()) return;
                          toggleSectionChapter(c.id);
                        }}
                        className={cn(
                          "rounded-lg px-3 py-1.5 text-xs font-semibold transition-all",
                          sectionChapterIds.includes(c.id) && enabled
                            ? "bg-white text-[#1a3350] shadow-sm"
                            : "bg-white/15 text-white/80",
                          hasChapterPlan() && !enabled && "opacity-40",
                        )}
                      >
                        {c.name.replace(/^(\d+\.\s*)/, "Ch ")}
                      </button>
                    );
                  })}
              </div>
            </div>

            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4 sm:p-5">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <label className="text-xs font-semibold text-muted">
                  Question type
                  {isEnglishSubject ? (
                    <select
                      className="mt-1 h-10 w-full rounded-xl border border-[rgba(15,40,70,0.12)] bg-white px-3 text-sm"
                      value={englishTypeFieldValue}
                      onChange={(e) => activateEnglishTypeField(e.target.value)}
                    >
                      {ENGLISH_QUESTION_TYPE_OPTIONS.filter(
                        (opt) =>
                          !hasChapterPlan() || plannedCountForType(opt.type) > 0,
                      ).map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <select
                      className="mt-1 h-10 w-full rounded-xl border border-[rgba(15,40,70,0.12)] bg-white px-3 text-sm"
                      value={activeType}
                      onChange={(e) => activateType(e.target.value as QType)}
                    >
                      {ALL_TYPES.filter(
                        (t) => !hasChapterPlan() || plannedCountForType(t) > 0,
                      ).map((t) => (
                        <option key={t} value={t}>
                          {TYPE_META[t].label} ({TYPE_META[t].urdu})
                        </option>
                      ))}
                    </select>
                  )}
                </label>
                <label className="text-xs font-semibold text-muted">
                  Medium
                  <div className="pts-medium-seg mt-1 w-full">
                    {MEDIUM_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        aria-pressed={medium === opt.value}
                        onClick={() => {
                          setMedium(opt.value);
                          setPool([]);
                          setDraftSelected([]);
                        }}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </label>
                {isEnglishSubject ? null : (
                  <label className="text-xs font-semibold text-muted">
                    Source
                    <select
                      className="mt-1 h-10 w-full rounded-xl border border-[rgba(15,40,70,0.12)] bg-white px-3 text-sm"
                      value={sourceFilter}
                      onChange={(e) => {
                        setSourceFilter(e.target.value as QuestionSourceFilter);
                        setPool([]);
                        setDraftSelected([]);
                      }}
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
                    {parsedRequired() > 0 ? ` / ${parsedRequired()}` : ""}
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
                    readOnly={hasChapterPlan()}
                    onChange={(e) => {
                      if (hasChapterPlan()) return;
                      setRequiredCount(
                        e.target.value === "" ? "" : Math.max(0, Number(e.target.value)),
                      );
                    }}
                  />
                  {hasChapterPlan() ? (
                    <span className="mt-1 block text-[11px] text-muted">
                      Prefill from planner · chapter limits apply
                    </span>
                  ) : null}
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
                  <Input
                    className="mt-1"
                    type="number"
                    min={0}
                    value={attemptCount}
                    onChange={(e) =>
                      setAttemptCount(
                        e.target.value === "" ? "" : Math.max(0, Number(e.target.value)),
                      )
                    }
                  />
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
                    onClick={() => {
                      setDraftSelected([]);
                      setPoolView("browse");
                    }}
                  >
                    Clear selection
                  </Button>
                ) : null}
              </div>

              {visiblePool.length > 0 ? (
                <div className="overflow-hidden rounded-xl border border-[rgba(15,40,70,0.1)]">
                  <div className="bg-[#3b0764] px-3 py-2 text-xs font-bold tracking-wide text-white uppercase">
                    {TYPE_META[activeType].label}
                    {pending ? " · loading…" : ""}
                  </div>
                  <div className="max-h-[42vh] divide-y divide-[rgba(15,40,70,0.08)] overflow-y-auto">
                    {visiblePool.map((q, idx) => {
                      const selected = draftSelected.some((d) => d.id === q.id);
                      return (
                        <div
                          key={q.id}
                          className={cn(
                            "flex w-full gap-3 px-3 py-2.5 text-left transition-colors",
                            selected ? "bg-[#ecfdf5]" : "bg-white hover:bg-[#f8fafc]",
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
                <p className="rounded-xl border border-dashed border-[rgba(15,40,70,0.15)] bg-[#f8fafc] px-4 py-8 text-center text-sm text-muted">
                  {pending
                    ? "Questions load ho rahe hain…"
                    : message?.includes("No ")
                      ? "No questions match this filter. Change the type, source, or chapters and search again."
                      : "Click Search or Random Select first — matching questions will appear here."}
                </p>
              )}
            </div>

            <div className="pts-modal-footer">
              <p className="text-xs font-semibold text-ink">
                Selected {draftSelected.length}
                {parsedRequired() > 0 ? ` / ${parsedRequired()}` : ""} ·{" "}
                <span className="font-normal text-muted">
                  The paper preview updates after you add questions.
                </span>
              </p>
              <div className="pts-modal-footer-actions">
                <Button
                  variant="outline"
                  onClick={() => setModalOpen(false)}
                >
                  View paper
                </Button>
                <Button
                  onClick={addSectionToPaper}
                  disabled={pending || draftSelected.length === 0}
                >
                  Add Question&apos;s →
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </PageStack>
  );
}
