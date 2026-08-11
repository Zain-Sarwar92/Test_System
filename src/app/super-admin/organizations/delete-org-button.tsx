"use client";

import { Button } from "@/components/ui/button";
import { deleteOrganization } from "./actions";

export function DeleteOrgButton({ orgId }: { orgId: string }) {
  return (
    <form
      action={deleteOrganization}
      onSubmit={(e) => {
        if (!confirm("Delete this organization permanently?")) e.preventDefault();
      }}
    >
      <input type="hidden" name="id" value={orgId} />
      <Button type="submit" variant="outline" className="w-full text-red-700">
        Delete organization
      </Button>
    </form>
  );
}
