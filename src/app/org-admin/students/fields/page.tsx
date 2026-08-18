import { PageHeader, PageStack } from "@/components/page-header";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";
import { FieldManager } from "./field-manager";

export default async function StudentFieldsPage() {
  const session = await requireRole(["ORG_ADMIN"]);
  const organizationId = session.user.organizationId;
  const rows = organizationId
    ? await prisma.studentFieldDefinition.findMany({
        where: { organizationId },
        orderBy: [{ order: "asc" }, { createdAt: "asc" }],
      })
    : [];

  return (
    <PageStack wide>
      <PageHeader
        kicker="Students"
        title="Custom Fields"
        description="Capture organization-specific details on every student profile."
      />
      <FieldManager
        fields={rows.map((field) => ({
          id: field.id,
          label: field.label,
          type: field.type,
          options: Array.isArray(field.options)
            ? field.options.filter(
                (option): option is string => typeof option === "string",
              )
            : [],
          isRequired: field.isRequired,
          isActive: field.isActive,
        }))}
      />
    </PageStack>
  );
}
