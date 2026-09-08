"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowLeft, Banknote, Receipt } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatPkr } from "@/lib/fee-format";
import { submitStudentFee } from "./actions";

type PaymentRow = {
  id: string;
  receiptNumber: string;
  amount: string;
  paidAt: string;
  method: string;
  label: string;
};

export function StudentFeeDesk({
  student,
  classId,
  sectionId,
  feeLabel,
  defaultAmount,
  feeDue,
  frequencyLabel,
  backHref,
  today,
  currentPeriod,
  monthHistory,
  payments,
}: {
  student: {
    id: string;
    name: string;
    rollNumber: string;
    fatherName: string;
    monthlyFee?: string | null;
  };
  classId: string;
  sectionId: string;
  feeLabel: string;
  defaultAmount?: string | null;
  feeDue: boolean;
  frequencyLabel: string;
  backHref: string;
  today: string;
  currentPeriod: string;
  monthHistory: Array<{
    periodKey: string;
    label: string;
    status: "paid" | "partial" | "unpaid" | "not_due";
    isCurrent: boolean;
  }>;
  payments: PaymentRow[];
}) {
  const storedMonthly = student.monthlyFee?.trim() || "";
  const prefills =
    feeLabel === "Monthly Fee" && storedMonthly
      ? storedMonthly
      : defaultAmount?.trim() || "";
  const [amount, setAmount] = useState(prefills);
  const unpaidPrevious = monthHistory.filter(
    (row) => !row.isCurrent && (row.status === "unpaid" || row.status === "partial"),
  );

  return (
    <div className="fade-up mx-auto grid max-w-5xl gap-5 lg:grid-cols-[0.95fr_1.05fr]">
      <section className="org-dash-card tone-surface-fees flex flex-col p-5 sm:p-6">
        <Link
          href={backHref}
          className="mb-5 inline-flex w-fit items-center gap-1.5 text-sm font-semibold text-brand hover:underline"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to students
        </Link>

        <p className="org-dash-card-label">Collecting from</p>
        <h2 className="org-dash-card-value mt-1 text-3xl leading-tight">{student.name}</h2>
        <dl className="mt-5 space-y-3 text-sm">
          <div className="flex items-baseline justify-between gap-3 border-b border-line/70 pb-2">
            <dt className="text-muted">Fee type</dt>
            <dd className="text-right font-semibold text-ink">{feeLabel}</dd>
          </div>
          <div className="flex items-baseline justify-between gap-3 border-b border-line/70 pb-2">
            <dt className="text-muted">Rule</dt>
            <dd className="font-semibold text-ink">{frequencyLabel}</dd>
          </div>
          <div className="flex items-baseline justify-between gap-3 border-b border-line/70 pb-2">
            <dt className="text-muted">Roll no.</dt>
            <dd className="font-semibold text-ink">{student.rollNumber}</dd>
          </div>
          <div className="flex items-baseline justify-between gap-3 border-b border-line/70 pb-2">
            <dt className="text-muted">Father</dt>
            <dd className="text-right font-semibold text-ink">{student.fatherName}</dd>
          </div>
          <div className="flex items-baseline justify-between gap-3 border-b border-line/70 pb-2">
            <dt className="text-muted">Monthly fee</dt>
            <dd className="font-semibold text-ink">
              {storedMonthly ? formatPkr(storedMonthly) : "Not set"}
            </dd>
          </div>
          <div className="flex items-baseline justify-between gap-3">
            <dt className="text-muted">Payments on record</dt>
            <dd className="font-semibold text-ink">{payments.length}</dd>
          </div>
        </dl>

        <div className="mt-6">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">
            {feeLabel} · last months
          </p>
          {unpaidPrevious.length ? (
            <p className="mt-2 rounded-lg border border-line bg-mist/50 px-3 py-2 text-xs font-medium text-ink">
              Previous pending: {unpaidPrevious.map((row) => row.label).join(", ")}
            </p>
          ) : (
            <p className="mt-2 text-xs text-muted">Previous months clear (ya no dues).</p>
          )}
          <ul className="mt-3 space-y-2">
            {monthHistory.map((row) => (
              <li
                key={row.periodKey}
                className="flex items-center justify-between gap-2 border-b border-line/60 pb-2 text-sm last:border-0"
              >
                <span className={row.isCurrent ? "font-semibold text-ink" : "text-ink-soft"}>
                  {row.label}
                  {row.isCurrent ? " (this month)" : ""}
                </span>
                <span
                  className={
                    row.status === "paid"
                      ? "font-semibold text-muted"
                      : row.status === "not_due"
                        ? "text-muted"
                        : "font-semibold text-brand"
                  }
                >
                  {row.status === "paid"
                    ? "Paid"
                    : row.status === "partial"
                      ? "Partial"
                      : row.status === "not_due"
                        ? "Not due"
                        : "Unpaid"}
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-auto pt-8">
          {/* <p className="text-xs leading-relaxed text-muted">
            Purani unpaid month submit karni ho to form mein Month wohi select karo.
          </p> */}
        </div>
      </section>

      <section className="rounded-[1.25rem] border border-line bg-card p-5 shadow-[var(--shadow-soft)] sm:p-6">
        <div className="flex items-start gap-3">
          <span className="org-dash-icon org-dash-icon-tone-fees shrink-0">
            <Banknote className="h-4 w-4" />
          </span>
          <div>
            <h3 className="font-display text-xl font-semibold text-ink">Submit fee</h3>
            <p className="mt-1 text-sm text-muted">
              {feeDue ? "" : ""}
            </p>
          </div>
        </div>

        {!feeDue ? (
          <p className="mt-6 rounded-xl border border-line bg-mist/50 px-4 py-3 text-sm text-muted">
            Selected month pe ye fee type due nahi. Month change karo ya fee type months settings check
            karo.
          </p>
        ) : (
          <form action={submitStudentFee} className="mt-6 space-y-5">
            <input type="hidden" name="studentId" value={student.id} />
            <input type="hidden" name="returnClassId" value={classId} />
            <input type="hidden" name="returnSectionId" value={sectionId} />
            <input type="hidden" name="returnFeeName" value={feeLabel} />
            <input type="hidden" name="feeLabel" value={feeLabel} />

            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted">
                Amount (PKR) *
              </span>
              <Input
                name="amount"
                required
                inputMode="decimal"
                placeholder="0"
                autoFocus
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                className="h-14 text-2xl font-semibold tracking-tight"
              />
            </label>

            <div className="grid gap-4 sm:grid-cols-3">
              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted">
                  Month *
                </span>
                <Input name="periodKey" type="month" required defaultValue={currentPeriod} />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted">
                  Date *
                </span>
                <Input name="paidAt" type="date" required defaultValue={today} />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted">
                  Method *
                </span>
                <select name="method" defaultValue="CASH" className="field-control h-11 w-full">
                  <option value="CASH">Cash</option>
                  <option value="BANK_TRANSFER">Bank transfer</option>
                  <option value="CARD">Card</option>
                  <option value="OTHER">Other</option>
                </select>
              </label>
            </div>

            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted">
                Note
              </span>
              <Input name="note" maxLength={500} placeholder="Optional" />
            </label>

            <Button type="submit" className="h-12 w-full text-base sm:w-auto sm:min-w-[200px]">
              Submit & print receipt
            </Button>
          </form>
        )}
      </section>

      <section className="rounded-[1.25rem] border border-line bg-card shadow-[var(--shadow-soft)] lg:col-span-2">
        <div className="flex items-center gap-2 border-b border-line px-5 py-4">
          <Receipt className="h-4 w-4 text-brand" />
          <h3 className="font-display text-lg font-semibold text-ink">Recent payments</h3>
        </div>
        <div className="divide-y divide-line">
          {payments.map((payment) => (
            <Link
              key={payment.id}
              href={`/org-admin/fees/receipts/${payment.id}`}
              className="flex items-center justify-between gap-3 px-5 py-3.5 transition hover:bg-mist/40"
            >
              <div className="min-w-0">
                <p className="font-semibold text-ink">{payment.receiptNumber}</p>
                <p className="truncate text-xs text-muted">
                  {payment.label} · {payment.paidAt} · {payment.method}
                </p>
              </div>
              <span className="shrink-0 font-semibold text-ink">{formatPkr(payment.amount)}</span>
            </Link>
          ))}
          {!payments.length ? (
            <p className="px-5 py-8 text-center text-sm text-muted">No payments yet.</p>
          ) : null}
        </div>
      </section>
    </div>
  );
}
