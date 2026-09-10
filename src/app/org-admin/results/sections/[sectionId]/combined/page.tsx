import { notFound } from "next/navigation";
import {
  loadCombinedSectionResult,
  parseExamIds,
} from "@/app/org-admin/results/load-combined-section-result";
import { requireRole } from "@/lib/rbac";
import { CombinedGazetteView } from "./combined-gazette-view";

export default async function CombinedResultsPage({
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
  const reportCardBaseHref = `/org-admin/results/sections/${data.section.id}/combined/report-cards?exams=${encodeURIComponent(examsQuery)}`;

  return (
    <CombinedGazetteView
      organization={data.section.organization}
      boardName={data.section.class.board.name}
      className={data.section.class.name}
      sectionName={data.section.name}
      session={data.sessionLabel}
      roundLabels={data.roundLabels}
      columns={data.columns}
      rows={data.rows}
      backHref={`/org-admin/results/sections/${data.section.id}`}
      reportCardBaseHref={reportCardBaseHref}
      phoneByStudentId={data.phoneByStudentId}
    />
  );
}
