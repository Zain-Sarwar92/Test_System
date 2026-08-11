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
