import Link from "next/link";
import { Building2, Plus, Power, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { PageHeader, PageStack } from "@/components/page-header";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";
import { toggleOrganizationActive } from "../actions";

export default async function OrganizationsListPage() {
  await requireRole(["SUPER_ADMIN"]);

  const organizations = await prisma.organization.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      users: {
        where: { role: "ORG_ADMIN" },
        select: { id: true, name: true, email: true },
      },
      _count: {
        select: {
          users: true,
          tests: true,
        },
      },
    },
  });

  return (
    <PageStack>
      <PageHeader
        kicker="Tenants"
        title="All organizations"
        description="Browse tenants, check status, and activate or deactivate."
        actions={
          <Link href="/super-admin/organizations">
            <Button>
              <Plus className="h-4 w-4" />
              Create
            </Button>
          </Link>
        }
      />

      <div className="list-stack">
        {organizations.length === 0 ? (
          <Card>
            <div className="flex items-start gap-3">
              <span className="stat-icon">
                <Building2 className="h-4 w-4" />
              </span>
              <div>
                <CardTitle>No organizations yet</CardTitle>
                <CardDescription className="mt-2">
                  Create your first tenant to get started.
                </CardDescription>
                <Link href="/super-admin/organizations" className="mt-4 inline-block">
                  <Button size="sm">Create organization</Button>
                </Link>
              </div>
            </div>
          </Card>
        ) : null}

        {organizations.map((org, index) => {
          const admin = org.users[0];
          return (
            <div
              key={org.id}
              className="chart-card flex flex-col gap-4 rounded-[1.1rem] border border-[rgba(15,40,70,0.08)] bg-gradient-to-br from-white to-[#f7fafc] px-4 py-4 sm:flex-row sm:items-center sm:justify-between"
              style={{ animationDelay: `${index * 35}ms` }}
            >
              <div className="flex min-w-0 items-start gap-3 text-left">
                <span className="stat-icon mt-0.5 shrink-0">
                  <Building2 className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-display text-lg font-semibold text-ink">
                      {org.name}
                    </h3>
                    <span
                      className={
                        org.isActive
                          ? "status-chip status-chip-success"
                          : "status-chip status-chip-muted"
                      }
                    >
                      {org.isActive ? "Active" : "Inactive"}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-muted">
                    {org.slug} · {org._count.users} users · {org._count.tests} tests
                  </p>
                  {admin ? (
                    <p className="mt-2 text-sm text-ink-soft">
                      Admin: {admin.name} ({admin.email})
                    </p>
                  ) : (
                    <p className="mt-2 text-sm text-amber-700">No org admin linked</p>
                  )}
                </div>
              </div>
              <div className="flex shrink-0 flex-wrap gap-2">
                <Link href={`/super-admin/organizations/${org.id}`}>
                  <Button size="sm" variant="secondary">
                    <Settings2 className="h-3.5 w-3.5" />
                    Manage
                  </Button>
                </Link>
                <form action={toggleOrganizationActive}>
                  <input type="hidden" name="id" value={org.id} />
                  <Button type="submit" variant={org.isActive ? "outline" : "default"}>
                    <Power className="h-4 w-4" />
                    {org.isActive ? "Deactivate" : "Activate"}
                  </Button>
                </form>
              </div>
            </div>
          );
        })}
      </div>
    </PageStack>
  );
}
