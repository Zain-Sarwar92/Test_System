"use client";

import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { SearchSelect } from "@/components/ui/search-select";

export type QuestionFormBoard = {
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
        topics: Array<{ id: string; name: string }>;
      }>;
    }>;
  }>;
};

type QuestionType = "MCQ" | "SHORT" | "LONG";

function options(items: Array<{ id: string; name: string }>) {
  return items.map((item) => ({ value: item.id, label: item.name }));
}

export function QuestionFormFields({
  boards,
  includeAdminFields = false,
  includeUrdu = includeAdminFields,
}: {
  boards: QuestionFormBoard[];
  includeAdminFields?: boolean;
  includeUrdu?: boolean;
}) {
  const firstBoard = boards[0];
  const firstClass = firstBoard?.classes[0];
  const firstSubject = firstClass?.subjects[0];
  const firstChapter = firstSubject?.chapters[0];

  const [boardId, setBoardId] = useState(firstBoard?.id ?? "");
  const [classId, setClassId] = useState(firstClass?.id ?? "");
  const [subjectId, setSubjectId] = useState(firstSubject?.id ?? "");
  const [chapterId, setChapterId] = useState(firstChapter?.id ?? "");
  const [topicId, setTopicId] = useState(firstChapter?.topics[0]?.id ?? "");
  const [type, setType] = useState<QuestionType>("SHORT");
  const [marks, setMarks] = useState(2);
  const [correctAnswer, setCorrectAnswer] = useState("");

  const board = boards.find((item) => item.id === boardId);
  const klass = board?.classes.find((item) => item.id === classId);
  const subject = klass?.subjects.find((item) => item.id === subjectId);
  const chapter = subject?.chapters.find((item) => item.id === chapterId);
  const topics = useMemo(() => chapter?.topics ?? [], [chapter]);

  const topicPath = useMemo(() => {
    const topic = topics.find((item) => item.id === topicId);
    if (!board || !klass || !subject || !chapter || !topic) return null;
    return [board.name, klass.name, subject.name, chapter.name, topic.name].join(
      " · ",
    );
  }, [board, chapter, klass, subject, topicId, topics]);

  function changeBoard(nextId: string) {
    const nextBoard = boards.find((item) => item.id === nextId);
    const nextClass = nextBoard?.classes[0];
    const nextSubject = nextClass?.subjects[0];
    const nextChapter = nextSubject?.chapters[0];
    setBoardId(nextId);
    setClassId(nextClass?.id ?? "");
    setSubjectId(nextSubject?.id ?? "");
    setChapterId(nextChapter?.id ?? "");
    setTopicId(nextChapter?.topics[0]?.id ?? "");
  }

  function changeClass(nextId: string) {
    const nextClass = board?.classes.find((item) => item.id === nextId);
    const nextSubject = nextClass?.subjects[0];
    const nextChapter = nextSubject?.chapters[0];
    setClassId(nextId);
    setSubjectId(nextSubject?.id ?? "");
    setChapterId(nextChapter?.id ?? "");
    setTopicId(nextChapter?.topics[0]?.id ?? "");
  }

  function changeSubject(nextId: string) {
    const nextSubject = klass?.subjects.find((item) => item.id === nextId);
    const nextChapter = nextSubject?.chapters[0];
    setSubjectId(nextId);
    setChapterId(nextChapter?.id ?? "");
    setTopicId(nextChapter?.topics[0]?.id ?? "");
  }

  function changeChapter(nextId: string) {
    const nextChapter = subject?.chapters.find((item) => item.id === nextId);
    setChapterId(nextId);
    setTopicId(nextChapter?.topics[0]?.id ?? "");
  }

  function changeType(next: string) {
    const nextType = next as QuestionType;
    setType(nextType);
    setMarks(nextType === "LONG" ? 5 : nextType === "MCQ" ? 1 : 2);
    setCorrectAnswer("");
  }

  return (
    <>
      <section className="space-y-3 rounded-[1.1rem] border border-[rgba(15,40,70,0.08)] bg-gradient-to-br from-mist to-card p-4 md:p-5">
        <p className="text-sm font-semibold text-ink-soft">Topic path</p>
        <div className="form-grid form-grid-2">
          <QuestionSelect label="Board" value={boardId}>
            <SearchSelect
              value={boardId}
              options={options(boards)}
              onChange={changeBoard}
              placeholder="Select board"
              searchPlaceholder="Search boards…"
              ariaLabel="Board"
            />
          </QuestionSelect>
          <QuestionSelect label="Class" value={classId}>
            <SearchSelect
              value={classId}
              options={options(board?.classes ?? [])}
              onChange={changeClass}
              placeholder="Select class"
              searchPlaceholder="Search classes…"
              disabled={!boardId}
              ariaLabel="Class"
            />
          </QuestionSelect>
          <QuestionSelect label="Subject" value={subjectId}>
            <SearchSelect
              value={subjectId}
              options={options(klass?.subjects ?? [])}
              onChange={changeSubject}
              placeholder="Select subject"
              searchPlaceholder="Search subjects…"
              disabled={!classId}
              ariaLabel="Subject"
            />
          </QuestionSelect>
          <QuestionSelect label="Chapter" value={chapterId}>
            <SearchSelect
              value={chapterId}
              options={options(subject?.chapters ?? [])}
              onChange={changeChapter}
              placeholder="Select chapter"
              searchPlaceholder="Search chapters…"
              disabled={!subjectId}
              ariaLabel="Chapter"
            />
          </QuestionSelect>
          <label className="md:col-span-2">
            <span className="field-label">
              Topic <span className="req-mark">*</span>
            </span>
            <input type="hidden" name="topicId" value={topicId} />
            <SearchSelect
              value={topicId}
              options={options(topics)}
              onChange={setTopicId}
              placeholder="Select topic"
              searchPlaceholder="Search topics…"
              disabled={!chapterId}
              ariaLabel="Topic"
            />
          </label>
        </div>
        {topicPath ? (
          <p className="rounded-[0.75rem] bg-[#e8f7f4] px-3 py-2 text-xs leading-relaxed text-brand-deep">
            Saving under: {topicPath}
          </p>
        ) : null}
      </section>

      <div className={includeAdminFields ? "form-grid form-grid-3" : "form-grid form-grid-2"}>
        <label>
          <span className="field-label">
            Type <span className="req-mark">*</span>
          </span>
          <input type="hidden" name="type" value={type} />
          <SearchSelect
            value={type}
            options={[
              { value: "SHORT", label: "Short" },
              { value: "LONG", label: "Long" },
              { value: "MCQ", label: "MCQ" },
            ]}
            onChange={changeType}
            searchPlaceholder="Search question types…"
            ariaLabel="Question type"
          />
        </label>
        <label>
          <span className="field-label">
            Marks <span className="req-mark">*</span>
          </span>
          <Input
            name="marks"
            type="number"
            min={1}
            value={marks}
            onChange={(event) => setMarks(Number(event.target.value))}
            required
          />
        </label>
        {includeAdminFields ? (
          <label>
            <span className="field-label">Source</span>
            <Input name="source" placeholder="Exercise / Additional" />
          </label>
        ) : null}
      </div>

      <label className="block">
        <span className="field-label">
          Question (English) <span className="req-mark">*</span>
        </span>
        <textarea
          name="text"
          required
          className="field-area"
          placeholder="Write the question clearly..."
        />
      </label>

      {includeUrdu ? (
        <label className="block">
          <span className="field-label">Question (Urdu — optional)</span>
          <textarea
            name="textUrdu"
            className="field-area"
            dir="rtl"
            placeholder="اردو میں سوال..."
          />
        </label>
      ) : null}

      {type === "MCQ" ? (
        <section className="space-y-3 rounded-[1.1rem] border border-[rgba(15,40,70,0.08)] bg-mist/50 p-4 md:p-5">
          <p className="text-sm font-semibold text-ink-soft">
            MCQ options <span className="req-mark">*</span>
          </p>
          <div className="form-grid form-grid-2">
            <Input name="optionA" placeholder="Option A" required />
            <Input name="optionB" placeholder="Option B" required />
            <Input name="optionC" placeholder="Option C" required />
            <Input name="optionD" placeholder="Option D" required />
          </div>
          <label>
            <span className="field-label">Correct answer</span>
            <SearchSelect
              value={correctAnswer}
              options={[
                { value: "A", label: "A — Option A" },
                { value: "B", label: "B — Option B" },
                { value: "C", label: "C — Option C" },
                { value: "D", label: "D — Option D" },
              ]}
              onChange={setCorrectAnswer}
              placeholder="Select correct answer"
              searchPlaceholder="Search answers…"
              ariaLabel="Correct answer"
            />
            <input type="hidden" name="correctAnswer" value={correctAnswer} />
          </label>
        </section>
      ) : null}
    </>
  );
}

function QuestionSelect({
  label,
  value,
  children,
}: {
  label: string;
  value: string;
  children: React.ReactNode;
}) {
  return (
    <label>
      <span className="field-label">
        {label} <span className="req-mark">*</span>
      </span>
      <input type="hidden" value={value} readOnly />
      {children}
    </label>
  );
}
