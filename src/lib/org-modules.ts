import { cache } from "react";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import {
  dashboardPathForRole,
  requireRole,
  resolveUserRole,
  type AppSession,
} from "@/lib/rbac";
import type { Role } from "@/generated/prisma/client";
import {
  DISABLED_ORG_MODULES,
  ORG_MODULES,
  flagsFromOrg,
  type OrgModuleFlags,
  type OrgModuleKey,
} from "@/lib/org-module-catalog";

export {
  DISABLED_ORG_MODULES,
  ORG_MODULE_KEYS,
  ORG_MODULES,
  flagsFromOrg,
  parseOrgModulesFromForm,
  type OrgModuleFlags,
  type OrgModuleKey,
  type OrgModuleRow,
} from "@/lib/org-module-catalog";

export const getOrgModuleFlags = cache(
  async (organizationId: string): Promise<OrgModuleFlags> => {
    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: {
        moduleStudents: true,
        moduleResults: true,
        moduleFees: true,
        moduleSchedules: true,
      },
    });
    return org ? flagsFromOrg(org) : DISABLED_ORG_MODULES;
  },
);

export async function orgHasModule(
  organizationId: string,
  module: OrgModuleKey,
) {
  const flags = await getOrgModuleFlags(organizationId);
  return flags[module];
}

export async function assertOrgModule(
  organizationId: string,
  module: OrgModuleKey,
) {
  if (await orgHasModule(organizationId, module)) return;
  throw new Error(
    `${ORG_MODULES[module].label} module is not enabled for this organization`,
  );
}

export async function requireOrgModule(
  module: OrgModuleKey,
  allowed: Role[] = ["ORG_ADMIN"],
): Promise<AppSession> {
  const session = await requireRole(allowed);
  const organizationId = session.user.organizationId;
  if (!organizationId) {
    redirect("/select-org");
  }
  if (!(await orgHasModule(organizationId, module))) {
    const role = await resolveUserRole(session);
    redirect(dashboardPathForRole(role));
  }
  return session;
}
