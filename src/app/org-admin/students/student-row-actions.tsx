"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { deleteStudent, toggleStudentActive } from "./actions";

export function StudentRowActions({
  studentId,
  studentName,
  isActive,
  canDelete,
}: {
  studentId: string;
  studentName: string;
  isActive: boolean;
  canDelete: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function runToggle() {
    startTransition(async () => {
      const formData = new FormData();
      formData.set("id", studentId);
      const result = await toggleStudentActive(formData);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(
        result.active
          ? `${studentName} is active again.`
          : `${studentName} has been deactivated.`,
      );
      router.refresh();
    });
  }

  function runDelete() {
    if (!window.confirm(`Delete ${studentName}? This cannot be undone.`)) return;
    startTransition(async () => {
      const formData = new FormData();
      formData.set("id", studentId);
      const result = await deleteStudent(formData);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(`${studentName} has been deleted.`);
      router.refresh();
    });
  }

  return (
    <>
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={pending}
        onClick={runToggle}
      >
        {isActive ? "Deactivate" : "Activate"}
      </Button>
      {canDelete ? (
        <Button
          type="button"
          size="sm"
          variant="danger"
          disabled={pending}
          onClick={runDelete}
        >
          Delete
        </Button>
      ) : null}
    </>
  );
}
