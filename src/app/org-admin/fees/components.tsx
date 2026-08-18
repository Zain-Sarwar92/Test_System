import Link from "next/link";
import { Card } from "@/components/ui/card";

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
          className="rounded-[0.8rem] border border-[rgba(15,40,70,0.12)] bg-white/80 px-3 py-2 text-sm font-semibold text-ink-soft transition hover:border-brand/40 hover:text-brand"
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
  const message = error ?? success;
  if (!message) return null;
  return (
    <div
      className={`rounded-xl border px-4 py-3 text-sm font-medium ${
        error
          ? "border-red-200 bg-red-50 text-red-700"
          : "border-emerald-200 bg-emerald-50 text-emerald-800"
      }`}
    >
      {message}
    </div>
  );
}

export function StatCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail?: string;
}) {
  return (
    <Card className="p-5">
      <p className="text-xs font-semibold tracking-wide text-muted uppercase">{label}</p>
      <p className="mt-2 font-display text-2xl font-semibold text-ink">{value}</p>
      {detail ? <p className="mt-1 text-xs text-muted">{detail}</p> : null}
    </Card>
  );
}
