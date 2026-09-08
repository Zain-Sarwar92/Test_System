import { notFound } from "next/navigation";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { PageHeader, PageStack } from "@/components/page-header";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";
import {
  inferResultSheetStream,
  resolveSubjectMeta,
} from "@/lib/subject-stream";
import { SelectExamSubjectsForm } from "./select-exam-subjects-form";
import { ResultsBackLink } from "@/app/org-admin/results/results-back-link";

export default async function SelectExamSubjectsPage({
  params,
}: {
  params: Promise<{ sectionId: string; examId: string }>;
}) {
  const session = await requireRole(["ORG_ADMIN"]);
  const organizationId = session.user.organizationId;
  const { sectionId, examId } = await params;
  if (!organizationId) notFound();

  const [section, exam, assessments, students] = await Promise.all([
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
            _count: {
              select: {
                sections: { where: { organizationId } },
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
    prisma.student.findMany({
      where: { organizationId, sectionId, isActive: true },
      select: {
        stream: true,
        studyGroup: true,
        electiveSubjectId: true,
        electiveChoices: { select: { subjectId: true } },
      },
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
  const siblingSectionCount = Math.max(0, section.class._count.sections - 1);
  const sheetStream = inferResultSheetStream(students);
  const chosenElectiveIds = [
    ...new Set(
      students.flatMap((student) => [
        ...(student.electiveSubjectId ? [student.electiveSubjectId] : []),
        ...student.electiveChoices.map((choice) => choice.subjectId),
      ]),
    ),
  ];

  return (
    <PageStack wide>
      <PageHeader
        kicker={`${section.class.board.name} · ${section.class.name} · ${section.name}`}
        title={`Edit subjects · ${exam.name}`}
        description={
          sheetStream === "ARTS"
            ? `Session ${exam.session}. Arts section — defaults are common + Arts (plus roster electives).`
            : `Session ${exam.session}. Science section — defaults are Science + common subjects.`
        }
        actions={
          <ResultsBackLink
            href={`/org-admin/results/sections/${section.id}/exams/${exam.id}`}
          />
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
          <SelectExamSubjectsForm
            sectionId={section.id}
            examId={exam.id}
            examName={exam.name}
            subjects={subjects}
            initialSubjectIds={assessments.map((row) => row.subjectId)}
            siblingSectionCount={siblingSectionCount}
            sheetStream={sheetStream}
            chosenElectiveIds={chosenElectiveIds}
          />
        </Card>
      )}
    </PageStack>
  );
}
