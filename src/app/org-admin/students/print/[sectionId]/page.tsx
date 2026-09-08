import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";
import { sortByRoll } from "@/lib/results";
import {
  formatStudyGroupLabel,
  groupFilterOptionsForClass,
  isStoredStudyGroup,
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
    assessmentId?: string;
    withMarks?: string;
    back?: string;
    group?: string;
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
          studyGroup: true,
          electiveSubjectId: true,
          electiveChoices: { select: { subjectId: true } },
        },
      },
    },
  });

  if (!section) notFound();

  const groupOptions = groupFilterOptionsForClass(section.class.name);
  const requestedGroup = filters.group?.trim().toUpperCase() ?? "";
  const activeGroup =
    requestedGroup && groupOptions.some((option) => option.value === requestedGroup)
      ? requestedGroup
      : "";

  let students = section.students.map((student) => withChosenElectives(student));

  if (activeGroup) {
    students = students.filter((student) => {
      if (isStoredStudyGroup(activeGroup)) {
        return student.studyGroup === activeGroup;
      }
      if (activeGroup === "SCIENCE" || activeGroup === "ARTS") {
        return (
          student.studyGroup === activeGroup ||
          ((!student.studyGroup || student.studyGroup.trim() === "") &&
            student.stream === activeGroup)
        );
      }
      return true;
    });
  }

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

  const withMarks = filters.withMarks === "1" || filters.withMarks === "true";
  const assessmentId = filters.assessmentId?.trim();
  const markByStudent = new Map<
    string,
    { obtainedMarks: string | null; isAbsent: boolean }
  >();
  let resolvedTotalMarks = filters.totalMarks?.trim() || "";

  let manualPrintRows: Array<{
    id: string;
    rollNumber: string;
    name: string;
    fatherName: string;
    obtainedMarks: string | null;
    isAbsent: boolean;
  }> = [];

  if (withMarks && assessmentId) {
    const assessment = await prisma.subjectAssessment.findFirst({
      where: {
        id: assessmentId,
        organizationId,
        sectionId: section.id,
      },
      select: {
        totalMarks: true,
        marks: {
          select: {
            studentId: true,
            obtainedMarks: true,
            isAbsent: true,
          },
        },
        manualMarks: {
          select: {
            id: true,
            rollNumber: true,
            name: true,
            fatherName: true,
            obtainedMarks: true,
            isAbsent: true,
          },
          orderBy: [{ rollNumber: "asc" }, { name: "asc" }],
        },
      },
    });
    if (assessment) {
      for (const mark of assessment.marks) {
        markByStudent.set(mark.studentId, {
          obtainedMarks:
            mark.obtainedMarks != null ? String(Number(mark.obtainedMarks)) : null,
          isAbsent: mark.isAbsent,
        });
      }
      manualPrintRows = assessment.manualMarks.map((mark) => ({
        id: mark.id,
        rollNumber: mark.rollNumber,
        name: mark.name,
        fatherName: mark.fatherName,
        obtainedMarks:
          mark.obtainedMarks != null ? String(Number(mark.obtainedMarks)) : null,
        isAbsent: mark.isAbsent,
      }));
      if (!resolvedTotalMarks) {
        resolvedTotalMarks = String(Number(assessment.totalMarks));
      }
    }
  }

  const printStudents = [
    ...students.map((student) => {
      const mark = markByStudent.get(student.id);
      return {
        id: student.id,
        rollNumber: student.rollNumber,
        name: student.name,
        fatherName: student.fatherName,
        obtainedMarks: mark?.obtainedMarks ?? null,
        isAbsent: mark?.isAbsent ?? false,
      };
    }),
    ...manualPrintRows,
  ].sort((a, b) => sortByRoll(a.rollNumber, b.rollNumber));

  const backFromQuery = filters.back?.trim();
  const backParams = new URLSearchParams({
    classId: section.class.id,
    sectionId: section.id,
  });
  if (activeGroup) backParams.set("group", activeGroup);
  const backHref =
    backFromQuery && backFromQuery.startsWith("/org-admin/")
      ? backFromQuery
      : `/org-admin/students?${backParams.toString()}`;

  const groupLabel = activeGroup ? formatStudyGroupLabel(activeGroup) : undefined;
  const defaultTitle = groupLabel
    ? `${groupLabel} Student List`
    : "Student List";

  return (
    <StudentListPrintView
      organization={section.organization}
      boardName={section.class.board.name}
      className={section.class.name}
      sectionName={section.name}
      groupLabel={groupLabel}
      students={printStudents}
      backHref={backHref}
      initialTitle={filters.title?.trim() || defaultTitle}
      initialSession={filters.session?.trim()}
      initialSubject={filters.subject?.trim()}
      initialExam={filters.exam?.trim()}
      initialDate={filters.date?.trim()}
      initialTotalMarks={resolvedTotalMarks || undefined}
      withMarks={withMarks && (markByStudent.size > 0 || manualPrintRows.length > 0)}
    />
  );
}
