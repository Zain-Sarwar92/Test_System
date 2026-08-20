"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { toast } from "@/components/ui/toast";

export function formatPkr(value: { toFixed(decimalPlaces: number): string } | number) {
  const amount = typeof value === "number" ? value.toFixed(2) : value.toFixed(2);
  return `PKR ${Number(amount).toLocaleString("en-PK", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function FeesNav() {
  const links = [
    ["/org-admin/fees", "Overview"],
    ["/org-admin/fees/structures", "Structures"],
    ["/org-admin/fees/generate", "Generate dues"],
    ["/org-admin/fees/collect", "Collect payment"],
    ["/org-admin/fees/dues", "Dues & ledger"],
  ] as const;
  return (
    <nav className="flex flex-wrap gap-2">
      {links.map(([href, label]) => (
        <Link
          key={href}
          href={href}
          className="rounded-[0.8rem] border border-[rgba(15,40,70,0.12)] bg-card/80 px-3 py-2 text-sm font-semibold text-ink-soft transition hover:border-brand/40 hover:text-brand"
        >
          {label}
        </Link>
      ))}
    </nav>
  );
}

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
