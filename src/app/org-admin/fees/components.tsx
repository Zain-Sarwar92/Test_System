"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

export function formatPkr(value: { toFixed(decimalPlaces: number): string } | number) {
  const amount = typeof value === "number" ? value.toFixed(2) : value.toFixed(2);
  return `PKR ${Number(amount).toLocaleString("en-PK", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function FeesNav() {
  const pathname = usePathname();
  const links = [
    ["/org-admin/fees", "Overview"],
    ["/org-admin/fees/structures", "Structures"],
    ["/org-admin/fees/generate", "Generate dues"],
    ["/org-admin/fees/collect", "Collect payment"],
    ["/org-admin/fees/dues", "Dues & ledger"],
  ] as const;

  return (
    <nav className="flex flex-wrap gap-2">
      {links.map(([href, label]) => {
        const active =
          href === "/org-admin/fees"
            ? pathname === href
            : pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "rounded-full border px-3.5 py-2 text-sm font-semibold transition",
              active
                ? "border-brand/40 bg-brand/12 text-brand shadow-[var(--shadow-soft)]"
                : "border-line bg-card/80 text-ink-soft hover:border-brand/40 hover:text-brand",
            )}
          >
            {label}
          </Link>
        );
      })}
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
