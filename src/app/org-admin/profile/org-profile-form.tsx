"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { toast } from "@/components/ui/toast";
import { updateOrgProfile } from "./actions";
import { LogoUploadField } from "@/components/logo-upload-field";

const PHONE_DIGITS = /\d/g;
const HTTPS_LOGO_REF = /^https:\/\/.+\.(jpe?g|png|webp|gif)(\?.*)?$/i;
const LOCAL_LOGO_REF = /^\/(uploads\/org-logos\/|brand\/)/i;

function isEmbeddedLogo(url: string) {
  return url.startsWith("data:image/") || LOCAL_LOGO_REF.test(url);
}

export function OrgProfileForm({
  org,
}: {
  org: {
    name: string;
    phone: string | null;
    logoUrl: string | null;
    address: string | null;
    slug: string;
    isActive: boolean;
    curriculumAccessMode: "ASSIGNED_ONLY" | "ALL_CURRICULUM";
  };
}) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function submit(formData: FormData) {
    const name = String(formData.get("name") ?? "").trim();
    const phone = String(formData.get("phone") ?? "").trim();
    const logoUrl = String(formData.get("logoUrl") ?? "").trim();
    const logoFile = formData.get("logoFile");
    const address = String(formData.get("address") ?? "").trim();
    const curriculumAccessMode = String(formData.get("curriculumAccessMode") ?? "");

    if (name.length < 2) {
      toast.error("Enter the organization name (at least 2 characters).");
      return;
    }
    if (name.length > 120) {
      toast.error("Organization name must be 120 characters or fewer.");
      return;
    }
    if (phone) {
      const digits = phone.match(PHONE_DIGITS)?.length ?? 0;
      if (digits < 10) {
        toast.error("Enter a valid phone number with at least 10 digits.");
        return;
      }
      if (phone.length > 40) {
        toast.error("Phone number must be 40 characters or fewer.");
        return;
      }
    }
    if (
      logoUrl &&
      !(logoFile instanceof File && logoFile.size > 0) &&
      !HTTPS_LOGO_REF.test(logoUrl) &&
      !logoUrl.startsWith("data:image/") &&
      !LOCAL_LOGO_REF.test(logoUrl)
    ) {
      toast.error("Upload a JPG, PNG, WEBP, or GIF logo, or paste a https image URL.");
      return;
    }
    if (address.length > 300) {
      toast.error("Address must be 300 characters or fewer.");
      return;
    }
    if (
      curriculumAccessMode !== "ASSIGNED_ONLY" &&
      curriculumAccessMode !== "ALL_CURRICULUM"
    ) {
      toast.error("Select how teachers should access the curriculum.");
      return;
    }

    startTransition(async () => {
      const result = await updateOrgProfile(formData);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Organization profile saved successfully.");
      router.push("/org-admin");
      router.refresh();
    });
  }

  return (
    <Card className="fade-up max-w-3xl">
      <CardTitle>{org.name}</CardTitle>
      <CardDescription>
        On the test, the logo appears on the left, the school name in the center, and the
        address below. Required fields are marked with <span className="req-mark">*</span>
      </CardDescription>

      <form action={submit} className="mt-6 space-y-4">
        <label className="block">
          <span className="field-label">
            Organization name <span className="req-mark">*</span>
          </span>
          <Input name="name" defaultValue={org.name} required maxLength={120} />
        </label>

        <div className="form-grid form-grid-2">
          <label>
            <span className="field-label">Phone</span>
            <Input
              name="phone"
              type="tel"
              defaultValue={org.phone ?? ""}
              placeholder="+92 300 0000000"
              maxLength={40}
            />
          </label>
          <label>
            <span className="field-label">Logo URL (optional)</span>
            <Input
              name="logoUrl"
              defaultValue={
                isEmbeddedLogo(org.logoUrl ?? "") ? "" : (org.logoUrl ?? "")
              }
              placeholder="https://example.com/logo.png"
            />
            <span className="mt-1 block text-xs text-muted">
              {isEmbeddedLogo(org.logoUrl ?? "")
                ? "Current logo is already saved. Leave this blank to keep it, or upload a new file."
                : "Paste a https image link, or upload a file below."}
            </span>
          </label>
        </div>
        <div>
          <span className="field-label b">Or upload logo</span>
          <LogoUploadField currentUrl={org.logoUrl} />
        </div>

        <label className="block">
          <span className="field-label">Head office / address (printed on tests)</span>
          <textarea
            name="address"
            className="field-area"
            defaultValue={org.address ?? ""}
            placeholder="e.g. MAIN LAJPAT ROAD SHAHDARA, LAHORE"
            maxLength={300}
          />
        </label>

        <fieldset className="rounded-[1rem] border border-[rgba(15,40,70,0.1)] bg-mist p-4">
          <legend className="px-1 text-[0.95rem] font-semibold text-ink">
            Teacher curriculum access
          </legend>
          <p className="mb-3 text-[0.95rem] text-muted">
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
              <span className="block rounded-[0.9rem] border border-[rgba(15,40,70,0.12)] bg-card p-4 transition peer-checked:border-brand peer-checked:bg-brand/10">
                <span className="block text-[0.95rem] font-semibold text-ink">
                  Assigned subjects only
                </span>
                <span className="mt-1 block text-sm leading-relaxed text-muted">
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
              <span className="block rounded-[0.9rem] border border-[rgba(15,40,70,0.12)] bg-card p-4 transition peer-checked:border-brand peer-checked:bg-brand/10">
                <span className="block text-[0.95rem] font-semibold text-ink">
                  All classes and subjects
                </span>
                <span className="mt-1 block text-sm leading-relaxed text-muted">
                  Every teacher can create unscheduled tests from the full curriculum.
                </span>
              </span>
            </label>
          </div>
        </fieldset>

        <div className="rounded-[0.9rem] border border-[rgba(15,40,70,0.08)] bg-mist/40 px-4 py-3 text-[0.95rem] text-muted">
          Slug: <span className="font-medium text-ink-soft">{org.slug}</span> · Status:{" "}
          <span className="font-medium text-ink-soft">
            {org.isActive ? "Active" : "Inactive"}
          </span>
        </div>

        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save profile"}
        </Button>
      </form>
    </Card>
  );
}
