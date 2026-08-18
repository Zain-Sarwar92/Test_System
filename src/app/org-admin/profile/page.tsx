import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { PageHeader, PageStack } from "@/components/page-header";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";
import { updateOrgProfile } from "./actions";

export default async function OrgProfilePage() {
  const session = await requireRole(["ORG_ADMIN"]);
  const organizationId = session.user.organizationId;

  if (!organizationId) {
    return (
      <PageStack>
        <PageHeader title="Profile" description="No organization linked." />
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

      <Card className="fade-up max-w-3xl">
        <CardTitle>{org.name}</CardTitle>
        <CardDescription>
          On the paper, the logo appears on the left, the school name in the center, and the address below.
          Required fields are marked with <span className="req-mark">*</span>
        </CardDescription>

        <form action={updateOrgProfile} className="mt-6 space-y-4">
          <label className="block">
            <span className="field-label">
              Organization name <span className="req-mark">*</span>
            </span>
            <Input name="name" defaultValue={org.name} required />
          </label>

          <div className="form-grid form-grid-2">
            <label>
              <span className="field-label">Phone</span>
              <Input
                name="phone"
                defaultValue={org.phone ?? ""}
                placeholder="+92 300 0000000"
              />
            </label>
            <label>
              <span className="field-label">Logo URL (printed on papers)</span>
              <Input
                name="logoUrl"
                defaultValue={org.logoUrl ?? ""}
                placeholder="https://..."
              />
            </label>
          </div>

          <label className="block">
            <span className="field-label">
              Head office / address (printed on papers)
            </span>
            <textarea
              name="address"
              className="field-area"
              defaultValue={org.address ?? ""}
              placeholder="e.g. MAIN LAJPAT ROAD SHAHDARA, LAHORE"
            />
          </label>

          <fieldset className="rounded-[1rem] border border-[rgba(15,40,70,0.1)] bg-[#f8fbfd] p-4">
            <legend className="px-1 text-sm font-semibold text-ink">
              Teacher curriculum access
            </legend>
            <p className="mb-3 text-sm text-muted">
              Control what teachers can use when creating an unscheduled test.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="cursor-pointer">
                <input
                  type="radio"
                  name="curriculumAccessMode"
                  value="ASSIGNED_ONLY"
                  defaultChecked={org.curriculumAccessMode === "ASSIGNED_ONLY"}
                  className="peer sr-only"
                />
                <span className="block rounded-[0.9rem] border border-[rgba(15,40,70,0.12)] bg-white p-4 transition peer-checked:border-brand peer-checked:bg-brand/10">
                  <span className="block text-sm font-semibold text-ink">
                    Assigned subjects only
                  </span>
                  <span className="mt-1 block text-xs leading-relaxed text-muted">
                    Teachers only see classes and subjects assigned to them.
                  </span>
                </span>
              </label>
              <label className="cursor-pointer">
                <input
                  type="radio"
                  name="curriculumAccessMode"
                  value="ALL_CURRICULUM"
                  defaultChecked={org.curriculumAccessMode === "ALL_CURRICULUM"}
                  className="peer sr-only"
                />
                <span className="block rounded-[0.9rem] border border-[rgba(15,40,70,0.12)] bg-white p-4 transition peer-checked:border-brand peer-checked:bg-brand/10">
                  <span className="block text-sm font-semibold text-ink">
                    All classes and subjects
                  </span>
                  <span className="mt-1 block text-xs leading-relaxed text-muted">
                    Every teacher can create unscheduled tests from the full curriculum.
                  </span>
                </span>
              </label>
            </div>
          </fieldset>

          <div className="rounded-[0.9rem] border border-[rgba(15,40,70,0.08)] bg-mist/40 px-4 py-3 text-sm text-muted">
            Slug: <span className="font-medium text-ink-soft">{org.slug}</span> · Status:{" "}
            <span className="font-medium text-ink-soft">
              {org.isActive ? "Active" : "Inactive"}
            </span>
          </div>

          <Button type="submit">Save profile</Button>
        </form>
      </Card>
    </PageStack>
  );
}
