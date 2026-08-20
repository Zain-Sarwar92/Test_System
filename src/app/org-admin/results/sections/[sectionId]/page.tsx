import { notFound } from "next/navigation";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { PageHeader, PageStack } from "@/components/page-header";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";
import { CreateExamForm } from "../../create-exam-form";
import { ResultExamList } from "../../result-exam-list";
import { ResultsBackLink } from "@/app/org-admin/results/results-back-link";

export default async function SectionExamsPage({
  params,
}: {
  params: Promise<{ sectionId: string }>;
}) {
  const session = await requireRole(["ORG_ADMIN"]);
  const organizationId = session.user.organizationId;
  const { sectionId } = await params;
  if (!organizationId) notFound();

  const section = await prisma.section.findFirst({
    where: { id: sectionId, organizationId },
    select: {
      id: true,
      name: true,
      class: { select: { id: true, name: true, board: { select: { name: true } } } },
      _count: { select: { students: true } },
    },
  });
  if (!section) notFound();

  const exams = await prisma.examTerm.findMany({
    where: { organizationId },
    orderBy: [{ session: "desc" }, { createdAt: "desc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      session: true,
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
  });

  return (
    <PageStack wide>
      <PageHeader
        kicker={`${section.class.board.name} · ${section.class.name}`}
        title={`${section.name} results`}
        actions={
          <ResultsBackLink href={`/org-admin/results/classes/${section.class.id}`} />
        }
      />

      <Card>
        <CardTitle>New result</CardTitle>
  
        <CreateExamForm sectionId={section.id} />
      </Card>

      {exams.length === 0 ? (
        <Card>
          <CardTitle>No results yet</CardTitle>
          <CardDescription>Create the first result above.</CardDescription>
        </Card>
      ) : (
        <ResultExamList
          sectionId={section.id}
          sectionName={section.name}
          exams={exams.map((exam) => ({
            id: exam.id,
            name: exam.name,
            session: exam.session,
            passPercent: exam.passPercent,
            subjectCount: exam._count.assessments,
          }))}
        />
      )}
    </PageStack>
  );
}
