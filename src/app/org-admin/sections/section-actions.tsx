"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { deleteSection } from "./actions";

export function DeleteSectionButton({
  sectionId,
  sectionName,
}: {
  sectionId: string;
  sectionName: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function onDelete() {
    if (
      !window.confirm(
        `Delete section “${sectionName}”? This cannot be undone.`,
      )
    ) {
      return;
    }

    const formData = new FormData();
    formData.set("id", sectionId);

    startTransition(async () => {
      const result = await deleteSection(formData);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Section deleted successfully.");
      router.refresh();
    });
  }

  return (
    <Button
      type="button"
      variant="danger"
      size="sm"
      disabled={pending}
      onClick={onDelete}
    >
      {pending ? "Deleting…" : "Delete"}
    </Button>
  );
}
