import Link from "next/link";
import { Building2, List } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { PageHeader, PageStack } from "@/components/page-header";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";
import { CreateOrgForm } from "./create-org-form";

export default async function OrganizationsPage() {
  await requireRole(["SUPER_ADMIN"]);
  const plans = await prisma.subscriptionPlan.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
  });

  return (
    <PageStack>
      <PageHeader
        kicker="Tenants"
        title="Organizations"
        description="Create a school/academy and its first org admin account."
        actions={
          <Link href="/super-admin/organizations/list">
            <Button variant="secondary">
              <List className="h-4 w-4" />
              View all
            </Button>
          </Link>
        }
      />

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(280px,0.7fr)]">
        <Card className="chart-card fade-up">
          <div className="flex items-start gap-3">
            <span className="stat-icon">
              <Building2 className="h-4 w-4" />
            </span>
            <div>
              <CardTitle>Create organization</CardTitle>
              <CardDescription>
                Required fields marked with <span className="req-mark">*</span>
              </CardDescription>
            </div>
          </div>

          <CreateOrgForm plans={plans.map((p) => ({ id: p.id, name: p.name }))} />
        </Card>

        <Card className="fade-up h-fit bg-gradient-to-br from-[#e8f7f4] to-white">
          <CardTitle className="text-base">What gets created</CardTitle>
          <ul className="mt-4 space-y-3 text-sm text-ink-soft">
            <li className="flex gap-2">
              <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-brand" />
              New organization with name, logo &amp; address for test header
            </li>
            <li className="flex gap-2">
              <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-brand" />
              Org Admin account with the email/password you set
            </li>
            <li className="flex gap-2">
              <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-brand" />
              Admin can refine branding later under Org Profile
            </li>
            <li className="flex gap-2">
              <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-brand" />
              Students, results, fees, and schedules stay off until you enable them
            </li>
          </ul>
        </Card>
      </div>
    </PageStack>
  );
}
