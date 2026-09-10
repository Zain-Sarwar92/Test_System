import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PrintButton } from "@/app/org-admin/results/print-button";
import { CombinedReportCardSheet } from "@/app/org-admin/results/combined-report-card-sheet";
import {
  loadCombinedSectionResult,
  parseExamIds,
} from "@/app/org-admin/results/load-combined-section-result";
import { requireRole } from "@/lib/rbac";

export default async function CombinedStudentReportCardPage({
  params,
  searchParams,
}: {
  params: Promise<{ sectionId: string; studentId: string }>;
  searchParams: Promise<{ exams?: string }>;
}) {
  const session = await requireRole(["ORG_ADMIN"]);
  const organizationId = session.user.organizationId;
  const { sectionId, studentId } = await params;
  const examIds = parseExamIds((await searchParams).exams);
  if (!organizationId || examIds.length === 0) notFound();

  const data = await loadCombinedSectionResult({
    organizationId,
    sectionId,
    examIds,
  });
  if (!data) notFound();

  const index = data.rows.findIndex((row) => row.id === studentId);
  if (index < 0) notFound();
  const row = data.rows[index]!;
  const prev = index > 0 ? data.rows[index - 1] : null;
  const next =
    index < data.rows.length - 1 ? data.rows[index + 1] : null;

  const examsQuery = data.examIds.join(",");
  const listHref = `/org-admin/results/sections/${data.section.id}/combined/report-cards?exams=${encodeURIComponent(examsQuery)}`;
  const cardHref = (id: string) =>
    `/org-admin/results/sections/${data.section.id}/combined/report-cards/${id}?exams=${encodeURIComponent(examsQuery)}`;
  const examTitle = data.exams.map((e) => e.name).join(" + ");

  return (
    <div className="report-card-screen">
      <div className="report-card-toolbar no-print">
        <div className="flex flex-wrap items-center gap-2">
          <Link href={listHref}>
            <Button variant="secondary" size="sm">
              All students
            </Button>
          </Link>
          <Link
            href={`/org-admin/results/sections/${data.section.id}/combined/report-cards/print-all?exams=${encodeURIComponent(examsQuery)}`}
          >
            <Button variant="outline" size="sm">
              Print all
            </Button>
          </Link>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {prev ? (
            <Link href={cardHref(prev.id)}>
              <Button variant="outline" size="sm">
                <ChevronLeft className="h-3.5 w-3.5" />
                Prev
              </Button>
            </Link>
          ) : null}
          {next ? (
            <Link href={cardHref(next.id)}>
              <Button variant="outline" size="sm">
                Next
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </Link>
          ) : null}
          <PrintButton label="Print report card" />
        </div>
      </div>

      <CombinedReportCardSheet
        organization={data.section.organization}
        className={data.section.class.name}
        sectionName={data.section.name}
        examTitle={examTitle}
        session={data.sessionLabel}
        roundLabels={data.roundLabels}
        columns={data.columns}
        row={row}
        passPercent={data.passPercent}
      />
    </div>
  );
}
