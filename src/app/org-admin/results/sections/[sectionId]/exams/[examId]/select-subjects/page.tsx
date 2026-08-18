import Link from "next/link";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { PageHeader, PageStack } from "@/components/page-header";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";
import { resolveSubjectMeta } from "@/lib/subject-stream";
import { SelectExamSubjectsForm } from "./select-exam-subjects-form";

export default async function SelectExamSubjectsPage({
  params,
}: {
  params: Promise<{ sectionId: string; examId: string }>;
}) {
  const session = await requireRole(["ORG_ADMIN"]);
  const organizationId = session.user.organizationId;
  const { sectionId, examId } = await params;
  if (!organizationId) notFound();

  const [section, exam, assessments] = await Promise.all([
    prisma.section.findFirst({
      where: { id: sectionId, organizationId },
      select: {
        id: true,
        name: true,
        class: {
          select: {
            name: true,
            board: { select: { name: true } },
            subjects: {
              orderBy: { name: "asc" },
              select: {
                id: true,
                name: true,
                track: true,
                electiveGroup: true,
              },
            },
          },
        },
      },
    }),
    prisma.examTerm.findFirst({ where: { id: examId, organizationId } }),
    prisma.subjectAssessment.findMany({
      where: { organizationId, sectionId, examTermId: examId },
      select: { subjectId: true },
    }),
  ]);
  if (!section || !exam) notFound();

  const subjects = section.class.subjects.map((subject) => {
    const meta = resolveSubjectMeta(subject);
    return {
      id: subject.id,
      name: subject.name,
      track: meta.track,
      electiveGroup: meta.electiveGroup,
    };
  });

  return (
    <PageStack wide>
      <PageHeader
        kicker={`${section.class.board.name} · ${section.class.name} · ${section.name}`}
        title={`Choose subjects · ${exam.name}`}
        description={`Session ${exam.session}. Select subjects for this result before entering marks.`}
        actions={
          <Link href={`/org-admin/results/sections/${section.id}/exams/${exam.id}`}>
            <Button variant="secondary">Back to exam</Button>
          </Link>
        }
      />

      {subjects.length === 0 ? (
        <Card>
          <CardTitle>No subjects on this class</CardTitle>
          <CardDescription>
            Ask Super Admin to add subjects for {section.class.name} first.
          </CardDescription>
        </Card>
      ) : (
        <Card>
          <CardTitle>Result subjects</CardTitle>
          <CardDescription className="mb-4">
            Marks entry and gazette will only use the subjects you select here.
          </CardDescription>
          <SelectExamSubjectsForm
            sectionId={section.id}
            examId={exam.id}
            examName={exam.name}
            subjects={subjects}
            initialSubjectIds={assessments.map((row) => row.subjectId)}
          />
        </Card>
      )}
    </PageStack>
  );
}
