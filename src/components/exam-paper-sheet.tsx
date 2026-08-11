import { cn } from "@/lib/utils";
import { RichText } from "@/components/rich-text";

export type ExamPaperMedium = "ENGLISH" | "URDU" | "BOTH";

export type ExamPaperQuestion = {
  id: string;
  text: string;
  textUrdu?: string | null;
  optionA?: string | null;
  optionB?: string | null;
  optionC?: string | null;
  optionD?: string | null;
  correctAnswer?: string | null;
};

export type ExamPaperSection = {
  type: "MCQ" | "SHORT" | "LONG";
  title: string;
  marksEach: number;
  attemptCount?: number;
  questions: ExamPaperQuestion[];
};

export type OrgBranding = {
  name: string;
  logoUrl?: string | null;
  address?: string | null;
  phone?: string | null;
};

export type ExamPaperMeta = {
  title: string;
  boardName?: string | null;
  className?: string | null;
  subjectName?: string | null;
  classSection?: string | null;
  examDate?: string | null;
  durationMinutes?: number | null;
  totalMarks?: number | null;
  preparedBy?: string | null;
  instructions?: string | null;
  paperCode?: string | null;
  examLabel?: string | null;
  syllabusNote?: string | null;
  organization?: OrgBranding | null;
};

export type ExamQuestionPatch = Partial<
  Pick<
    ExamPaperQuestion,
    "text" | "textUrdu" | "optionA" | "optionB" | "optionC" | "optionD"
  >
>;

const SECTION_PROMPT: Record<
  ExamPaperSection["type"],
  { en: string; ur: string }
> = {
  MCQ: {
    en: "Question 1. Choose the correct option.",
    ur: "سوال نمبر 1: درست اختیار منتخب کریں۔",
  },
  SHORT: {
    en: "Question 2. Write short answers of the following questions.",
    ur: "سوال نمبر 2: درج ذیل سوالات کے مختصر جوابات لکھیں۔",
  },
  LONG: {
    en: "Question 3. Write detailed answers of the following questions.",
    ur: "سوال نمبر 3: درج ذیل سوالات کے تفصیلی جوابات لکھیں۔",
  },
};

const ROMANS = [
  "I",
  "II",
  "III",
  "IV",
  "V",
  "VI",
  "VII",
  "VIII",
  "IX",
  "X",
  "XI",
  "XII",
  "XIII",
  "XIV",
  "XV",
  "XVI",
  "XVII",
  "XVIII",
  "XIX",
  "XX",
  "XXI",
  "XXII",
  "XXIII",
  "XXIV",
  "XXV",
];

function questionLabel(type: ExamPaperSection["type"], index: number) {
  if (type === "SHORT") return ROMANS[index] ?? String(index + 1);
  return String(index + 1);
}

