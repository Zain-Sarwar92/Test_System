import Link from "next/link";
import { notFound } from "next/navigation";
import { Building2, Power } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { PageHeader, PageStack } from "@/components/page-header";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";
import { deleteOrganization, toggleOrganizationActive, updateOrganization, updateOrganizationModules } from "../actions";
import { DeleteOrgButton } from "../delete-org-button";
import { OrgModuleCheckboxes } from "@/components/org-module-checkboxes";
import { LogoUploadField } from "@/components/logo-upload-field";
import { flagsFromOrg } from "@/lib/org-modules";

export default async function OrganizationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole(["SUPER_ADMIN"]);
  const { id } = await params;

  const org = await prisma.organization.findUnique({
    where: { id },
    include: {
      plan: true,
      users: {
        where: { role: "ORG_ADMIN" },
        select: { id: true, name: true, email: true, isActive: true },
      },
      _count: { select: { users: true, tests: true } },
    },
  });

  if (!org) notFound();

  const plans = await prisma.subscriptionPlan.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
  });

  const admin = org.users[0];

  return (
    <PageStack>
      <PageHeader
        kicker="Tenant"
        title={org.name}
        description={`${org.slug} · ${org._count.users} users · ${org._count.tests} tests`}
        actions={
          <Link href="/super-admin/organizations/list">
            <Button variant="secondary">Back to list</Button>
          </Link>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div className="space-y-4">
        <Card className="chart-card">
          <CardTitle>Edit organization</CardTitle>
          <CardDescription className="mt-1">
            Branding fields print on exam tests for this tenant.
          </CardDescription>
          <form
            action={updateOrganization}
            encType="multipart/form-data"
            className="mt-4 space-y-3"
          >
            <input type="hidden" name="id" value={org.id} />
            <label className="block">
              <span className="field-label">Name</span>
              <Input name="name" defaultValue={org.name} required className="mt-1" />
            </label>
            <label className="block">
              <span className="field-label">Slug</span>
              <Input name="slug" defaultValue={org.slug} required className="mt-1" />
            </label>
            <label className="block">
              <span className="field-label">Address</span>
              <Input name="address" defaultValue={org.address ?? ""} className="mt-1" />
            </label>
            <div className="form-grid form-grid-2">
              <label>
                <span className="field-label">Phone</span>
                <Input name="phone" defaultValue={org.phone ?? ""} className="mt-1" />
              </label>
              <label>
                <span className="field-label">Logo URL</span>
                <Input
                  name="logoUrl"
                  defaultValue={
                    org.logoUrl?.startsWith("data:") || org.logoUrl?.startsWith("/")
                      ? ""
                      : (org.logoUrl ?? "")
                  }
                  className="mt-1"
                  placeholder="https://example.com/logo.png"
                />
              </label>
            </div>
            <div>
              <span className="field-label">Or upload logo</span>
              <div className="mt-1">
                <LogoUploadField currentUrl={org.logoUrl} />
              </div>
            </div>
            <label className="block">
              <span className="field-label">Subscription plan</span>
              <select
                name="planId"
                defaultValue={org.planId ?? ""}
                className="mt-1 w-full rounded-xl border border-[rgba(15,40,70,0.12)] bg-white px-3 py-2 text-sm"
              >
                <option value="">No plan</option>
                {plans.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
            <Button type="submit">Save changes</Button>
          </form>
        </Card>

        <Card className="chart-card">
          <CardTitle>Modules</CardTitle>
          <CardDescription className="mt-1">
            Control which add-ons this organization can use. Core paper generation stays available.
          </CardDescription>
          <form action={updateOrganizationModules} className="mt-4 space-y-3">
            <input type="hidden" name="id" value={org.id} />
            <OrgModuleCheckboxes values={flagsFromOrg(org)} />
            <Button type="submit">Save modules</Button>
          </form>
        </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardTitle className="text-base">Status</CardTitle>
            <p className="mt-2 text-sm text-muted">
              {org.isActive ? "Active — users can sign in." : "Inactive — users blocked at login."}
            </p>
            <form action={toggleOrganizationActive} className="mt-3">
              <input type="hidden" name="id" value={org.id} />
              <Button type="submit" variant="outline" className="w-full">
                <Power className="h-4 w-4" />
                {org.isActive ? "Deactivate" : "Activate"}
              </Button>
            </form>
          </Card>

          <Card>
            <CardTitle className="text-base">Org admin</CardTitle>
            {admin ? (
              <p className="mt-2 text-sm text-ink-soft">
                {admin.name}
                <br />
                {admin.email}
              </p>
            ) : (
              <p className="mt-2 text-sm text-amber-700">No admin linked</p>
            )}
          </Card>

          <Card>
            <CardTitle className="text-base text-red-700">Danger zone</CardTitle>
            <CardDescription className="mt-1">
              Deletes org, tests, and unlinks users permanently.
            </CardDescription>
            <DeleteOrgButton orgId={org.id} />
          </Card>
        </div>
      </div>
    </PageStack>
  );
}
