import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireRole, requireActiveOrganizationId } from "@/lib/rbac";
import { getSystemSettings } from "@/lib/system-settings";
import { assertCanCreateFromAssignment } from "@/lib/test-schedules";
import { loadCurriculumTreeForGenerate } from "@/lib/curriculum-tree";
import { loadTeacherAssignmentScope } from "@/lib/teacher-assignment-scope";
import { GenerateWizard } from "./generate-wizard";

type PageProps = {
  searchParams: Promise<{ assignmentId?: string }>;
};

export default async function TeacherGeneratePage({ searchParams }: PageProps) {
  const session = await requireRole(["TEACHER"]);
  const organizationId = await requireActiveOrganizationId(session.user.id);
  const settings = await getSystemSettings();
  const { assignmentId } = await searchParams;

  const organization = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: {
      name: true,
      logoUrl: true,
      address: true,
      phone: true,
      curriculumAccessMode: true,
    },
  });

  let scheduleContext:
    | {
        assignmentId: string;
        scheduleName: string;
        boardId: string;
        classId: string;
        subjectId: string;
        classSection: string | null;
        testDate: string;
        syllabusText: string | null;
      }
    | null = null;

  if (assignmentId) {
    try {
      const assignment = await assertCanCreateFromAssignment({
        assignmentId,
        teacherId: session.user.id,
        organizationId,
      });
      scheduleContext = {
        assignmentId: assignment.id,
        scheduleName: `${assignment.scheduleSubjectClass.scheduleSubject.round.schedule.name} · ${assignment.scheduleSubjectClass.scheduleSubject.round.name}`,
        boardId: assignment.scheduleSubjectClass.class.boardId,
        classId: assignment.scheduleSubjectClass.classId,
        subjectId: assignment.scheduleSubjectClass.subjectId,
        classSection: assignment.sectionName,
        syllabusText: assignment.syllabusText,
        testDate: (() => {
          const d = assignment.scheduleSubjectClass.scheduleSubject.testDate;
          const y = d.getFullYear();
          const m = String(d.getMonth() + 1).padStart(2, "0");
          const day = String(d.getDate()).padStart(2, "0");
          return `${y}-${m}-${day}`;
        })(),
      };
    } catch {
      redirect("/teacher/schedules");
    }
  }

  const hasFullCurriculum =
    organization?.curriculumAccessMode === "ALL_CURRICULUM";
  const teacherScope = hasFullCurriculum
    ? null
    : await loadTeacherAssignmentScope(session.user.id, organizationId);
  const payload = await loadCurriculumTreeForGenerate(
    hasFullCurriculum
      ? undefined
      : { teacherScope: teacherScope?.allowedKeys ?? new Set<string>() },
  );

  return (
    <GenerateWizard
      boards={payload}
      hasTeachingAssignments={
        hasFullCurriculum || (teacherScope?.allowedKeys.size ?? 0) > 0
      }
      teacherName={session.user.name}
      organization={organization}
      scheduleContext={scheduleContext}
      systemDefaults={{
        durationMinutes: Number(settings.default_duration_minutes) || 60,
        mcqMarks: Number(settings.default_mcq_marks) || 1,
        shortMarks: Number(settings.default_short_marks) || 2,
        longMarks: Number(settings.default_long_marks) || 5,
      }}
    />
  );
}
