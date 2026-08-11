import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { PageHeader, PageStack } from "@/components/page-header";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";
import { submitSuggestion } from "./actions";

export default async function TeacherSuggestionsPage() {
  const session = await requireRole(["TEACHER"]);

  const [topics, mySuggestions] = await Promise.all([
    prisma.topic.findMany({
      orderBy: [{ chapter: { order: "asc" } }, { order: "asc" }],
      include: {
        chapter: {
          include: {
            subject: {
              include: {
                class: { include: { board: true } },
              },
            },
          },
        },
      },
      take: 200,
    }),
    prisma.questionSuggestion.findMany({
      where: { teacherId: session.user.id },
      orderBy: { createdAt: "desc" },
      take: 10,
      include: {
        topic: { select: { name: true } },
      },
    }),
  ]);

  return (
    <PageStack>
      <PageHeader
        kicker="Contribute"
        title="Suggest Question"
        description="Submit a question for Super Admin review. Approved items enter the global bank."
      />

      <Card>
        <CardTitle>New suggestion</CardTitle>
        <CardDescription>
          You cannot edit the bank directly — suggestions stay pending until approved.
        </CardDescription>
        <form action={submitSuggestion} className="mt-5 space-y-4">
          <label className="block">
            <span className="field-label">Topic</span>
            <select name="topicId" className="field-control" required defaultValue="">
              <option value="" disabled>
                Select topic
              </option>
              {topics.map((topic) => (
                <option key={topic.id} value={topic.id}>
                  {topic.chapter.subject.class.board.name} ·{" "}
                  {topic.chapter.subject.class.name} · {topic.chapter.subject.name} ·{" "}
                  {topic.chapter.name} · {topic.name}
                </option>
              ))}
            </select>
          </label>

          <div className="form-grid form-grid-2">
            <label>
              <span className="field-label">Type</span>
              <select name="type" className="field-control" defaultValue="SHORT">
                <option value="SHORT">Short</option>
                <option value="LONG">Long</option>
                <option value="MCQ">MCQ</option>
              </select>
            </label>
            <label>
              <span className="field-label">Marks</span>
              <Input name="marks" type="number" min={1} defaultValue={2} required />
            </label>
          </div>

          <label className="block">
            <span className="field-label">Question</span>
            <textarea name="text" className="field-area" required placeholder="Write your question..." />
          </label>

          <div className="form-grid form-grid-2">
            <Input name="optionA" placeholder="MCQ option A (if MCQ)" />
            <Input name="optionB" placeholder="MCQ option B (if MCQ)" />
            <Input name="optionC" placeholder="MCQ option C (if MCQ)" />
            <Input name="optionD" placeholder="MCQ option D (if MCQ)" />
          </div>
          <Input name="correctAnswer" placeholder="MCQ correct answer (if MCQ)" />

          <Button type="submit">Submit for review</Button>
        </form>
      </Card>

      <Card>
        <CardTitle>My recent suggestions</CardTitle>
        <div className="mt-4 list-stack">
          {mySuggestions.length === 0 ? (
            <CardDescription>No suggestions yet.</CardDescription>
          ) : null}
          {mySuggestions.map((item) => (
            <div
              key={item.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-[0.85rem] border border-[rgba(15,40,70,0.08)] bg-white/80 px-3 py-2.5"
            >
              <div className="min-w-0">
                <p className="truncate text-sm text-ink">{item.text}</p>
                <p className="text-xs text-muted">{item.topic.name}</p>
              </div>
              <span
                className={
                  item.status === "APPROVED"
                    ? "status-chip status-chip-success"
                    : item.status === "REJECTED"
                      ? "status-chip status-chip-muted"
                      : "status-chip status-chip-warn"
                }
              >
                {item.status}
              </span>
            </div>
          ))}
        </div>
      </Card>
    </PageStack>
  );
}
