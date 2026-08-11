"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { BookPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { PageHeader, PageStack } from "@/components/page-header";
import { createQuestion } from "./actions";

type TopicOption = { id: string; name: string; order: number };
type ChapterOption = {
  id: string;
  name: string;
  order: number;
  topics: TopicOption[];
};
type SubjectOption = {
  id: string;
  name: string;
  chapters: ChapterOption[];
};
type ClassOption = {
  id: string;
  name: string;
  subjects: SubjectOption[];
};
type BoardOption = {
  id: string;
  name: string;
  classes: ClassOption[];
};

export function AddQuestionForm({ boards }: { boards: BoardOption[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [type, setType] = useState<"MCQ" | "SHORT" | "LONG">("SHORT");
  const [boardId, setBoardId] = useState(boards[0]?.id ?? "");
  const [classId, setClassId] = useState(boards[0]?.classes[0]?.id ?? "");
  const [subjectId, setSubjectId] = useState(
    boards[0]?.classes[0]?.subjects[0]?.id ?? "",
  );
  const [chapterId, setChapterId] = useState(
    boards[0]?.classes[0]?.subjects[0]?.chapters[0]?.id ?? "",
  );
  const [topicId, setTopicId] = useState(
    boards[0]?.classes[0]?.subjects[0]?.chapters[0]?.topics[0]?.id ?? "",
  );

  const selectedBoard = boards.find((b) => b.id === boardId);
  const selectedClass = selectedBoard?.classes.find((c) => c.id === classId);
  const selectedSubject = selectedClass?.subjects.find((s) => s.id === subjectId);
  const selectedChapter = selectedSubject?.chapters.find((c) => c.id === chapterId);
  const topics = selectedChapter?.topics ?? [];

  const topicLabel = useMemo(() => {
    const topic = topics.find((t) => t.id === topicId);
    if (!topic || !selectedChapter || !selectedSubject || !selectedClass || !selectedBoard) {
      return null;
    }
    return `${selectedBoard.name} · ${selectedClass.name} · ${selectedSubject.name} · ${selectedChapter.name} · ${topic.name}`;
  }, [
    topics,
    topicId,
    selectedChapter,
    selectedSubject,
    selectedClass,
    selectedBoard,
  ]);

  function syncFromBoard(nextBoardId: string) {
    const board = boards.find((b) => b.id === nextBoardId);
    const klass = board?.classes[0];
    const subject = klass?.subjects[0];
    const chapter = subject?.chapters[0];
    setBoardId(nextBoardId);
    setClassId(klass?.id ?? "");
    setSubjectId(subject?.id ?? "");
    setChapterId(chapter?.id ?? "");
    setTopicId(chapter?.topics[0]?.id ?? "");
  }

  function syncFromClass(nextClassId: string) {
    const klass = selectedBoard?.classes.find((c) => c.id === nextClassId);
    const subject = klass?.subjects[0];
    const chapter = subject?.chapters[0];
    setClassId(nextClassId);
    setSubjectId(subject?.id ?? "");
    setChapterId(chapter?.id ?? "");
    setTopicId(chapter?.topics[0]?.id ?? "");
  }

  function syncFromSubject(nextSubjectId: string) {
    const subject = selectedClass?.subjects.find((s) => s.id === nextSubjectId);
    const chapter = subject?.chapters[0];
    setSubjectId(nextSubjectId);
    setChapterId(chapter?.id ?? "");
    setTopicId(chapter?.topics[0]?.id ?? "");
  }

  function syncFromChapter(nextChapterId: string) {
    const chapter = selectedSubject?.chapters.find((c) => c.id === nextChapterId);
    setChapterId(nextChapterId);
    setTopicId(chapter?.topics[0]?.id ?? "");
  }

  function onSubmit(formData: FormData) {
    setError(null);
    setSuccess(null);
    startTransition(async () => {
      try {
        await createQuestion(formData);
        setSuccess("Question published to the global bank.");
        const form = document.getElementById(
          "add-question-form",
        ) as HTMLFormElement | null;
        form?.reset();
        setType("SHORT");
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to add question");
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
            Run `npm run db:import-biology` so topics are available for selection.
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
          id="add-question-form"
          action={onSubmit}
          className="mt-6 space-y-5 text-left"
        >
          <section className="space-y-3 rounded-[1.1rem] border border-[rgba(15,40,70,0.08)] bg-gradient-to-br from-[#f7fafc] to-white p-4 md:p-5">
            <p className="text-sm font-semibold text-ink-soft">Topic path</p>
            <div className="form-grid form-grid-2">
              <label>
                <span className="field-label">
                  Board <span className="req-mark">*</span>
                </span>
                <select
                  className="field-control"
                  value={boardId}
                  onChange={(e) => syncFromBoard(e.target.value)}
                >
                  {boards.map((board) => (
                    <option key={board.id} value={board.id}>
                      {board.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span className="field-label">
                  Class <span className="req-mark">*</span>
                </span>
                <select
                  className="field-control"
                  value={classId}
                  onChange={(e) => syncFromClass(e.target.value)}
                >
                  {(selectedBoard?.classes ?? []).map((klass) => (
                    <option key={klass.id} value={klass.id}>
                      {klass.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span className="field-label">
                  Subject <span className="req-mark">*</span>
                </span>
                <select
                  className="field-control"
                  value={subjectId}
                  onChange={(e) => syncFromSubject(e.target.value)}
                >
                  {(selectedClass?.subjects ?? []).map((subject) => (
                    <option key={subject.id} value={subject.id}>
                      {subject.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span className="field-label">
                  Chapter <span className="req-mark">*</span>
                </span>
                <select
                  className="field-control"
                  value={chapterId}
                  onChange={(e) => syncFromChapter(e.target.value)}
                >
                  {(selectedSubject?.chapters ?? []).map((chapter) => (
                    <option key={chapter.id} value={chapter.id}>
                      {chapter.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="md:col-span-2">
                <span className="field-label">
                  Topic <span className="req-mark">*</span>
                </span>
                <select
                  name="topicId"
                  className="field-control"
                  value={topicId}
                  onChange={(e) => setTopicId(e.target.value)}
                  required
                >
                  {topics.map((topic) => (
                    <option key={topic.id} value={topic.id}>
                      {topic.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            {topicLabel ? (
              <p className="rounded-[0.75rem] bg-[#e8f7f4] px-3 py-2 text-xs leading-relaxed text-brand-deep transition-all duration-300">
                Saving under: {topicLabel}
              </p>
            ) : null}
          </section>

          <div className="form-grid form-grid-3">
            <label>
              <span className="field-label">
                Type <span className="req-mark">*</span>
              </span>
              <select
                name="type"
                className="field-control"
                value={type}
                onChange={(e) => setType(e.target.value as "MCQ" | "SHORT" | "LONG")}
              >
                <option value="SHORT">Short</option>
                <option value="LONG">Long</option>
                <option value="MCQ">MCQ</option>
              </select>
            </label>
            <label>
              <span className="field-label">
                Marks <span className="req-mark">*</span>
              </span>
              <Input
                name="marks"
                type="number"
                min={1}
                defaultValue={type === "LONG" ? 5 : type === "MCQ" ? 1 : 2}
                required
              />
            </label>
            <label>
              <span className="field-label">Source</span>
              <Input name="source" placeholder="Exercise / Additional" />
            </label>
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

          <label className="block">
            <span className="field-label">Question (Urdu)</span>
            <textarea
              name="textUrdu"
              className="field-area"
              dir="rtl"
              placeholder="اردو میں سوال..."
            />
          </label>

          {type === "MCQ" ? (
            <section className="space-y-3 rounded-[1.1rem] border border-[rgba(15,40,70,0.08)] bg-mist/50 p-4 transition-all duration-300 md:p-5">
              <p className="text-sm font-semibold text-ink-soft">
                MCQ options <span className="req-mark">*</span>
              </p>
              <div className="form-grid form-grid-2">
                <Input name="optionA" placeholder="Option A" required />
                <Input name="optionB" placeholder="Option B" required />
                <Input name="optionC" placeholder="Option C" required />
                <Input name="optionD" placeholder="Option D" required />
              </div>
              <Input
                name="correctAnswer"
                placeholder="Correct answer (A / B / C / D)"
                required
              />
            </section>
          ) : null}

          {error ? (
            <p className="fade-up text-sm text-[#b42318]" role="alert">
              {error}
            </p>
          ) : null}
          {success ? (
            <p className="fade-up text-sm text-brand-deep" role="status">
              {success}
            </p>
          ) : null}

          <Button type="submit" size="lg" disabled={pending || !topicId}>
            {pending ? "Publishing..." : "Publish question"}
          </Button>
        </form>
      </Card>
    </PageStack>
  );
}
