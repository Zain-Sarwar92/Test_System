"use client";

import { useEffect, useRef } from "react";
import { toast } from "@/components/ui/toast";

export function FlashMessage({
  success,
  error,
}: {
  success?: string;
  error?: string;
}) {
  const shown = useRef(false);

  useEffect(() => {
    if (shown.current) return;
    const message = error ?? success;
    if (!message) return;
    shown.current = true;
    if (error) toast.error(error);
    else toast.success(success!);
  }, [error, success]);

  return null;
}

export function StatCard({
  label,
  value,
  detail,
  tone,
}: {
  label: string;
  value: string;
  detail?: string;
  tone?: string;
}) {
  return (
    <div className={`org-dash-card ${tone ? `tone-surface-${tone}` : ""}`.trim()}>
      <p className="org-dash-card-label">{label}</p>
      <p className="org-dash-card-value">{value}</p>
      {detail ? <p className="org-dash-card-hint">{detail}</p> : null}
    </div>
  );
}
