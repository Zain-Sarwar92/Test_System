import Link from "next/link";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";
import { sortByRoll } from "@/lib/results";
import { StudentListPrintView } from "@/app/org-admin/students/print/[sectionId]/student-list-print-view";
import { PrintButton } from "@/app/org-admin/results/print-button";

export default async function PrintAllSubjectListsPage({
  params,
}: {
  params: Promise<{ sectionId: string; examId: string }>;
}) {
  const session = await requireRole(["ORG_ADMIN"]);
  const organizationId = session.user.organizationId;
  const { sectionId, examId } = await params;
  if (!organizationId) notFound();

  const [section, exam] = await Promise.all([
    prisma.section.findFirst({
      where: { id: sectionId, organizationId },
      select: {
        id: true,
        name: true,
        organization: {
          select: { name: true, logoUrl: true, address: true, phone: true },
        },
        class: {
          select: {
            name: true,
            board: { select: { name: true } },
          },
        },
        students: {
          where: { isActive: true },
          select: { id: true, rollNumber: true, name: true, fatherName: true },
        },
      },
    }),
    prisma.examTerm.findFirst({ where: { id: examId, organizationId } }),
  ]);
  if (!section || !exam) notFound();

  const assessments = await prisma.subjectAssessment.findMany({
    where: { organizationId, examTermId: exam.id, sectionId: section.id },
    include: {
      subject: { select: { id: true, name: true } },
    },
    orderBy: { subject: { name: "asc" } },
  });
  if (assessments.length === 0) notFound();

  const totalBySubject = new Map(
    assessments.map((row) => [row.subjectId, String(Number(row.totalMarks))]),
  );
  const selectedSubjects = assessments.map((row) => row.subject);
  const students = [...section.students].sort((a, b) =>
    sortByRoll(a.rollNumber, b.rollNumber),
  );
  const examDate = exam.examDate
    ? exam.examDate.toISOString().slice(0, 10)
    : undefined;

  return (
    <div className="print-page student-list-print">
      <div className="print-toolbar no-print">
        <Link href={`/org-admin/results/sections/${section.id}/exams/${exam.id}`}>
          <Button variant="outline" size="sm">Back to subjects</Button>
        </Link>
        <PrintButton label="Print all lists" />
      </div>
      <p className="print-screen-hint no-print">
        One award list per subject. Print / Save PDF to get every subject list for {section.class.name} {section.name}.
      </p>
      {selectedSubjects.map((subject) => (
        <StudentListPrintView
          key={subject.id}
          organization={section.organization}
          boardName={section.class.board.name}
          className={section.class.name}
          sectionName={section.name}
          students={students}
          backHref={`/org-admin/results/sections/${section.id}/exams/${exam.id}`}
          embedded
          initialTitle="Award List"
          initialSession={exam.session}
          initialSubject={subject.name}
          initialExam={exam.name}
          initialDate={examDate}
          initialTotalMarks={totalBySubject.get(subject.id) ?? "100"}
        />
      ))}
    </div>
  );
}
