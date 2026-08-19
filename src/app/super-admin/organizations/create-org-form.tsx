"use client";

import { FormEvent, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createOrganizationAction } from "./actions";
import { OrgModuleCheckboxes } from "@/components/org-module-checkboxes";

export function CreateOrgForm({
  plans = [],
}: {
  plans?: Array<{ id: string; name: string }>;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);
    const form = event.currentTarget;
    const formData = new FormData(form);

    startTransition(async () => {
      const result = await createOrganizationAction(formData);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.push("/super-admin/organizations/list");
      router.refresh();
    });
  }

  return (
    <form onSubmit={onSubmit} className="mt-6 space-y-4">
      <div className="form-grid form-grid-2">
        <label>
          <span className="field-label">
            Organization name <span className="req-mark">*</span>
          </span>
          <Input name="name" placeholder="e.g. AL-HADI GROUP OF SCHOOLS" required />
        </label>
        <label>
          <span className="field-label">Slug (optional)</span>
          <Input name="slug" placeholder="al-hadi-group" />
        </label>
        <label className="md:col-span-2">
          <span className="field-label">Head office / address (printed on papers)</span>
          <Input name="address" placeholder="e.g. MAIN LAJPAT ROAD SHAHDARA, LAHORE" />
        </label>
        <label>
          <span className="field-label">Phone</span>
          <Input name="phone" placeholder="+92 300 0000000" />
        </label>
        <label>
          <span className="field-label">Logo URL (printed on papers)</span>
          <Input name="logoUrl" type="url" placeholder="https://..." />
        </label>
        <label className="md:col-span-2">
          <span className="field-label">Or upload logo</span>
          <Input
            name="logoFile"
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
          />
          <span className="mt-1 block text-xs text-muted">
            JPG, PNG, WEBP, or GIF up to 2 MB. Upload takes priority over the URL.
          </span>
        </label>
        {plans.length > 0 ? (
          <label className="md:col-span-2">
            <span className="field-label">Subscription plan</span>
            <select
              name="planId"
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
        ) : null}
        <label>
          <span className="field-label">
            Admin full name <span className="req-mark">*</span>
          </span>
          <Input name="adminName" placeholder="Admin name" required />
        </label>
        <label>
          <span className="field-label">
            Admin email <span className="req-mark">*</span>
          </span>
          <Input name="adminEmail" type="email" placeholder="admin@school.com" required />
        </label>
        <label className="md:col-span-2">
          <span className="field-label">
            Admin password <span className="req-mark">*</span>
          </span>
          <Input
            name="adminPassword"
            type="password"
            placeholder="Minimum 8 characters"
            required
            minLength={8}
          />
        </label>
      </div>

      <OrgModuleCheckboxes />

      {error ? (
        <p className="text-sm font-medium text-red-700" role="alert">
          {error}
        </p>
      ) : null}
      {message ? <p className="text-sm font-medium text-brand">{message}</p> : null}

      <div className="flex flex-wrap gap-2 pt-1">
        <Button type="submit" disabled={pending}>
          <Building2 className="h-4 w-4" />
          {pending ? "Creating…" : "Create organization"}
        </Button>
        <Link href="/super-admin/organizations/list">
          <Button type="button" variant="outline">
            View organizations
          </Button>
        </Link>
      </div>
    </form>
  );
}
