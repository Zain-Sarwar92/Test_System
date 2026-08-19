"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { deleteTeacher, toggleTeacherActive } from "./actions";

export function ToggleTeacherActiveButton({
  teacherId,
  teacherName,
  isActive,
}: {
  teacherId: string;
  teacherName: string;
  isActive: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function onToggle() {
    const formData = new FormData();
    formData.set("id", teacherId);

    startTransition(async () => {
      const result = await toggleTeacherActive(formData);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(
        result.active
          ? `${teacherName} has been activated successfully.`
          : `${teacherName} has been deactivated successfully.`,
      );
      router.refresh();
    });
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={pending}
      onClick={onToggle}
    >
      {pending
        ? isActive
          ? "Deactivating…"
          : "Activating…"
        : isActive
          ? "Deactivate"
          : "Activate"}
    </Button>
  );
}

export function DeleteTeacherButton({
  teacherId,
  teacherName,
}: {
  teacherId: string;
  teacherName: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function onDelete() {
    if (
      !window.confirm(
        `Delete ${teacherName}? Generated tests will be kept, but this teacher will be removed from your organization.`,
      )
    ) {
      return;
    }

    const formData = new FormData();
    formData.set("id", teacherId);

    startTransition(async () => {
      const result = await deleteTeacher(formData);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(`${teacherName} has been deleted successfully.`);
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
