"use client";

import { useEffect, useMemo, useState, useTransition, type ReactNode } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DateField } from "@/components/ui/date-field";
import { SearchSelect } from "@/components/ui/search-select";
import { toast } from "@/components/ui/toast";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { PageHeader, PageStack } from "@/components/page-header";
import {
  ExamPaperSheet,
  type ExamQuestionPatch,
} from "@/components/exam-paper-sheet";
import { cn } from "@/lib/utils";
import { buildTopicUsage } from "@/lib/distribution/engine";
import { aggregateQuestionsMedium } from "@/lib/question-medium";
import { sectionTotalMarks } from "@/lib/paper-marks";
import { RichText } from "@/components/rich-text";
import {
  Atom,
  BookMarked,
  BookOpen,
  Brain,
  Briefcase,
  Calculator,
  ChevronDown,
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
  inferQuestionTypeMedium,
  type PoolQuestionCard,
  type QuestionMedium,
  type QuestionSourceFilter,
} from "./actions";
import {
  DEFAULT_ENGLISH_TYPE_FIELD,
  defaultEnglishFieldForType,
  defaultIslamiyatFieldForType,
  defaultTarjumaFieldForType,
  defaultUrduFieldForType,
  englishOptionsForCounts,
  englishTypeFieldSelectValue,
  isClass9EnglishClass,
  isEnglishSubjectName,
  isIntermediateEnglishClass,
  isIslamiyatSubjectName,
  isTarjumaSubjectName,
  isUrduSubjectName,
  islamiyatOptionsForCounts,
  islamiyatTypeFieldSelectValue,
  parseEnglishTypeField,
  parseIslamiyatTypeField,
  parseTarjumaTypeField,
  parseUrduTypeField,
  sumEnglishFieldCounts,
  tarjumaOptionsForCounts,
  tarjumaTypeFieldSelectValue,
  urduOptionsForCounts,
  urduTypeFieldSelectValue,
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
          countsByEnglishField?: Partial<Record<EnglishFieldFilter, number>>;
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
  { id: "paper", label: "Test" },
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
  const [mounted, setMounted] = useState(false);
  const [usePortal, setUsePortal] = useState(false);

  useEffect(() => {
    setMounted(true);
    const media = window.matchMedia("(max-width: 767px)");
    const sync = () => setUsePortal(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  const bar = (
    <div className="wizard-action-bar">
      <div className="wizard-action-bar-inner">
        <div className="wizard-action-bar-summary">{summary}</div>
        <div className="wizard-action-bar-actions">{children}</div>
      </div>
    </div>
  );

  return (
    <>
      <div className="wizard-action-spacer" aria-hidden />
      {mounted && usePortal ? createPortal(bar, document.body) : bar}
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
        className={cn("font-medium text-ink whitespace-pre-wrap", className)}
      />
    );
  }
  if (medium === "URDU") {
    return (
      <RichText
        as="p"
        value={textUrdu || text}
        dir="rtl"
        className={cn("font-medium text-ink whitespace-pre-wrap", className)}
      />
    );
  }
  const urduSide = textUrdu?.trim();
  const duplicate =
    !urduSide ||
    urduSide === "—" ||
    urduSide === text.trim();
  if (duplicate) {
    const looksUrdu = /[\u0600-\u06FF]/.test(text);
    return (
      <RichText
        as="p"
        value={textUrdu || text}
        dir={looksUrdu ? "rtl" : undefined}
        className={cn("font-medium text-ink whitespace-pre-wrap", className)}
      />
    );
  }
  return (
    <div className={cn("grid gap-x-6 gap-y-1 sm:grid-cols-2", className)}>
      <RichText
        as="p"
        value={text}
        className="font-medium text-ink whitespace-pre-wrap"
      />
      <RichText
        as="p"
        value={textUrdu || "—"}
        dir="rtl"
        className="font-medium text-ink whitespace-pre-wrap text-right"
      />
    </div>
  );
}

export function GenerateWizard({
  boards,
  hasTeachingAssignments = true,
  teacherName,
  organization,
  scheduleContext = null,
  testsRedirectPath = "/teacher/tests",
  schedulesRedirectPath = "/teacher/schedules",
  emptyStateDescription,
  systemDefaults = {
    durationMinutes: 60,
    mcqMarks: 1,
    shortMarks: 2,
    longMarks: 5,
  },
}: {
  boards: HierarchyBoard[];
  hasTeachingAssignments?: boolean;
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
  testsRedirectPath?: string;
  schedulesRedirectPath?: string;
  emptyStateDescription?: string;
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
  const [pickerFiltersOpen, setPickerFiltersOpen] = useState(true);
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
  const [message, setMessage] = useState<string | null>(null);

  /** Multi-chapter distribution planner — keep off for MVP picker flow. */
  const CHAPTER_PLANNER_ENABLED = false;
  const isMultiChapter = selectedChapterIds.length > 1;
  const useChapterPlanner = CHAPTER_PLANNER_ENABLED && isMultiChapter;
  const questionsLocked = selectionMode === "random";

  const selectedBoard = boards.find((b) => b.id === boardId);
  const selectedClass = selectedBoard?.classes.find((c) => c.id === classId);
  const selectedSubject = selectedClass?.subjects.find((s) => s.id === subjectId);
  const chapters = selectedSubject?.chapters ?? [];
  const isEnglishSubject = isEnglishSubjectName(selectedSubject?.name);
  const isUrduSubject = isUrduSubjectName(selectedSubject?.name);
  const isIslamiyatSubject = isIslamiyatSubjectName(selectedSubject?.name);
  const isTarjumaSubject = isTarjumaSubjectName(selectedSubject?.name);
  const usesPtsTypeFields =
    isEnglishSubject ||
    isUrduSubject ||
    isIslamiyatSubject ||
    isTarjumaSubject;
  const isIntermediateEnglish =
    isEnglishSubject && isIntermediateEnglishClass(selectedClass?.name);
  const isClass9English =
    isEnglishSubject && isClass9EnglishClass(selectedClass?.name);
  const selectedTopicIdSet = useMemo(
    () => new Set(selectedTopicIds),
    [selectedTopicIds],
  );
  /** Subject-wide field counts so type list stays stable across chapter selection. */
  const subjectTopicsFlat = useMemo(
    () => chapters.flatMap((chapter) => chapter.topics),
    [chapters],
  );
  const subjectTopicIdSet = useMemo(
    () => new Set(subjectTopicsFlat.map((t) => t.id)),
    [subjectTopicsFlat],
  );
  const subjectFieldCounts = useMemo(
    () =>
      usesPtsTypeFields
        ? sumEnglishFieldCounts(subjectTopicsFlat, subjectTopicIdSet)
        : {},
    [usesPtsTypeFields, subjectTopicsFlat, subjectTopicIdSet],
  );
  const availablePtsTypeOptions = useMemo(() => {
    if (isTarjumaSubject) {
      return tarjumaOptionsForCounts(subjectFieldCounts);
    }
    if (isIslamiyatSubject) {
      return islamiyatOptionsForCounts(subjectFieldCounts);
    }
    if (isUrduSubject) {
      return urduOptionsForCounts(subjectFieldCounts);
    }
    if (isEnglishSubject) {
      return englishOptionsForCounts(subjectFieldCounts, {
        intermediate: isIntermediateEnglish,
        class9: isClass9English,
      });
    }
    return [];
  }, [
    isTarjumaSubject,
    isIslamiyatSubject,
    isUrduSubject,
    isEnglishSubject,
    subjectFieldCounts,
    isIntermediateEnglish,
    isClass9English,
  ]);
  function firstPtsFieldForType(type: QType): EnglishFieldFilter {
    return (
      availablePtsTypeOptions.find((opt) => opt.type === type)?.field ??
      (isTarjumaSubject
        ? defaultTarjumaFieldForType(type)
        : isIslamiyatSubject
          ? defaultIslamiyatFieldForType(type)
          : isUrduSubject
            ? defaultUrduFieldForType(type)
            : defaultEnglishFieldForType(type, { class9: isClass9English }))
    );
  }
  const ptsTypeFieldValue = isTarjumaSubject
    ? tarjumaTypeFieldSelectValue(activeType, englishField)
    : isIslamiyatSubject
      ? islamiyatTypeFieldSelectValue(activeType, englishField)
      : isUrduSubject
        ? urduTypeFieldSelectValue(activeType, englishField)
        : englishTypeFieldSelectValue(activeType, englishField, {
            class9: isClass9English,
          });

  const pickerFilterSummary = useMemo(() => {
    const typeLabel = usesPtsTypeFields
      ? (availablePtsTypeOptions.find((opt) => opt.value === ptsTypeFieldValue)
          ?.label ?? TYPE_META[activeType].short)
      : TYPE_META[activeType].short;
    const sourceLabel =
      sourceFilter === "ALL"
        ? "All"
        : sourceFilter === "EXERCISE"
          ? "Exercise"
          : "Additional";
    const mediumLabel =
      medium === "ENGLISH" ? "English" : medium === "URDU" ? "Urdu" : "Dual";
    return [
      typeLabel,
      requiredCount !== "" ? `${requiredCount} req` : null,
      marksPerQuestion !== "" ? `${marksPerQuestion} mk` : null,
      sourceLabel,
      mediumLabel,
      attemptCount !== "" ? `any ${attemptCount}` : null,
    ]
      .filter(Boolean)
      .join(" · ");
  }, [
    activeType,
    attemptCount,
    availablePtsTypeOptions,
    ptsTypeFieldValue,
    usesPtsTypeFields,
    marksPerQuestion,
    medium,
    requiredCount,
    sourceFilter,
  ]);

  useEffect(() => {
    if (modalOpen) setPickerFiltersOpen(pool.length === 0);
  }, [modalOpen]);

  const usedQuestionIds = useMemo(
    () => new Set(paperSections.flatMap((s) => s.questions.map((q) => q.id))),
    [paperSections],
  );

  const paperQuestionCount = paperSections.reduce(
    (sum, s) => sum + s.questions.length,
    0,
  );
  const paperMarks = paperSections.reduce(
    (sum, s) =>
      sum +
      sectionTotalMarks({
        questionCount: s.questions.length,
        marksEach: s.marksEach,
        attemptCount: s.attemptCount,
      }),
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

  useEffect(() => {
    if (!usesPtsTypeFields || availablePtsTypeOptions.length === 0) return;
    const current = availablePtsTypeOptions.some(
      (opt) => opt.type === activeType && opt.field === englishField,
    );
    if (current) return;
    const fallback =
      availablePtsTypeOptions.find((opt) => opt.type === activeType) ??
      availablePtsTypeOptions[0];
    if (!fallback) return;
    setActiveType(fallback.type);
    setEnglishField(fallback.field);
  }, [
    usesPtsTypeFields,
    availablePtsTypeOptions,
    activeType,
    englishField,
  ]);

  const plannerEstimatedMarks =
    plannerTotals.MCQ * typeMeta.MCQ.defaultMarks +
    plannerTotals.SHORT * typeMeta.SHORT.defaultMarks +
    plannerTotals.LONG * typeMeta.LONG.defaultMarks;

  const paperMeta = {
    title: title || `${selectedSubject?.name ?? "Subject"} Test`,
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

  const poolByTopic = useMemo(() => {
    const groups: Array<{
      topicId: string;
      topicName: string;
      chapterName: string;
      questions: PoolQuestionCard[];
    }> = [];
    const index = new Map<string, (typeof groups)[number]>();
    for (const q of visiblePool) {
      let group = index.get(q.topicId);
      if (!group) {
        group = {
          topicId: q.topicId,
          topicName: q.topicName,
          chapterName: q.chapterName,
          questions: [],
        };
        index.set(q.topicId, group);
        groups.push(group);
      }
      group.questions.push(q);
    }
    return groups;
  }, [visiblePool]);

  function goToStep(next: Step) {
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
    setEnglishField(
      usesPtsTypeFields
        ? (availablePtsTypeOptions[0]?.field ?? DEFAULT_ENGLISH_TYPE_FIELD.field)
        : DEFAULT_ENGLISH_TYPE_FIELD.field,
    );
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
      toast.error("Select at least one chapter or topic");
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
    setMessage(null);

    // Skip planner (hidden): go straight to paper + question picker
    if (!useChapterPlanner || selectedChapterIds.length <= 1) {
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

    // Multi chapter: show distribution planner first (only if enabled)
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
      toast.error("Add at least one section first (MCQ / Short / Long).");
      return;
    }
    setModalOpen(false);
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
    return useChapterPlanner && chapterPlan.length > 0 && plannerQuestionTotal > 0;
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
    const field = firstPtsFieldForType(type);
    setActiveType(type);
    setRequiredCount(planned > 0 ? planned : "");
    setMarksPerQuestion(typeMeta[type].defaultMarks);
    setAttemptCount("");
    setEnglishField(field);
    setPool([]);
    setPoolTotal(0);
    setDraftSelected([]);
    setPoolView("browse");
    if (hasChapterPlan()) {
      const allowed = chapterQuotasForType(type).map((q) => q.chapterId);
      setSectionChapterIds(allowed.length > 0 ? allowed : [...selectedChapterIds]);
    }
    void syncMediumForType(type, field);
  }

  function openPickerFromPlanner() {
    const plannerError = validateChapterPlan();
    if (plannerError) {
      toast.error(plannerError);
      return;
    }

    const firstType =
      ALL_TYPES.find((type) => plannedCountForType(type) > 0) ?? "MCQ";

    setSelectionMode("manual");
    setPaperSections([]);
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
    const field = firstPtsFieldForType(type);
    setActiveType(type);
    setAttemptCount("");
    setEnglishField(field);
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
    void syncMediumForType(type, field);
  }

  function activatePtsTypeField(value: string) {
    const parsed = isTarjumaSubject
      ? parseTarjumaTypeField(value)
      : isIslamiyatSubject
        ? parseIslamiyatTypeField(value)
        : isUrduSubject
          ? parseUrduTypeField(value)
          : parseEnglishTypeField(value, { class9: isClass9English });
    if (!parsed) return;

    if (hasChapterPlan()) {
      activateTypeWithPlan(parsed.type);
      setEnglishField(parsed.field);
      void syncMediumForType(parsed.type, parsed.field);
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
    void syncMediumForType(parsed.type, parsed.field);
  }

  async function syncMediumForType(type: QType, field: EnglishFieldFilter) {
    const topicIds =
      selectedTopicIds.length > 0
        ? selectedTopicIds
        : subjectTopicsFlat.map((t) => t.id);
    if (topicIds.length === 0) return;
    try {
      const next = await inferQuestionTypeMedium({
        topicIds,
        type,
        chapterIds: selectedChapterIds,
        englishField: usesPtsTypeFields ? field : "ALL",
      });
      setMedium(next);
    } catch {
      // keep current medium on failure
    }
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

  function chapterCountInput(
    row: (typeof chapterPlanRows)[number],
    type: QType,
    className = "h-10",
  ) {
    const available = row.available[type];
    return (
      <Input
        type="number"
        min={0}
        max={available}
        inputMode="numeric"
        value={row.requested[type]}
        disabled={available === 0}
        onChange={(e) =>
          updateChapterPlan(
            row.chapter.id,
            type,
            e.target.value === ""
              ? ""
              : Math.min(available, Math.max(0, Number(e.target.value))),
          )
        }
        className={className}
      />
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

  function runSearch() {
    setMessage(null);
    if (parsedRequired() < 1) {
      toast.error("Enter the required number of questions.");
      return;
    }
    if (selectedTopicIds.length === 0) {
      toast.error("No topics selected");
      return;
    }
    if (sectionChapterIds.length === 0) {
      toast.error("Select at least one chapter");
      return;
    }
    startTransition(async () => {
      try {
        const result = await searchQuestionPool({
          topicIds: selectedTopicIds,
          type: activeType,
          chapterIds: sectionChapterIds,
          excludeIds: [...usedQuestionIds],
          source: sourceFilter,
          englishField: usesPtsTypeFields ? englishField : "ALL",
          medium,
        });
        setPool(result.questions);
        setPoolTotal(result.total);
        setDraftSelected([]);
        setPoolView("browse");
        if (result.questions.length > 0) {
          setMedium(aggregateQuestionsMedium(result.questions));
        }
        setMessage(
          result.total === 0
            ? `No ${TYPE_META[activeType].short} found`
            : `${result.total} ${TYPE_META[activeType].short} available`,
        );
        if (result.total > 0) setPickerFiltersOpen(false);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Search failed");
      }
    });
  }

  function runSelectRandom() {
    setMessage(null);
    const need = parsedRequired();
    if (need < 1) {
      toast.error("Enter the required number of questions.");
      return;
    }
    if (parsedMarks() < 1) {
      toast.error("Enter marks for each question.");
      return;
    }
    if (sectionChapterIds.length === 0) {
      toast.error("Select at least one chapter");
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
        toast.error(
          `The planner requires ${need} ${TYPE_META[activeType].short}. Random select will use that count.`,
        );
      }
      if (plannedTotal < 1) {
        toast.error(`No chapter quota is set for this question type in the planner.`);
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
          source: sourceFilter,
          englishField: usesPtsTypeFields ? englishField : "ALL",
          medium,
        });
        setPool(result.questions);
        setPoolTotal(result.questions.length);
        setDraftSelected(result.questions);
        setPoolView("selected");
        if (result.questions.length > 0) {
          setMedium(aggregateQuestionsMedium(result.questions));
        }
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
        if (result.questions.length > 0) setPickerFiltersOpen(false);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Random select failed");
      }
    });
  }

  function toggleDraftQuestion(question: PoolQuestionCard) {
    const need = parsedRequired();
    if (need < 1) {
      toast.error("Enter the required number of questions first.");
      return;
    }
    const alreadySelected = draftSelected.some((q) => q.id === question.id);
    if (alreadySelected) {
      setDraftSelected((prev) => prev.filter((q) => q.id !== question.id));
      return;
    }

    const typeLabel = TYPE_META[activeType].short;
    if (draftSelected.length >= need) {
      toast.error(
        `You already selected ${need} ${typeLabel} — that is the required count. Uncheck one first to swap it.`,
      );
      return;
    }

    if (hasChapterPlan()) {
      const quota = plannedQuotaForChapter(question.chapterId, activeType) ?? 0;
      const fromChapter = draftSelected.filter(
        (q) => q.chapterId === question.chapterId,
      ).length;
      if (fromChapter >= quota) {
        const chapterName =
          chapters.find((c) => c.id === question.chapterId)?.name ?? "Chapter";
        toast.error(
          `${chapterName}: you can select up to ${quota} ${typeLabel} (planner limit).`,
        );
        return;
      }
    }

    setDraftSelected((prev) => [...prev, question]);
  }

  function replaceOneQuestion(question: PoolQuestionCard) {
    setMessage(null);
    const remaining = draftSelected.filter((q) => q.id !== question.id);
    const excludeIds = [
      ...usedQuestionIds,
      ...draftSelected.map((q) => q.id),
    ];
    const topicUsage = buildTopicUsage(remaining);

    startTransition(async () => {
      try {
        const result = await pickRandomQuestions({
          topicIds: selectedTopicIds,
          type: activeType,
          count: 1,
          chapterIds: [question.chapterId],
          chapterQuotas: [{ chapterId: question.chapterId, count: 1 }],
          excludeIds,
          mode: "BALANCED",
          topicUsage,
          source: sourceFilter,
          englishField: usesPtsTypeFields ? englishField : "ALL",
          medium,
        });

        const replacement = result.questions[0];
        if (!replacement) {
          toast.error("No other question is available in this chapter to replace with.");
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
        toast.error(err instanceof Error ? err.message : "Replace failed");
      }
    });
  }

  function replacePaperQuestion(sectionType: QType, questionId: string) {
    if (manualEditMode) return;
    const section = paperSections.find((s) => s.type === sectionType);
    const current = section?.questions.find((q) => q.id === questionId);
    if (!current || !section) return;

    const remaining = section.questions.filter((q) => q.id !== questionId);
    const topicUsage = buildTopicUsage(remaining);

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
          mode: "BALANCED",
          topicUsage,
          source: sourceFilter,
          englishField: usesPtsTypeFields ? englishField : "ALL",
          medium,
        });
        const replacement = result.questions[0];
        if (!replacement) {
          toast.error("No other question is available to replace with.");
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
        toast.error(err instanceof Error ? err.message : "Replace failed");
      }
    });
  }

  function addSectionToPaper() {
    const need = parsedRequired();
    const marks = parsedMarks();
    const attempt = parsedAttempt();
    if (need < 1) {
      toast.error("Enter the required number of questions.");
      return;
    }
    if (marks < 1) {
      toast.error("Enter marks for each question.");
      return;
    }
    const typeLabel = TYPE_META[activeType].short;
    if (draftSelected.length === 0) {
      toast.error(
        `No question selected yet. Pick ${need} ${typeLabel} before adding this section.`,
      );
      return;
    }
    if (draftSelected.length < need) {
      toast.error(
        `${need} ${typeLabel} required, but only ${draftSelected.length} selected. Select ${need - draftSelected.length} more.`,
      );
      return;
    }
    if (draftSelected.length > need) {
      toast.error(
        `${need} ${typeLabel} required, but ${draftSelected.length} selected. Uncheck ${draftSelected.length - need}.`,
      );
      return;
    }

    if (hasChapterPlan()) {
      for (const quota of chapterQuotasForType(activeType)) {
        const picked = draftSelected.filter((q) => q.chapterId === quota.chapterId).length;
        if (picked !== quota.count) {
          const chapterName =
            chapters.find((c) => c.id === quota.chapterId)?.name ?? "Chapter";
          toast.error(
            `${chapterName}: ${quota.count} ${TYPE_META[activeType].short} required; ${picked} currently selected.`,
          );
          return;
        }
      }
    }

    const existing = paperSections.find((s) => s.type === activeType);
    if (existing) {
      const ok = window.confirm(
        `A ${TYPE_META[activeType].label} section is already on this test (${existing.questions.length} questions). Replace it?`,
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
    }
    setPickerFiltersOpen(true);
    // Keep the picker open so the paper preview can update live behind it.
    setSelectionMode("manual");
  }

  function removeSection(type: QType) {
    setPaperSections((prev) => prev.filter((s) => s.type !== type));
    setMessage(`${TYPE_META[type].label} removed`);
  }

  function openSaveModal() {
    if (paperSections.length === 0) {
      toast.error("Add at least one section first (MCQ / Short / Long).");
      return;
    }
    if (scheduleContext?.testDate && !examDate) {
      setExamDate(scheduleContext.testDate);
    }
    if (scheduleContext?.scheduleName && !testType.trim()) {
      setTestType(scheduleContext.scheduleName);
    }
    if (!title.trim() && selectedSubject?.name) {
      setTitle(`${selectedSubject.name} Test`);
    }
    setModalOpen(false);
    setSaveModalOpen(true);
  }

  function savePaper() {
    if (!subjectId) {
      toast.error("Subject missing");
      return;
    }
    if (!title.trim()) {
      toast.error("Enter a test name.");
      return;
    }
    if (!preparedBy.trim()) {
      toast.error("Enter the teacher name (Prepared by).");
      return;
    }
    const effectiveExamDate = examDate || scheduleContext?.testDate || "";
    if (!effectiveExamDate) {
      toast.error("Select an exam date.");
      return;
    }
    const duration = typeof durationMinutes === "number" ? durationMinutes : 0;
    if (duration < 5) {
      toast.error("Duration must be at least 5 minutes.");
      return;
    }
    if (paperSections.length === 0) {
      toast.error("Test is empty");
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
        toast.success("Test saved successfully.");
        router.push(testsRedirectPath);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Save failed");
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
        router.push(schedulesRedirectPath);
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
          title="Generate Test"
          description={
            emptyStateDescription ??
            (hasTeachingAssignments
              ? "No curriculum is available for your assigned subjects yet. Ask Super Admin to add content."
              : "No classes or subjects are assigned to you yet. Ask your Org Admin to assign your teaching subjects.")
          }
          actions={
            <Link href={testsRedirectPath}>
              <Button variant="secondary">Saved tests</Button>
            </Link>
          }
        />
      </PageStack>
    );
  }

  return (
    <PageStack wide className="wizard-flow gap-4">
      {scheduleContext ? (
        <div className="rounded-[1.1rem] border border-amber-500/25 bg-amber-500/10 px-4 py-3 text-sm text-amber-900 shadow-[var(--shadow-soft)] dark:text-amber-200">
          Creating test for assigned schedule:{" "}
          <strong>{scheduleContext.scheduleName}</strong>. Subject is locked to the
          schedule.
        </div>
      ) : null}
      <div className={cn(step === "paper" ? "pts-paper-sticky-chrome" : "pts-wizard-panel")}>
        <div className="wizard-head">
          <div className="wizard-head-main">
            <div className="min-w-0 flex-1">
              <p className="page-kicker">Generate Test</p>
              <h2 className="page-title wizard-head-title">
                {step === "board"
                  ? "Select Board"
                  : step === "class"
                    ? "Select Class"
                    : step === "subject"
                      ? "Select Subject"
                      : step === "chapters"
                        ? "Select Syllabus"
                        : step === "paper"
                          ? "Test Preview"
                          : isMultiChapter
                            ? "Chapter Distribution"
                            : "Select Questions"}
              </h2>
              {step === "board" ? (
                <p className="mt-1 max-w-xl text-sm text-muted">
                  Choose the education board for this test.
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
              {selectedSubject ? (
                <div className="pts-crumb pts-crumb-scroll">
                  {lockedFromSchedule ? (
                    <span>{selectedSubject.name}</span>
                  ) : (
                    <button type="button" onClick={() => jumpTo("subject")}>
                      {selectedSubject.name}
                    </button>
                  )}
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
                      <span className="pts-crumb-current">Test</span>
                    </>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>
          <div className="wizard-head-actions">
            <Link href={testsRedirectPath}>
              <Button variant="secondary">Saved tests</Button>
            </Link>
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
                  Save Test
                </Button>
              </>
            ) : null}
          </div>
        </div>

        {step !== "paper" ? (
          <nav className="pts-steps" aria-label="Test generation steps">
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
      </div>

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
                  <span className="pts-choice-meta">Education board</span>
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
                    <span className="pts-choice-meta">
                      {klass.subjects.length} subject
                      {klass.subjects.length === 1 ? "" : "s"}
                    </span>
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
                    <span className="pts-choice-meta">Tap to continue</span>
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
                {" · question picker next"}
              </>
            }
          >
            <Button
              onClick={openWorkspace}
              disabled={selectedTopicIds.length === 0}
              className="min-w-[10rem]"
            >
              Continue → Select Questions
            </Button>
          </WizardActionBar>
        </>
      ) : null}

      {/* WORKSPACE */}
      {step === "workspace" ? (
        <div className="space-y-4">
          {useChapterPlanner && !modalOpen ? (
            <Card className="chart-card pts-planner-wrap">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <CardTitle>Chapter planner</CardTitle>
                  <p className="mt-1 hidden text-sm text-muted md:block">
                    Set how many MCQ, Short, and Long questions to take from each chapter.
                  </p>
                </div>
                <div className="flex w-full gap-2 sm:w-auto">
                  <Button type="button" variant="outline" className="flex-1 sm:flex-none" onClick={autofillChapterPlan}>
                    Auto fill
                  </Button>
                  <Button type="button" variant="outline" className="flex-1 sm:flex-none" onClick={clearChapterPlan}>
                    Clear
                  </Button>
                </div>
              </div>

              <div className="pts-planner-summary">
                <div>
                  <span>MCQ</span>
                  <strong>{plannerTotals.MCQ}</strong>
                </div>
                <div>
                  <span>Short</span>
                  <strong>{plannerTotals.SHORT}</strong>
                </div>
                <div>
                  <span>Long</span>
                  <strong>{plannerTotals.LONG}</strong>
                </div>
                <div>
                  <span>Total</span>
                  <strong>{plannerQuestionTotal}</strong>
                </div>
                <div>
                  <span>Marks</span>
                  <strong>{plannerEstimatedMarks}</strong>
                </div>
              </div>

              <div className="pts-planner-list">
                {chapterPlanRows.map((row) => (
                  <article key={row.chapter.id} className="pts-planner-card">
                    <div className="pts-planner-card-head">
                      <div className="min-w-0">
                        <h3 className="pts-planner-card-title">{row.chapter.name}</h3>
                        <p className="pts-planner-card-meta">
                          {
                            row.chapter.topics.filter((topic) =>
                              selectedTopicIds.includes(topic.id),
                            ).length
                          }{" "}
                          topics selected
                        </p>
                      </div>
                      <span className="pts-planner-card-total">{row.total} q</span>
                    </div>
                    <div className="pts-planner-card-inputs">
                      {ALL_TYPES.map((type) => (
                        <label key={type} className="pts-planner-field">
                          <span>{type === "MCQ" ? "MCQ" : TYPE_META[type].short}</span>
                          {chapterCountInput(row, type, "h-10 text-center")}
                          <em>{row.available[type]} avail</em>
                        </label>
                      ))}
                    </div>
                  </article>
                ))}
              </div>

              <div className="pts-planner-table-wrap">
                <div className="overflow-x-auto rounded-[1.15rem] border border-line shadow-[var(--shadow-soft)]">
                  <table className="w-full min-w-[640px] text-left text-sm">
                    <thead className="bg-mist text-xs uppercase tracking-wide text-muted">
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
                          className="border-t border-line bg-card align-top"
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
                          {ALL_TYPES.map((type) => (
                            <td key={type} className="px-4 py-3">
                              {chapterCountInput(row, type, "h-10 min-w-[92px]")}
                            </td>
                          ))}
                          <td className="px-4 py-3">
                            <span className="font-semibold text-ink">{row.total}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
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
                  className="w-full sm:w-auto sm:min-w-[10rem]"
                >
                  Next → Select Questions
                </Button>
              </WizardActionBar>
            </Card>
          ) : !modalOpen ? (
            <Card className="chart-card border-dashed border-brand/30 bg-brand/[0.03]">
              <CardTitle>Select questions</CardTitle>
              <CardDescription className="mt-1">
                A single chapter is selected, so the planner is not needed. Use the question picker to choose MCQ, Short, and Long questions.
              </CardDescription>
              <div className="mt-4 flex flex-wrap gap-2">
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
                    View Test →
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
                    : "Open the question picker to build your test."
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
                    View Test
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
          <div className="pts-modal pts-modal--save">
            <div className="pts-modal-header">
              <div>
                <p className="text-xs font-medium text-white/70">Save Test</p>
                <h3 className="text-base font-bold">Fill test details</h3>
              </div>
              <button
                type="button"
                className="rounded-lg bg-card/15 px-3 py-1.5 text-sm font-semibold hover:bg-card/25"
                onClick={() => setSaveModalOpen(false)}
              >
                Close
              </button>
            </div>

            <div className="nice-scroll flex-1 space-y-4 overflow-y-auto p-5 pb-8">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="block text-sm font-semibold text-ink sm:col-span-1">
                  Test name <span className="text-red-500">*</span>
                  <Input
                    className="mt-1.5 h-11"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. Biology Mid Term"
                  />
                </label>
                <label className="block text-sm font-semibold text-ink">
                  Exam date <span className="text-red-500">*</span>
                  <div className="mt-1.5">
                    <DateField
                      value={examDate || scheduleContext?.testDate || ""}
                      onChange={setExamDate}
                      disabled={lockedFromSchedule}
                      readOnly={lockedFromSchedule}
                    />
                  </div>
                  {lockedFromSchedule ? (
                    <span className="mt-1 block text-xs font-medium text-muted">
                      Locked to schedule test date — cannot be changed.
                    </span>
                  ) : null}
                </label>
              </div>
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
                        e.target.value === "" ? "" : Math.max(0, Number(e.target.value)),
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
              <label className="block text-sm font-semibold text-ink">
                Prepared by <span className="text-red-500">*</span>
                <Input
                  className="mt-1.5 h-11"
                  value={preparedBy}
                  onChange={(e) => setPreparedBy(e.target.value)}
                />
              </label>
              <label className="block text-sm font-semibold text-ink">
                Instructions (optional)
                <textarea
                  className="field-area mt-1.5 min-h-24 w-full rounded-xl border border-line bg-[var(--field-bg)] px-3 py-2.5 text-sm text-ink"
                  value={instructions}
                  onChange={(e) => setInstructions(e.target.value)}
                  placeholder="Leave blank to use the default instructions"
                />
              </label>

            </div>

            <div className="pts-modal-save-footer">
              <p className="text-sm font-semibold text-ink">
                Total marks: {paperMarks}
              </p>
              <div className="pts-modal-save-actions">
                <Button variant="outline" onClick={() => setSaveModalOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={savePaper} disabled={pending}>
                  {pending ? "Saving…" : "Save Test"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* QUESTION PICKER MODAL — opens over Paper Preview */}
      {step === "paper" && modalOpen ? (
        <div className="pts-modal-backdrop pts-modal-backdrop-paper" role="dialog" aria-modal="true">
          <div className="pts-modal pts-modal--picker">
            <div className="pts-modal-header">
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-white/75">
                  Select questions
                </p>
                <h3 className="truncate text-base font-bold sm:text-lg">
                  {selectedClass?.name} — {selectedSubject?.name}
                </h3>
              </div>
              <button
                type="button"
                className="shrink-0 rounded-lg bg-card/15 px-3 py-1.5 text-sm font-semibold hover:bg-card/25"
                onClick={() => setModalOpen(false)}
              >
                Close
              </button>
            </div>

            <div className="pts-picker-body">
              <div className="pts-picker-controls">
                <button
                  type="button"
                  className="pts-picker-filters-toggle"
                  aria-expanded={pickerFiltersOpen}
                  onClick={() => setPickerFiltersOpen((open) => !open)}
                >
                  <span className="pts-picker-filters-toggle-copy">
                    <span className="pts-picker-filters-toggle-title">
                      {pickerFiltersOpen ? "Hide Question Menu" : "Question Menu"}
                    </span>
                    {/* <span className="pts-picker-filters-toggle-summary">
                      {pickerFilterSummary}
                    </span> */}
                  </span>
                  <ChevronDown
                    className={cn(
                      "pts-picker-filters-chevron",
                      pickerFiltersOpen && "is-open",
                    )}
                    aria-hidden
                  />
                </button>
                <div
                  className={cn(
                    "pts-picker-fields",
                    pickerFiltersOpen && "is-open",
                  )}
                >
                  <div className="pts-picker-field pts-picker-field--type">
                    <span className="pts-picker-label">Question type</span>
                    {usesPtsTypeFields ? (
                      <SearchSelect
                        ariaLabel="Question type"
                        value={ptsTypeFieldValue}
                        onChange={activatePtsTypeField}
                        searchPlaceholder="Search question type…"
                        options={availablePtsTypeOptions
                          .filter(
                            (opt) =>
                              !hasChapterPlan() ||
                              plannedCountForType(opt.type) > 0,
                          )
                          .map((opt) => ({
                            value: opt.value,
                            label: opt.label,
                          }))}
                      />
                    ) : (
                      <SearchSelect
                        ariaLabel="Question type"
                        value={activeType}
                        onChange={(next) => activateType(next as QType)}
                        searchPlaceholder="Search question type…"
                        options={ALL_TYPES.filter(
                          (t) => !hasChapterPlan() || plannedCountForType(t) > 0,
                        ).map((t) => ({
                          value: t,
                          label: `${TYPE_META[t].label} (${TYPE_META[t].urdu})`,
                        }))}
                      />
                    )}
                  </div>

                  <label className="pts-picker-field pts-picker-field--num">
                    <span className="pts-picker-label">Required</span>
                    <Input
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
                      <span className="pts-picker-hint">From planner</span>
                    ) : null}
                  </label>

                  <label className="pts-picker-field pts-picker-field--num">
                    <span className="pts-picker-label">Marks each</span>
                    <Input
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

                  <div className="pts-picker-field pts-picker-field--source">
                    <span className="pts-picker-label">Source</span>
                    <SearchSelect
                      ariaLabel="Question source"
                      value={sourceFilter}
                      searchPlaceholder="Search source…"
                      onChange={(next) => {
                        setSourceFilter(next as QuestionSourceFilter);
                        setPool([]);
                        setDraftSelected([]);
                      }}
                      options={[
                        { value: "ALL", label: "All (Smart Syllabus)" },
                        { value: "EXERCISE", label: "Exercise" },
                        { value: "ADDITIONAL", label: "Additional" },
                      ]}
                    />
                  </div>

                  <div className="pts-picker-field pts-picker-field--medium">
                    <span className="pts-picker-label">Medium</span>
                    <SearchSelect
                      ariaLabel="Question medium"
                      value={medium}
                      searchPlaceholder="Search medium…"
                      onChange={(next) => {
                        // Keep pool + selection; only switch EN/UR/Dual display.
                        setMedium(next as QuestionMedium);
                      }}
                      options={MEDIUM_OPTIONS.map((opt) => ({
                        value: opt.value,
                        label: opt.label,
                      }))}
                    />
                  </div>

                  <label className="pts-picker-field pts-picker-field--num">
                    <span className="pts-picker-label">Attempt any</span>
                    <Input
                      type="number"
                      min={0}
                      placeholder="—"
                      value={attemptCount}
                      onChange={(e) =>
                        setAttemptCount(
                          e.target.value === "" ? "" : Math.max(0, Number(e.target.value)),
                        )
                      }
                    />
                  </label>
                </div>
              </div>

              <div className="pts-picker-actions">
                <Button onClick={runSearch} disabled={pending} className="pts-picker-action-btn">
                  {pending ? "Searching…" : "Search"}
                </Button>
                <Button
                  variant="outline"
                  onClick={runSelectRandom}
                  disabled={pending}
                  className="pts-picker-action-btn"
                >
                  Random Select
                </Button>
                {draftSelected.length > 0 ? (
                  <Button
                    variant="outline"
                    onClick={() => {
                      setDraftSelected([]);
                      setPoolView("browse");
                    }}
                    className="pts-picker-action-btn pts-picker-action-btn--ghost"
                  >
                    Clear
                  </Button>
                ) : null}
              </div>

              <div className="pts-picker-results nice-scroll">
              {visiblePool.length > 0 ? (
                <div className="pts-picker-pool">
                  <div className="pts-picker-pool-head">
                    {TYPE_META[activeType].label}
                    {pending ? " · loading…" : ` · ${visiblePool.length} found`}
                  </div>
                  <div className="pts-picker-pool-list">
                    {(() => {
                      let qIndex = 0;
                      return poolByTopic.map((group) => (
                        <div
                          key={group.topicId}
                          className="pts-picker-topic-block"
                        >
                          <div className="pts-picker-topic-heading">
                            <span>{group.topicName}</span>
                          </div>
                          {group.questions.map((q) => {
                            qIndex += 1;
                            const selected = draftSelected.some(
                              (d) => d.id === q.id,
                            );
                            return (
                              <div
                                key={q.id}
                                className={cn(
                                  "pts-picker-pool-item",
                                  selected && "is-selected",
                                )}
                              >
                                <button
                                  type="button"
                                  className="mt-0.5 shrink-0"
                                  onClick={() => toggleDraftQuestion(q)}
                                  aria-label={
                                    selected
                                      ? "Unselect question"
                                      : "Select question"
                                  }
                                >
                                  <input
                                    type="checkbox"
                                    readOnly
                                    checked={selected}
                                  />
                                </button>
                                <div className="pts-picker-pool-item-meta">
                                  <span
                                    className={cn(
                                      "source-chip",
                                      sourceKind(q.source) === "exercise" &&
                                        "source-chip-exercise",
                                      sourceKind(q.source) === "additional" &&
                                        "source-chip-additional",
                                      sourceKind(q.source) === "other" &&
                                        "source-chip-other",
                                    )}
                                  >
                                    {sourceLabel(q.source)}
                                  </span>
                                </div>
                                <span className="pts-picker-pool-item-num">
                                  {qIndex}.
                                </span>
                                <button
                                  type="button"
                                  className="pts-picker-pool-item-body"
                                  onClick={() => toggleDraftQuestion(q)}
                                >
                                  <QuestionBilingualText
                                    text={q.text}
                                    textUrdu={q.textUrdu}
                                    medium={medium}
                                    className="pts-picker-q-text"
                                  />
                                  {activeType === "MCQ" ? (
                                    <div className="mt-1 grid gap-0.5 text-[13px] text-ink-soft sm:grid-cols-2">
                                      {[
                                        q.optionA,
                                        q.optionB,
                                        q.optionC,
                                        q.optionD,
                                      ].map((opt, i) =>
                                        opt ? (
                                          <p key={i}>
                                            ({String.fromCharCode(65 + i)}){" "}
                                            {opt}
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
                      ));
                    })()}
                  </div>
                </div>
              ) : (
                <p className="pts-picker-empty">
                  {pending
                    ? "Loading questions…"
                    : message?.includes("No ")
                      ? "No questions match this filter. Change type, source, or chapters and search again."
                      : "Tap Search or Random Select to load matching questions."}
                </p>
              )}
              </div>
            </div>

            <div className="pts-modal-footer pts-modal-footer--picker">
              <p className="pts-modal-footer-summary">
                {draftSelected.length} selected
                {parsedRequired() > 0 ? ` of ${parsedRequired()} required` : ""}
              </p>
              <div className="pts-modal-footer-actions">
                <Button variant="outline" onClick={() => setModalOpen(false)}>
                  View Test
                </Button>
                <Button onClick={addSectionToPaper} disabled={pending}>
                  Add Questions →
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </PageStack>
  );
}
