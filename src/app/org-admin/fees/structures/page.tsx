import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { PageHeader, PageStack } from "@/components/page-header";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";
import {
  addFeePlanItem,
  createFeeHead,
  createFeePlan,
  deleteFeeHead,
  deleteFeePlan,
  toggleFeeHead,
  toggleFeePlan,
} from "../actions";
import { FeesNav, FlashMessage, formatPkr } from "../components";

type Props = {
  searchParams: Promise<{ success?: string; error?: string }>;
};

export default async function FeeStructuresPage({ searchParams }: Props) {
  const session = await requireRole(["ORG_ADMIN"]);
  const organizationId = session.user.organizationId;
  if (!organizationId) throw new Error("Organization not linked to this admin");
  const messages = await searchParams;

  const [heads, plans, classes, sections] = await Promise.all([
    prisma.feeHead.findMany({
      where: { organizationId },
      orderBy: [{ isActive: "desc" }, { name: "asc" }],
      include: { _count: { select: { planItems: true, charges: true } } },
    }),
    prisma.feePlan.findMany({
      where: { organizationId },
      orderBy: [{ isActive: "desc" }, { name: "asc" }],
      include: {
        class: { select: { name: true, board: { select: { name: true } } } },
        section: { select: { name: true } },
        items: {
          orderBy: { createdAt: "asc" },
          include: { feeHead: { select: { name: true, isActive: true } } },
        },
      },
    }),
    prisma.class.findMany({
      orderBy: [{ board: { name: "asc" } }, { name: "asc" }],
      select: { id: true, name: true, board: { select: { name: true } } },
    }),
    prisma.section.findMany({
      where: { organizationId },
      orderBy: [{ class: { name: "asc" } }, { name: "asc" }],
      select: { id: true, name: true, classId: true, class: { select: { name: true } } },
    }),
  ]);
  const activeHeads = heads.filter((head) => head.isActive);

  return (
    <PageStack wide>
      <PageHeader
        kicker="Fees"
        title="Fee structures"
        description="Create organization-owned fee heads and class or section fee plans."
      />
      <FeesNav />
      <FlashMessage success={messages.success} error={messages.error} />

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardTitle>Create fee head</CardTitle>
          <CardDescription>Examples: Tuition Fee, Admission Fee, Lab Fee.</CardDescription>
          <form action={createFeeHead} className="mt-5 space-y-4">
            <label className="block">
              <span className="mb-1.5 block text-sm font-semibold text-ink">Name *</span>
              <Input name="name" required maxLength={100} placeholder="Tuition Fee" />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-semibold text-ink">Description</span>
              <textarea
                name="description"
                maxLength={500}
                rows={3}
                className="field-control w-full"
                placeholder="Optional internal description"
              />
            </label>
            <Button type="submit">Create fee head</Button>
          </form>
        </Card>

        <Card>
          <CardTitle>Create fee plan</CardTitle>
          <CardDescription>
            Start with one item, then add more fee heads to the plan below.
          </CardDescription>
          <form action={createFeePlan} className="mt-5 grid gap-4 sm:grid-cols-2">
            <label className="block sm:col-span-2">
              <span className="mb-1.5 block text-sm font-semibold text-ink">Plan name *</span>
              <Input name="name" required maxLength={100} placeholder="Class 9 Monthly Fees" />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-semibold text-ink">Class *</span>
              <select name="classId" required className="field-control h-11 w-full">
                <option value="">Select class</option>
                {classes.map((klass) => (
                  <option key={klass.id} value={klass.id}>
                    {klass.board.name} — {klass.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-semibold text-ink">
                Section (optional)
              </span>
              <select name="sectionId" className="field-control h-11 w-full">
                <option value="">All sections in class</option>
                {sections.map((section) => (
                  <option key={section.id} value={section.id}>
                    {section.class.name} — {section.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-semibold text-ink">Fee head *</span>
              <select name="feeHeadId" required className="field-control h-11 w-full">
                <option value="">Select fee head</option>
                {activeHeads.map((head) => (
                  <option key={head.id} value={head.id}>
                    {head.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-semibold text-ink">Amount *</span>
              <Input name="amount" required inputMode="decimal" placeholder="2500.00" />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-semibold text-ink">Frequency *</span>
              <select name="frequency" defaultValue="MONTHLY" className="field-control h-11 w-full">
                <option value="MONTHLY">Monthly</option>
                <option value="QUARTERLY">Quarterly</option>
                <option value="ANNUAL">Annual</option>
                <option value="ONE_TIME">One time</option>
              </select>
            </label>
            <div className="flex items-end">
              <Button type="submit" disabled={!activeHeads.length}>
                Create fee plan
              </Button>
            </div>
          </form>
        </Card>
      </div>

      <Card>
        <CardTitle>Fee heads</CardTitle>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {heads.map((head) => (
            <div
              key={head.id}
              className="rounded-xl border border-line bg-card px-4 py-3 shadow-[var(--shadow-soft)]"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-ink">{head.name}</p>
                  <p className="mt-0.5 text-xs text-muted">
                    {head.description || "No description"} · {head._count.planItems} plan item(s) ·{" "}
                    {head._count.charges} charge(s)
                  </p>
                </div>
                <span className={`status-chip ${head.isActive ? "status-chip-ok" : ""}`}>
                  {head.isActive ? "Active" : "Inactive"}
                </span>
              </div>
              <div className="mt-3 flex gap-2">
                <form action={toggleFeeHead}>
                  <input type="hidden" name="id" value={head.id} />
                  <input type="hidden" name="active" value={String(!head.isActive)} />
                  <Button type="submit" size="sm" variant="outline">
                    {head.isActive ? "Deactivate" : "Activate"}
                  </Button>
                </form>
                {!head._count.planItems && !head._count.charges ? (
                  <form action={deleteFeeHead}>
                    <input type="hidden" name="id" value={head.id} />
                    <Button type="submit" size="sm" variant="danger">
                      Delete
                    </Button>
                  </form>
                ) : null}
              </div>
            </div>
          ))}
          {!heads.length ? <p className="text-sm text-muted">No fee heads yet.</p> : null}
        </div>
      </Card>

      <Card>
        <CardTitle>Fee plans</CardTitle>
        <div className="mt-4 space-y-4">
          {plans.map((plan) => (
            <div
              key={plan.id}
              className="rounded-[1rem] border border-line bg-card p-4 shadow-[var(--shadow-soft)]"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="font-display text-lg font-semibold text-ink">{plan.name}</p>
                  <p className="text-xs text-muted">
                    {plan.class.board.name} · {plan.class.name} ·{" "}
                    {plan.section ? `Section ${plan.section.name}` : "All class sections"}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <form action={toggleFeePlan}>
                    <input type="hidden" name="id" value={plan.id} />
                    <input type="hidden" name="active" value={String(!plan.isActive)} />
                    <Button type="submit" size="sm" variant="outline">
                      {plan.isActive ? "Deactivate" : "Activate"}
                    </Button>
                  </form>
                  <form action={deleteFeePlan}>
                    <input type="hidden" name="id" value={plan.id} />
                    <Button type="submit" size="sm" variant="danger">
                      Delete safely
                    </Button>
                  </form>
                </div>
              </div>
              <div className="mt-3 grid gap-2 md:grid-cols-2">
                {plan.items.map((item) => (
                  <div key={item.id} className="rounded-lg bg-mist/45 px-3 py-2 text-sm">
                    <span className="font-semibold text-ink">{item.feeHead.name}</span>
                    <span className="text-muted">
                      {" "}
                      · {formatPkr(item.amount)} · {item.frequency.replace("_", " ")}
                      {!item.feeHead.isActive ? " · head inactive" : ""}
                    </span>
                  </div>
                ))}
              </div>
              <form action={addFeePlanItem} className="mt-4 grid gap-3 md:grid-cols-4">
                <input type="hidden" name="planId" value={plan.id} />
                <select name="feeHeadId" required className="field-control h-10 w-full">
                  <option value="">Add fee head</option>
                  {activeHeads.map((head) => (
                    <option key={head.id} value={head.id}>
                      {head.name}
                    </option>
                  ))}
                </select>
                <Input name="amount" required inputMode="decimal" placeholder="Amount" className="h-10" />
                <select name="frequency" defaultValue="MONTHLY" className="field-control h-10 w-full">
                  <option value="MONTHLY">Monthly</option>
                  <option value="QUARTERLY">Quarterly</option>
                  <option value="ANNUAL">Annual</option>
                  <option value="ONE_TIME">One time</option>
                </select>
                <Button type="submit" size="sm" disabled={!activeHeads.length}>
                  Add item
                </Button>
              </form>
            </div>
          ))}
          {!plans.length ? <p className="text-sm text-muted">No fee plans yet.</p> : null}
        </div>
      </Card>
    </PageStack>
  );
}
