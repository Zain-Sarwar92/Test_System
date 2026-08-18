import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";
import { sortByRoll } from "@/lib/results";
import {
  isStudentEnrolledInSubject,
  resolveSubjectMeta,
  withChosenElectives,
} from "@/lib/subject-stream";
import { StudentListPrintView } from "./student-list-print-view";

export default async function SectionStudentListPrintPage({
  params,
  searchParams,
}: {
  params: Promise<{ sectionId: string }>;
  searchParams: Promise<{
    subject?: string;
    subjectId?: string;
    exam?: string;
    session?: string;
    totalMarks?: string;
    title?: string;
    date?: string;
  }>;
}) {
  const session = await requireRole(["ORG_ADMIN"]);
  const organizationId = session.user.organizationId;
  const { sectionId } = await params;
  const filters = await searchParams;
  if (!organizationId) notFound();

  const section = await prisma.section.findFirst({
    where: { id: sectionId, organizationId },
    select: {
      id: true,
      name: true,
      class: {
        select: {
          id: true,
          name: true,
          board: { select: { name: true } },
        },
      },
      organization: {
        select: {
          name: true,
          logoUrl: true,
          address: true,
          phone: true,
        },
      },
      students: {
        where: { organizationId, isActive: true },
        select: {
          id: true,
          rollNumber: true,
          name: true,
          fatherName: true,
          stream: true,
          electiveSubjectId: true,
          electiveChoices: { select: { subjectId: true } },
        },
      },
    },
  });

  if (!section) notFound();

  let students = section.students.map((student) => withChosenElectives(student));
  const subjectId = filters.subjectId?.trim();
  if (subjectId) {
    const subject = await prisma.subject.findFirst({
      where: { id: subjectId, classId: section.class.id },
      select: {
        id: true,
        name: true,
        track: true,
        electiveGroup: true,
      },
    });
    if (subject) {
      const meta = resolveSubjectMeta(subject);
      students = students.filter((student) =>
        isStudentEnrolledInSubject(student, meta),
      );
    }
  }

  students.sort((a, b) => sortByRoll(a.rollNumber, b.rollNumber));

  return (
    <StudentListPrintView
      organization={section.organization}
      boardName={section.class.board.name}
      className={section.class.name}
      sectionName={section.name}
      students={students}
      backHref={`/org-admin/students?classId=${section.class.id}&sectionId=${section.id}`}
      initialTitle={filters.title?.trim()}
      initialSession={filters.session?.trim()}
      initialSubject={filters.subject?.trim()}
      initialExam={filters.exam?.trim()}
      initialDate={filters.date?.trim()}
      initialTotalMarks={filters.totalMarks?.trim()}
    />
  );
}
