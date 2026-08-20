import Link from "next/link";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { PageHeader, PageStack } from "@/components/page-header";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";
import {
  deleteResultSeries,
  deleteSectionExamResult,
} from "../../../../actions";
import { ConfirmForm } from "../../../../confirm-form";
import { AddRoundForm } from "./add-round-form";
import { CombineRoundsForm } from "./combine-rounds-form";

export default async function SectionSeriesPage({
  params,
}: {
  params: Promise<{ sectionId: string; seriesId: string }>;
}) {
  const session = await requireRole(["ORG_ADMIN"]);
  const organizationId = session.user.organizationId;
  const { sectionId, seriesId } = await params;
  if (!organizationId) notFound();

  const [section, series] = await Promise.all([
    prisma.section.findFirst({
      where: { id: sectionId, organizationId },
      select: {
        id: true,
        name: true,
        class: { select: { id: true, name: true, board: { select: { name: true } } } },
      },
    }),
    prisma.resultSeries.findFirst({
      where: { id: seriesId, organizationId },
      select: {
        id: true,
        name: true,
        session: true,
        passPercent: true,
        rounds: {
          orderBy: { roundOrder: "asc" },
          select: {
            id: true,
            name: true,
            roundOrder: true,
            examDate: true,
            passPercent: true,
            _count: {
              select: {
                assessments: {
                  where: {
                    sectionId,
                    marks: {
                      some: {
                        OR: [{ obtainedMarks: { not: null } }, { isAbsent: true }],
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    }),
  ]);
  if (!section || !series) notFound();

  return (
    <PageStack wide>
      <PageHeader
        kicker={`${section.class.board.name} · ${section.class.name} · ${section.name}`}
        title={series.name}
        description={`Session ${series.session}. Add rounds, enter marks for each round, then combine any rounds into one gazette.`}
        actions={
          <div className="flex flex-wrap gap-2">
            <Link href={`/org-admin/results/sections/${section.id}`}>
              <Button variant="secondary">Back to section</Button>
            </Link>
            <ConfirmForm
              action={deleteResultSeries}
              message={`Delete series "${series.name}" and all its rounds for the whole school?`}
            >
              <input type="hidden" name="seriesId" value={series.id} />
              <input type="hidden" name="sectionId" value={section.id} />
              <Button type="submit" variant="danger">
                Delete series
              </Button>
            </ConfirmForm>
          </div>
        }
      />

      <Card>
        <CardTitle>Add round</CardTitle>
        <CardDescription className="mb-4">
          Next round will be named automatically (Round {(series.rounds.at(-1)?.roundOrder ?? 0) + 1}).
          Pass mark for combined result: {series.passPercent}%.
        </CardDescription>
        <AddRoundForm sectionId={section.id} seriesId={series.id} />
      </Card>

      <Card>
        <CardTitle>Combine rounds</CardTitle>
        <CardDescription className="mb-4">
          Select rounds to sum into one result. Missing marks in a selected round count as zero.
        </CardDescription>
        <CombineRoundsForm
          sectionId={section.id}
          seriesId={series.id}
          rounds={series.rounds.map((round) => ({
            id: round.id,
            label: `Round ${round.roundOrder ?? "?"}`,
            hasMarks: round._count.assessments > 0,
          }))}
        />
      </Card>

      {series.rounds.length === 0 ? (
        <Card>
          <CardTitle>No rounds yet</CardTitle>
          <CardDescription>Add Round 1 above to start entering daily / regular test marks.</CardDescription>
        </Card>
      ) : (
        <div className="list-stack">
          {series.rounds.map((round) => (
            <div
              key={round.id}
              className="chart-card flex flex-col gap-3 rounded-[1rem] border border-[rgba(15,40,70,0.08)] bg-card px-4 py-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <p className="font-display text-lg font-semibold text-ink">
                  Round {round.roundOrder}
                </p>
                <p className="mt-1 text-sm text-muted">
                  {round.name}
                  {round.examDate
                    ? ` · ${round.examDate.toLocaleDateString("en-GB", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })}`
                    : ""}
                  {" · "}
                  {round._count.assessments} subject
                  {round._count.assessments === 1 ? "" : "s"} with marks
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Link href={`/org-admin/results/sections/${section.id}/exams/${round.id}`}>
                  <Button variant="secondary" size="sm">
                    Open
                  </Button>
                </Link>
                {round._count.assessments > 0 ? (
                  <Link href={`/org-admin/results/sections/${section.id}/exams/${round.id}/gazette`}>
                    <Button variant="outline" size="sm">
                      Round gazette
                    </Button>
                  </Link>
                ) : null}
                <ConfirmForm
                  action={deleteSectionExamResult}
                  message={`Remove Round ${round.roundOrder} result for ${section.name} only? Other sections keep their marks. The round stays in the series.`}
                >
                  <input type="hidden" name="sectionId" value={section.id} />
                  <input type="hidden" name="examTermId" value={round.id} />
                  <input
                    type="hidden"
                    name="returnTo"
                    value={`/org-admin/results/sections/${section.id}/series/${series.id}`}
                  />
                  <Button type="submit" variant="danger" size="sm">
                    Delete for this section
                  </Button>
                </ConfirmForm>
              </div>
            </div>
          ))}
        </div>
      )}
    </PageStack>
  );
}
