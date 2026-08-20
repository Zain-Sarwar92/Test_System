import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { PageHeader, PageStack } from "@/components/page-header";
import { loadCurriculumStructure } from "@/lib/curriculum-tree";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";
import { SuggestQuestionForm } from "./suggest-question-form";

export default async function TeacherSuggestionsPage() {
  const session = await requireRole(["TEACHER"]);

  const [boards, mySuggestions] = await Promise.all([
    loadCurriculumStructure(),
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

      <SuggestQuestionForm boards={boards} />

      <Card>
        <CardTitle>My recent suggestions</CardTitle>
        <div className="mt-4 list-stack">
          {mySuggestions.length === 0 ? (
            <CardDescription>No suggestions yet.</CardDescription>
          ) : null}
          {mySuggestions.map((item) => (
            <div
              key={item.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line bg-card px-3 py-2.5 shadow-[var(--shadow-soft)]"
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