function formatExamDate(value?: string | null) {
  if (!value) return "____________";
  const d = new Date(value.includes("T") ? value : `${value}T00:00:00`);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatTimeAllowed(minutes?: number | null) {
  if (!minutes && minutes !== 0) return "____";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}:${String(m).padStart(2, "0")}`;
}

function MetaCell({
  label,
  value,
  wide,
}: {
  label: string;
  value: string;
  wide?: boolean;
}) {
  return (
    <div className={cn("exam-info-cell", wide && "exam-info-cell-wide")}>
      <span className="exam-info-label">{label}</span>
      <span className="exam-info-value">{value}</span>
    </div>
  );
}

function BubbleSheet({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <div className="exam-bubble-sheet">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="exam-bubble-row">
          <span className="exam-bubble-no">{i + 1}</span>
          {(["A", "B", "C", "D"] as const).map((letter) => (
            <span key={letter} className="exam-bubble">
              <span className="exam-bubble-circle" />
              <span className="exam-bubble-letter">({letter})</span>
            </span>
          ))}
        </div>
      ))}
    </div>
  );
}

function normalizeMcqKey(value?: string | null) {
  if (!value) return null;
  const trimmed = value.trim().toUpperCase();
  if (/^[A-D]$/.test(trimmed)) return trimmed;
  const match = trimmed.match(/^[(\[]?([A-D])[)\].:]?$/);
  return match?.[1] ?? null;
}

function McqOptions({
  question,
  medium,
  editable,
  showAnswerKey,
  onChange,
}: {
  question: ExamPaperQuestion;
  medium: ExamPaperMedium;
  editable?: boolean;
  showAnswerKey?: boolean;
  onChange?: (patch: ExamQuestionPatch) => void;
}) {
  const opts: Array<["optionA" | "optionB" | "optionC" | "optionD", string]> = [
    ["optionA", "A"],
    ["optionB", "B"],
    ["optionC", "C"],
    ["optionD", "D"],
  ];
  const correct = showAnswerKey ? normalizeMcqKey(question.correctAnswer) : null;

  if (editable) {
    return (
      <div className="exam-mcq-options exam-mcq-options-edit">
        {opts.map(([key, letter]) => (
          <label key={key} className="exam-edit-option">
            <span className="exam-mcq-letter">({letter})</span>
            <input
              className="exam-edit-input"
              value={question[key] ?? ""}
              onChange={(e) => onChange?.({ [key]: e.target.value })}
            />
          </label>
        ))}
      </div>
    );
  }

  return (
    <div className="exam-mcq-options">
      {opts.map(([key, letter]) => {
        const text = question[key];
        if (!text) return null;
        return (
          <span
            key={key}
            className={cn(
              "exam-mcq-opt",
              correct === letter && "exam-mcq-opt--correct",
            )}
          >
            <span className="exam-mcq-letter">({letter})</span>{" "}
            {medium === "URDU" ? (
              <RichText value={text} dir="rtl" />
            ) : (
              <RichText value={text} />
            )}
          </span>
        );
      })}
    </div>
  );
}

function QuestionStem({
  question,
  medium,
  index,
  sectionType,
  editable,
  onChange,
}: {
  question: ExamPaperQuestion;
  medium: ExamPaperMedium;
  index: number;
  sectionType: ExamPaperSection["type"];
  editable?: boolean;
  onChange?: (patch: ExamQuestionPatch) => void;
}) {
  const label = questionLabel(sectionType, index);
  const en = question.text;
  const ur = question.textUrdu;

  if (editable) {
    return (
      <div
        className={cn(
          "exam-q-edit",
          medium !== "BOTH" && "exam-q-edit-single",
        )}
      >
        {(medium === "ENGLISH" || medium === "BOTH") && (
          <label className="exam-edit-field exam-q-en">
            <span className="exam-q-num">{label}.</span>
            <textarea
              className="exam-edit-textarea"
              rows={2}
              value={en}
              onChange={(e) => onChange?.({ text: e.target.value })}
              placeholder="English question"
            />
          </label>
        )}
        {(medium === "URDU" || medium === "BOTH") && (
          <label className="exam-edit-field exam-q-ur" dir="rtl">
            {medium === "URDU" ? (
              <span className="exam-q-num">{label}.</span>
            ) : null}
            <textarea
              className="exam-edit-textarea"
              rows={2}
              dir="rtl"
              value={ur ?? ""}
              onChange={(e) => onChange?.({ textUrdu: e.target.value })}
              placeholder="اردو سوال"
            />
          </label>
        )}
      </div>
    );
  }

  if (medium === "ENGLISH") {
    return (
      <p className="exam-q-stem exam-q-en">
        <span className="exam-q-num">{label}.</span>{" "}
        <RichText value={en} />
      </p>
    );
  }

  if (medium === "URDU") {
    return (
      <p className="exam-q-stem exam-q-ur" dir="rtl">
        <span className="exam-q-num">{label}.</span>{" "}
        <RichText value={ur || en} />
      </p>
    );
  }

  return (
    <div className="exam-q-bilingual">
      <p className="exam-q-stem exam-q-en">
        <span className="exam-q-num">{label}.</span>{" "}
        <RichText value={en} />
      </p>
      <p className="exam-q-stem exam-q-ur" dir="rtl">
        <span className="exam-q-num">{label}.</span>{" "}
        <RichText value={ur || "—"} />
      </p>
    </div>
  );
}

function PartBanner({ en, ur }: { en: string; ur: string }) {
  return (
    <div className="exam-part-banner">
      <h2>
        {en}
        <span dir="rtl" className="exam-section-ur">
          {" "}
          {ur}
        </span>
      </h2>
    </div>
  );
}

function SectionPromptRow({
  en,
  ur,
  marksLine,
  medium,
  attemptNote,
}: {
  en: string;
  ur: string;
  marksLine: string;
  medium: ExamPaperMedium;
  attemptNote?: string | null;
}) {
  if (medium === "URDU") {
    return (
      <div className="exam-q-prompt exam-q-prompt-single">
        <div className="exam-q-prompt-line exam-q-ur" dir="rtl">
          <span>{ur}</span>
          <span className="exam-prompt-marks">{marksLine}</span>
        </div>
        {attemptNote ? <p className="exam-attempt-note">{attemptNote}</p> : null}
      </div>
    );
  }

  if (medium === "ENGLISH") {
    return (
      <div className="exam-q-prompt exam-q-prompt-single">
        <div className="exam-q-prompt-line exam-q-en">
          <span>{en}</span>
          <span className="exam-prompt-marks">{marksLine}</span>
        </div>
        {attemptNote ? <p className="exam-attempt-note">{attemptNote}</p> : null}
      </div>
    );
  }

  // EN left + marks to its right | Urdu right
  return (
    <div className="exam-q-prompt">
      <div className="exam-q-prompt-en">
        <div className="exam-q-prompt-line exam-q-en">
          <span>{en}</span>
          <span className="exam-prompt-marks">{marksLine}</span>
        </div>
        {attemptNote ? <p className="exam-attempt-note">{attemptNote}</p> : null}
      </div>
      <div className="exam-q-prompt-ur exam-q-ur" dir="rtl">
        {ur}
      </div>
    </div>
  );
}

export function ExamPaperSheet({
  meta,
  sections,
  medium = "BOTH",
  className,
  editable = false,
  showAnswerKey = false,
  onQuestionChange,
  onReplaceQuestion,
  replaceDisabled = false,
}: {
  meta: ExamPaperMeta;
  sections: ExamPaperSection[];
  medium?: ExamPaperMedium;
  className?: string;
  editable?: boolean;
  showAnswerKey?: boolean;
  onQuestionChange?: (
    sectionType: ExamPaperSection["type"],
    questionId: string,
    patch: ExamQuestionPatch,
  ) => void;
  onReplaceQuestion?: (
    sectionType: ExamPaperSection["type"],
    questionId: string,
  ) => void;
  replaceDisabled?: boolean;
}) {
  const totalMarks =
    meta.totalMarks ??
    sections.reduce((sum, s) => sum + s.questions.length * s.marksEach, 0);

  const org = meta.organization;
  const orgName = org?.name?.trim() || meta.boardName || "Examination Paper";
  const address = org?.address?.trim() || null;
  const logoUrl = org?.logoUrl?.trim() || null;

  const classDisplay = [meta.className, meta.classSection]
    .filter(Boolean)
    .join(" ")
    .toUpperCase();

  const mcqSection = sections.find((s) => s.type === "MCQ");
  const mcqCount = mcqSection?.questions.length ?? 0;
  const hasSubjective = sections.some((s) => s.type === "SHORT" || s.type === "LONG");
  let subjectiveShown = false;

  const mcqKeyLine =
    showAnswerKey && mcqSection
      ? mcqSection.questions
          .map((q, idx) => {
            const key = normalizeMcqKey(q.correctAnswer);
            return key ? `${idx + 1}-${key}` : null;
          })
          .filter(Boolean)
          .join(" · ")
      : "";

  return (
    <article className={cn("exam-sheet", editable && "exam-sheet-editing", className)}>
      {logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={logoUrl} alt="" className="exam-watermark" aria-hidden />
      ) : null}

      <header className="exam-brand-header">
        <div className="exam-brand-row">
          <div className="exam-brand-logo">
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoUrl} alt="" className="exam-logo-img" />
            ) : (
              <div className="exam-logo-fallback" aria-hidden>
                {(orgName.slice(0, 2) || "EX").toUpperCase()}
              </div>
            )}
          </div>
          <div className="exam-brand-center">
            <h1 className="exam-org-name">{orgName}</h1>
            {address ? (
              <p className="exam-org-address">
                HEAD OFFICE: {address.toUpperCase()}
              </p>
            ) : null}
            {org?.phone ? (
              <p className="exam-org-phone">Ph: {org.phone}</p>
            ) : null}
          </div>
          <div className="exam-brand-spacer" aria-hidden />
        </div>
      </header>

      <div className="exam-info-grid">
        <MetaCell label="Student Name" value="" />
        <MetaCell label="Roll Number" value="" />
        <MetaCell label="Class Name" value={classDisplay || "____"} />
        <MetaCell
          label="Paper Code"
          value={(meta.paperCode || "____").toUpperCase()}
        />
        <MetaCell
          label="Subject Name"
          value={(meta.subjectName || "____").toUpperCase()}
        />
        <MetaCell
          label="Time Allowed"
          value={formatTimeAllowed(meta.durationMinutes)}
        />
        <MetaCell label="Total Marks" value={String(totalMarks)} />
        <MetaCell label="Exam Date" value={formatExamDate(meta.examDate)} />
        <MetaCell
          label="Exam Syllabus"
          value={(meta.syllabusNote || "____").toUpperCase()}
          wide
        />
        <MetaCell
          label="Exam"
          value={(meta.examLabel || "____").toUpperCase()}
        />
      </div>

      {mcqCount > 0 ? <BubbleSheet count={mcqCount} /> : null}

      {sections.length === 0 ? (
        <p className="exam-empty">No questions added yet.</p>
      ) : (
        sections.map((section, sIdx) => {
          const sectionMarks = section.questions.length * section.marksEach;
          const marksLine = `(${section.marksEach}×${section.questions.length}=${sectionMarks})`;
          const prompt = SECTION_PROMPT[section.type];
          const showSubjectiveBanner =
            hasSubjective &&
            (section.type === "SHORT" || section.type === "LONG") &&
            !subjectiveShown;
          if (showSubjectiveBanner) subjectiveShown = true;

          const attemptNote = section.attemptCount
            ? `Attempt any ${section.attemptCount} out of ${section.questions.length}`
            : null;

          return (
            <div key={`${section.type}-${sIdx}`}>
              {section.type === "MCQ" ? (
                <PartBanner en="Objective Part" ur="حصہ معروضی" />
              ) : null}

              {showSubjectiveBanner ? (
                <PartBanner en="Subjective Part" ur="حصہ انشائیہ" />
              ) : null}

              <section
                className={cn(
                  "exam-section",
                  section.type === "MCQ" && "exam-section-objective",
                )}
              >
                <SectionPromptRow
                  en={prompt.en}
                  ur={prompt.ur}
                  marksLine={marksLine}
                  medium={medium}
                  attemptNote={attemptNote}
                />

                <ol className="exam-q-list">
                  {section.questions.map((q, idx) => (
                    <li key={q.id} className="exam-q-item">
                      <QuestionStem
                        question={q}
                        medium={medium}
                        index={idx}
                        sectionType={section.type}
                        editable={editable}
                        onChange={(patch) =>
                          onQuestionChange?.(section.type, q.id, patch)
                        }
                      />
                      {section.type === "MCQ" ? (
                        <McqOptions
                          question={q}
                          medium={medium}
                          editable={editable}
                          showAnswerKey={showAnswerKey}
                          onChange={(patch) =>
                            onQuestionChange?.(section.type, q.id, patch)
                          }
                        />
                      ) : null}
                      {onReplaceQuestion && !editable ? (
                        <div className="exam-q-toolbar no-print">
                          <button
                            type="button"
                            disabled={replaceDisabled}
                            onClick={() => onReplaceQuestion(section.type, q.id)}
                          >
                            Replace
                          </button>
                        </div>
                      ) : null}
                    </li>
                  ))}
                </ol>
              </section>
            </div>
          );
        })
      )}

      {mcqKeyLine ? (
        <div className="exam-answer-key">
          <h4>MCQ Answer Key</h4>
          <p>{mcqKeyLine}</p>
        </div>
      ) : null}
    </article>
  );
}
