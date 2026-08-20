import { Check, Inbox, X } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { PageHeader, PageStack } from "@/components/page-header";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";
import { approveSuggestion, bulkApproveSuggestions, rejectSuggestion } from "./actions";

export default async function SuggestionsPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>;
}) {
  await requireRole(["SUPER_ADMIN"]);
  const { type: typeFilter } = await searchParams;

  const pendingWhere = {
    status: "PENDING" as const,
    ...(typeFilter && typeFilter !== "ALL"
      ? { type: typeFilter as "MCQ" | "SHORT" | "LONG" }
      : {}),
  };

  const [pending, reviewed] = await Promise.all([
    prisma.questionSuggestion.findMany({
      where: pendingWhere,
      orderBy: { createdAt: "desc" },
      include: {
        teacher: { select: { name: true, email: true } },
        topic: {
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
        },
      },
    }),
    prisma.questionSuggestion.findMany({
      where: { status: { in: ["APPROVED", "REJECTED"] } },
      orderBy: { reviewedAt: "desc" },
      take: 10,
      include: {
        teacher: { select: { name: true } },
        topic: { select: { name: true } },
      },
    }),
  ]);

  const filters = ["ALL", "MCQ", "SHORT", "LONG"] as const;

  return (
    <PageStack>
      <PageHeader
        kicker="Review queue"
        title="Suggestions"
        description="Approve to publish into the global bank. Rejection requires a reason."
      />

      <div className="flex flex-wrap gap-2">
        {filters.map((f) => (
          <Link
            key={f}
            href={f === "ALL" ? "/super-admin/suggestions" : `/super-admin/suggestions?type=${f}`}
          >
            <Button
              size="sm"
              variant={(typeFilter ?? "ALL") === f || (!typeFilter && f === "ALL") ? "default" : "outline"}
            >
              {f}
            </Button>
          </Link>
        ))}
      </div>

      <div className="stats-grid">
        <Card className="min-h-[7.5rem] bg-gradient-to-br from-[#fff4e5] to-card">
          <div className="flex items-start justify-between gap-3">
            <CardDescription>Pending</CardDescription>
            <span className="stat-icon">
              <Inbox className="h-4 w-4" />
            </span>
          </div>
          <CardTitle className="mt-3 text-[2rem]">{pending.length}</CardTitle>
        </Card>
        <Card className="min-h-[7.5rem] bg-gradient-to-br from-[#e8f7f4] to-card">
          <div className="flex items-start justify-between gap-3">
            <CardDescription>Recently reviewed</CardDescription>
            <span className="stat-icon">
              <Check className="h-4 w-4" />
            </span>
          </div>
          <CardTitle className="mt-3 text-[2rem]">{reviewed.length}</CardTitle>
        </Card>
      </div>

      {pending.length > 1 ? (
        <form action={bulkApproveSuggestions} className="flex flex-wrap items-center gap-2">
          {pending.map((item) => (
            <input key={item.id} type="hidden" name="ids" value={item.id} />
          ))}
          <Button type="submit" variant="secondary" size="sm">
            Approve all visible ({pending.length})
          </Button>
        </form>
      ) : null}

      <div className="list-stack">
        {pending.length === 0 ? (
          <Card>
            <div className="flex items-start gap-3">
              <span className="stat-icon">
                <Inbox className="h-4 w-4" />
              </span>
              <div>
                <CardTitle>Queue is clear</CardTitle>
                <CardDescription className="mt-1">
                  No teacher suggestions waiting for review
                  {typeFilter ? ` (${typeFilter})` : ""}.
                </CardDescription>
              </div>
            </div>
          </Card>
        ) : null}

        {pending.map((item) => {
          const path = [
            item.topic.chapter.subject.class.board.name,
            item.topic.chapter.subject.class.name,
            item.topic.chapter.subject.name,
            item.topic.chapter.name,
            item.topic.name,
          ].join(" · ");

          return (
            <Card key={item.id} className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="status-chip status-chip-warn">{item.type}</span>
                <span className="status-chip status-chip-muted">{item.marks} marks</span>
              </div>
              <div>
                <CardTitle className="text-base leading-relaxed">{item.text}</CardTitle>
                {item.textUrdu ? (
                  <p
                    className="mt-2 text-right text-base leading-loose text-ink"
                    dir="rtl"
                  >
                    {item.textUrdu}
                  </p>
                ) : null}
                <CardDescription className="mt-2">{path}</CardDescription>
                <p className="mt-2 text-sm text-ink-soft">
                  Suggested by {item.teacher.name} ({item.teacher.email})
                </p>
              </div>

              {item.type === "MCQ" ? (
                <ul className="grid gap-1 text-sm text-muted md:grid-cols-2">
                  <li>A. {item.optionA}</li>
                  <li>B. {item.optionB}</li>
                  <li>C. {item.optionC}</li>
                  <li>D. {item.optionD}</li>
                  <li className="md:col-span-2 font-medium text-brand-deep">
                    Correct: {item.correctAnswer}
                  </li>
                </ul>
              ) : null}

              <div className="flex flex-col gap-3 border-t border-[rgba(15,40,70,0.08)] pt-4 sm:flex-row sm:items-end">
                <form action={approveSuggestion}>
                  <input type="hidden" name="id" value={item.id} />
                  <Button type="submit">
                    <Check className="h-4 w-4" />
                    Approve & publish
                  </Button>
                </form>
                <form
                  action={rejectSuggestion}
                  className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-center"
                >
                  <input type="hidden" name="id" value={item.id} />
                  <input
                    name="reviewNote"
                    placeholder="Rejection reason (required)"
                    className="field-control"
                    required
                  />
                  <Button type="submit" variant="danger" className="shrink-0">
                    <X className="h-4 w-4" />
                    Reject
                  </Button>
                </form>
              </div>
            </Card>
          );
        })}
      </div>

      {reviewed.length > 0 ? (
        <Card>
          <CardTitle>Recent decisions</CardTitle>
          <div className="mt-4 list-stack">
            {reviewed.map((item) => (
              <div
                key={item.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-[0.85rem] border border-[rgba(15,40,70,0.08)] bg-card/80 px-3 py-2.5"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm text-ink">{item.text}</p>
                  <p className="text-xs text-muted">
                    {item.teacher.name} · {item.topic.name}
                  </p>
                </div>
                <span
                  className={
                    item.status === "APPROVED"
                      ? "status-chip status-chip-success"
                      : "status-chip status-chip-muted"
                  }
                >
                  {item.status}
                </span>
              </div>
            ))}
          </div>
        </Card>
      ) : null}
    </PageStack>
  );
}
