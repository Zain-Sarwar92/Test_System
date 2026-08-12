import { redirect } from "next/navigation";
import { Building2 } from "lucide-react";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import {
  requireSession,
  resolveUserRole,
  dashboardPathForRole,
  getOrgMemberships,
} from "@/lib/rbac";
import { selectOrganizationAction } from "./actions";

export default async function SelectOrgPage() {
  const session = await requireSession();
  const role = await resolveUserRole(session);

  if (role === "SUPER_ADMIN") {
    redirect(dashboardPathForRole(role));
  }

  const memberships = await getOrgMemberships(session.user.id);

  if (memberships.length === 0) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-[var(--paper)] p-4 sm:p-6">
        <Card className="max-w-md text-center">
          <CardTitle>No organizations</CardTitle>
          <CardDescription className="mt-2">
            Your account is not linked to any active organization. Contact your
            administrator to get access.
          </CardDescription>
        </Card>
      </div>
    );
  }

  if (memberships.length === 1) {
    const m = memberships[0];
    if (session.user.organizationId === m.organizationId) {
      redirect(dashboardPathForRole(m.role));
    }
  }

  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-[var(--paper)] p-4 sm:p-6">
      <div className="w-full max-w-lg space-y-5">
        <div className="text-center">
          <p className="text-xs font-semibold tracking-[0.28em] text-brand uppercase">
            Select workspace
          </p>
          <h1 className="mt-2 text-2xl font-semibold text-ink">
            Choose an organization
          </h1>
          <p className="mt-1 text-sm text-muted">
            You have access to {memberships.length} organization(s).
          </p>
        </div>

        <div className="space-y-3">
          {memberships.map((m) => (
            <form key={m.id} action={selectOrganizationAction}>
              <input type="hidden" name="organizationId" value={m.organizationId} />
              <button
                type="submit"
                className="group flex w-full items-center gap-4 rounded-2xl border border-[rgba(15,40,70,0.1)] bg-white px-5 py-4 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#e8f7f4] text-brand">
                  <Building2 className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-ink">
                    {m.organization.name}
                  </p>
                  <p className="mt-0.5 text-xs text-muted">
                    Role: {m.role === "ORG_ADMIN" ? "Admin" : "Teacher"}
                    {session.user.organizationId === m.organizationId
                      ? " · Currently active"
                      : ""}
                  </p>
                </div>
                <span className="text-xs font-medium text-brand opacity-0 transition-opacity group-hover:opacity-100">
                  Switch →
                </span>
              </button>
            </form>
          ))}
        </div>
      </div>
    </div>
  );
}
