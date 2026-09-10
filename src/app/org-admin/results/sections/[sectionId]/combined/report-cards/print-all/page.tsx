import Link from "next/link";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { PrintButton } from "@/app/org-admin/results/print-button";
import { CombinedReportCardSheet } from "@/app/org-admin/results/combined-report-card-sheet";
import {
  loadCombinedSectionResult,
  parseExamIds,
} from "@/app/org-admin/results/load-combined-section-result";
import { requireRole } from "@/lib/rbac";

export default async function CombinedPrintAllReportCardsPage({
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
  const listHref = `/org-admin/results/sections/${data.section.id}/combined/report-cards?exams=${encodeURIComponent(examsQuery)}`;
  const examTitle = data.exams.map((e) => e.name).join(" + ");

  return (
    <div className="report-card-screen">
      <div className="report-card-toolbar no-print">
        <div>
          <p className="text-sm font-semibold text-ink">
            Print all combined · {examTitle} · {data.rows.length} students
          </p>
          <p className="text-xs text-muted">
            {data.section.class.name} {data.section.name} · each card on its own
            page
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={listHref}>
            <Button variant="secondary" size="sm">
              Back to list
            </Button>
          </Link>
          <PrintButton label="Print all cards" />
        </div>
      </div>

      <div className="report-card-batch">
        {data.rows.map((row, index) => (
          <CombinedReportCardSheet
            key={row.id}
            organization={data.section.organization}
            className={data.section.class.name}
            sectionName={data.section.name}
            examTitle={examTitle}
            session={data.sessionLabel}
            roundLabels={data.roundLabels}
            columns={data.columns}
            row={row}
            pageBreakAfter={index < data.rows.length - 1}
            passPercent={data.passPercent}
          />
        ))}
      </div>
    </div>
  );
}
