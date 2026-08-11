"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireSession, switchActiveOrg, dashboardPathForRole } from "@/lib/rbac";

export async function selectOrganizationAction(formData: FormData) {
  const session = await requireSession();
  const organizationId = formData.get("organizationId") as string;
  if (!organizationId) throw new Error("Organization is required");

  const membership = await switchActiveOrg(session.user.id, organizationId);
  revalidatePath("/", "layout");
  revalidatePath("/teacher", "layout");
  revalidatePath("/teacher/tests");
  revalidatePath("/org-admin", "layout");
  redirect(dashboardPathForRole(membership.role));
}
