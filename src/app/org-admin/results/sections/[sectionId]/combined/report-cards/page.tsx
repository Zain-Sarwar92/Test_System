import Link from "next/link";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { PageHeader, PageStack } from "@/components/page-header";
import { ResultsBackLink } from "@/app/org-admin/results/results-back-link";
import {
  loadCombinedSectionResult,
  parseExamIds,
} from "@/app/org-admin/results/load-combined-section-result";
import { ReportCardStudentTable } from "@/app/org-admin/results/report-card-student-table";
import { requireRole } from "@/lib/rbac";

export default async function CombinedReportCardsIndexPage({
  params,
  searchParams,
}: {
  params: Promise<{ sectionId: string }>;
  searchParams: Promise<{ exams?: string }>;
}) {
  const session = await requireRole(["ORG_ADMIN"]);
  const organizationId = session.user.organizationId;
  const { sectionId } = await params;
  const examIds = parseExamIds((await searchParams).exams);
  if (!organizationId || examIds.length === 0) notFound();

  const data = await loadCombinedSectionResult({
    organizationId,
    sectionId,
    examIds,
  });
  if (!data) notFound();

  const examsQuery = data.examIds.join(",");
  const combinedHref = `/org-admin/results/sections/${data.section.id}/combined?exams=${encodeURIComponent(examsQuery)}`;
  const title = data.exams.map((e) => e.name).join(" + ");

  return (
    <PageStack wide>
      <PageHeader
        kicker={`${data.section.class.board.name} · ${data.section.class.name} · ${data.section.name}`}
        title="Combined report cards"
        description={`${title} · Session ${data.sessionLabel}`}
        actions={
          <div className="flex flex-wrap gap-2">
            <ResultsBackLink href={`/org-admin/results/sections/${data.section.id}`} />
            <Link href={combinedHref}>
              <Button variant="outline" size="sm">
                Combined gazette
              </Button>
            </Link>
            <Link
              href={`/org-admin/results/sections/${data.section.id}/combined/report-cards/print-all?exams=${encodeURIComponent(examsQuery)}`}
            >
              <Button size="sm">Print all cards</Button>
            </Link>
          </div>
        }
      />

      <ReportCardStudentTable
        rows={data.rows.map((row) => ({
          id: row.id,
          rollNumber: row.rollNumber,
          name: row.name,
          fatherName: row.fatherName,
          obtainedTotal: row.obtainedTotal,
          maxTotal: row.maxTotal,
          percent: row.percent,
          grade: row.grade,
          position: row.position,
        }))}
        cardHrefPrefix={`/org-admin/results/sections/${data.section.id}/combined/report-cards/`}
        cardHrefSuffix={`?exams=${encodeURIComponent(examsQuery)}`}
      />
    </PageStack>
  );
}
