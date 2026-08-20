"use client";

import type { ReactNode } from "react";
import { useTransition } from "react";
import { toast } from "@/components/ui/toast";

type ActionResult = void | { ok: false; error: string } | { ok: true };

function isNextRedirect(error: unknown) {
  return (
    error != null &&
    typeof error === "object" &&
    "digest" in error &&
    String((error as { digest?: string }).digest ?? "").startsWith("NEXT_REDIRECT")
  );
}

export function ConfirmForm({
  action,
  message,
  children,
  className,
}: {
  action: (formData: FormData) => ActionResult | Promise<ActionResult>;
  message: string;
  children: ReactNode;
  className?: string;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <form
      className={className}
      action={(formData) => {
        if (!window.confirm(message)) return;
        startTransition(async () => {
          try {
            const result = await action(formData);
            if (result && typeof result === "object" && "ok" in result && !result.ok) {
              toast.error(result.error);
            }
          } catch (error) {
            if (isNextRedirect(error)) throw error;
            toast.error(
              error instanceof Error ? error.message : "Something went wrong",
            );
          }
        });
      }}
    >
      <fieldset disabled={pending} className="contents">
        {children}
      </fieldset>
    </form>
  );
}
