import { CreditCard, Plus, Power, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { PageHeader, PageStack } from "@/components/page-header";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";
import { createPlan, deletePlan, togglePlanActive } from "./actions";

export default async function PlansPage() {
  await requireRole(["SUPER_ADMIN"]);

  const plans = await prisma.subscriptionPlan.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { organizations: true } } },
  });

  return (
    <PageStack>
      <PageHeader
        kicker="Subscriptions"
        title="Plans"
        description="Assign limits to organizations. Billing is V2 — this is plan metadata only."
      />

      <Card className="chart-card">
        <CardTitle>Create plan</CardTitle>
        <form action={createPlan} className="mt-4 flex flex-wrap items-end gap-3">
          <label className="min-w-[160px] flex-1">
            <span className="field-label">Plan name</span>
            <Input name="name" placeholder="Standard" required className="mt-1" />
          </label>
          <label>
            <span className="field-label">Max teachers</span>
            <Input name="maxTeachers" type="number" min={0} placeholder="∞" className="mt-1 w-28" />
          </label>
          <label>
            <span className="field-label">Max tests</span>
            <Input name="maxTests" type="number" min={0} placeholder="∞" className="mt-1 w-28" />
          </label>
          <Button type="submit">
            <Plus className="h-4 w-4" />
            Add plan
          </Button>
        </form>
      </Card>

      <div className="list-stack">
        {plans.map((plan) => (
          <div
            key={plan.id}
            className="chart-card flex flex-col gap-3 rounded-[1rem] border border-[rgba(15,40,70,0.08)] bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="flex items-start gap-3">
              <span className="stat-icon">
                <CreditCard className="h-4 w-4" />
              </span>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-ink">{plan.name}</h3>
                  <span className={plan.isActive ? "status-chip status-chip-success" : "status-chip status-chip-muted"}>
                    {plan.isActive ? "Active" : "Inactive"}
                  </span>
                </div>
                <p className="mt-1 text-sm text-muted">
                  {plan._count.organizations} orgs · teachers{" "}
                  {plan.maxTeachers ?? "∞"} · tests {plan.maxTests ?? "∞"}
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <form action={togglePlanActive}>
                <input type="hidden" name="id" value={plan.id} />
                <Button type="submit" size="sm" variant="outline">
                  <Power className="h-3.5 w-3.5" />
                  {plan.isActive ? "Deactivate" : "Activate"}
                </Button>
              </form>
              <form action={deletePlan}>
                <input type="hidden" name="id" value={plan.id} />
                <Button type="submit" size="sm" variant="outline">
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </form>
            </div>
          </div>
        ))}
      </div>
    </PageStack>
  );
}
