"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { cancelTestSchedule, deleteTestSchedule } from "./actions";

export function CancelScheduleButton({ scheduleId }: { scheduleId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function onCancel() {
    if (
      !window.confirm(
        "Cancel this schedule? It will stay in the list but will no longer be treated as active.",
      )
    ) {
      return;
    }
    const formData = new FormData();
    formData.set("id", scheduleId);
    startTransition(async () => {
      const result = await cancelTestSchedule(formData);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Schedule cancelled successfully.");
      router.refresh();
    });
  }

  return (
    <Button
      type="button"
      variant="secondary"
      disabled={pending}
      onClick={onCancel}
    >
      {pending ? "Cancelling…" : "Cancel schedule"}
    </Button>
  );
}

export function DeleteScheduleButton({
  scheduleId,
  size = "sm",
  redirectToList = false,
}: {
  scheduleId: string;
  size?: "sm" | "default";
  redirectToList?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function onDelete() {
    if (
      !window.confirm(
        "Delete this schedule? Teacher tests stay saved. This cannot be undone.",
      )
    ) {
      return;
    }
    const formData = new FormData();
    formData.set("id", scheduleId);
    startTransition(async () => {
      const result = await deleteTestSchedule(formData);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Schedule deleted successfully.");
      if (redirectToList) {
        router.push("/org-admin/schedules");
        router.refresh();
        return;
      }
      router.refresh();
    });
  }

  return (
    <Button
      type="button"
      variant="danger"
      size={size}
      className="gap-1.5"
      disabled={pending}
      onClick={onDelete}
    >
      <Trash2 className="h-3.5 w-3.5" />
      {pending ? "Deleting…" : "Delete"}
    </Button>
  );
}
