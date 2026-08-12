import { prisma } from "@/lib/prisma";
import { requireRole, requireActiveOrganizationId } from "@/lib/rbac";
import { getSystemSettings } from "@/lib/system-settings";
import { loadCurriculumTreeForGenerate } from "@/lib/curriculum-tree";
import { GenerateWizard } from "@/app/teacher/generate/generate-wizard";

export default async function OrgAdminGeneratePage() {
  const session = await requireRole(["ORG_ADMIN"]);
  const organizationId = await requireActiveOrganizationId(session.user.id);
  const settings = await getSystemSettings();

  const organization = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: {
      name: true,
      logoUrl: true,
      address: true,
      phone: true,
    },
  });

  const boards = await loadCurriculumTreeForGenerate();

  return (
    <GenerateWizard
      boards={boards}
      teacherName={session.user.name}
      organization={organization}
      testsRedirectPath="/org-admin/tests"
      schedulesRedirectPath="/org-admin/schedules"
      systemDefaults={{
        durationMinutes: Number(settings.default_duration_minutes) || 60,
        mcqMarks: Number(settings.default_mcq_marks) || 1,
        shortMarks: Number(settings.default_short_marks) || 2,
        longMarks: Number(settings.default_long_marks) || 5,
      }}
    />
  );
}
