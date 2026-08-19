import { PageHeader, PageStack } from "@/components/page-header";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";
import { OrgProfileForm } from "./org-profile-form";

export default async function OrgProfilePage() {
  const session = await requireRole(["ORG_ADMIN"]);
  const organizationId = session.user.organizationId;

  if (!organizationId) {
    return (
      <PageStack>
        <PageHeader
          title="Profile"
          description="No organization is linked to this account."
        />
      </PageStack>
    );
  }

  const org = await prisma.organization.findUniqueOrThrow({
    where: { id: organizationId },
  });

  return (
    <PageStack>
      <PageHeader
        kicker="Branding"
        title="Organization Profile"
        description="Update name, logo URL, and address — these details print on the exam paper header."
      />
      <OrgProfileForm
        org={{
          name: org.name,
          phone: org.phone,
          logoUrl: org.logoUrl,
          address: org.address,
          slug: org.slug,
          isActive: org.isActive,
          curriculumAccessMode: org.curriculumAccessMode,
        }}
      />
    </PageStack>
  );
}
