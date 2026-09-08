"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FEE_CATEGORIES, FEE_CATEGORY_LABELS } from "@/lib/fee-categories";
import { MONTH_OPTIONS } from "@/lib/fee-head-rules";
import { createFeeHead, deleteFeeHead, toggleFeeHead, updateFeeHead } from "../actions";

type FeeHeadProps = {
  id: string;
  name: string;
  category: string;
  frequency: string;
  defaultAmount: string | null;
  applicableMonths: number[];
  description: string | null;
  isActive: boolean;
};

export function FeeTypeCard({ head }: { head: FeeHeadProps }) {
  return (
    <div className="space-y-4 rounded-[1.25rem] border border-line bg-card p-4 shadow-[var(--shadow-soft)] md:p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="font-display text-lg font-semibold text-ink">{head.name}</h3>
          {!head.isActive ? (
            <p className="text-xs font-medium text-muted">Inactive — hidden from fee hub</p>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <form action={toggleFeeHead}>
            <input type="hidden" name="id" value={head.id} />
            <input type="hidden" name="active" value={head.isActive ? "false" : "true"} />
            <Button type="submit" size="sm" variant="outline">
              {head.isActive ? "Deactivate" : "Activate"}
            </Button>
          </form>
          <form action={deleteFeeHead}>
            <input type="hidden" name="id" value={head.id} />
            <Button type="submit" size="sm" variant="outline">
              Delete
            </Button>
          </form>
        </div>
      </div>

      <form action={updateFeeHead} className="space-y-4">
        <input type="hidden" name="id" value={head.id} />
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted">
              Name *
            </span>
            <Input name="name" required defaultValue={head.name} maxLength={100} />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted">
              Category *
            </span>
            <select
              name="category"
              defaultValue={head.category}
              className="field-control h-11 w-full"
              required
            >
              {FEE_CATEGORIES.map((category) => (
                <option key={category} value={category}>
                  {FEE_CATEGORY_LABELS[category]}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted">
              Frequency *
            </span>
            <select
              name="frequency"
              defaultValue={head.frequency}
              className="field-control h-11 w-full"
              required
            >
              <option value="MONTHLY">Monthly (or selected months)</option>
              <option value="ONE_TIME">One-time (e.g. admission)</option>
              <option value="QUARTERLY">Quarterly</option>
              <option value="ANNUAL">Annual</option>
            </select>
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted">
              Default amount (PKR)
            </span>
            <Input
              name="defaultAmount"
              inputMode="decimal"
              defaultValue={head.defaultAmount ?? ""}
              placeholder="Optional — Monthly Fee uses student amount"
            />
          </label>
        </div>

        <fieldset>
          <legend className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
            Due months (empty = every month; ignored for one-time)
          </legend>
          <div className="flex flex-wrap gap-2">
            {MONTH_OPTIONS.map((month) => (
              <label
                key={month.value}
                className="inline-flex items-center gap-1.5 rounded-full border border-line bg-mist/40 px-2.5 py-1 text-xs font-medium text-ink"
              >
                <input
                  type="checkbox"
                  name="months"
                  value={month.value}
                  defaultChecked={head.applicableMonths.includes(month.value)}
                />
                {month.label}
              </label>
            ))}
          </div>
        </fieldset>

        <label className="block">
          <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted">
            Note
          </span>
          <Input name="description" defaultValue={head.description ?? ""} maxLength={500} />
        </label>

        <Button type="submit">Save</Button>
      </form>
    </div>
  );
}

export function CreateFeeTypeForm() {
  return (
    <form
      action={createFeeHead}
      className="space-y-4 rounded-[1.25rem] border border-dashed border-line bg-card/60 p-4 md:p-5"
    >
      <h3 className="font-display text-lg font-semibold text-ink">Add fee type</h3>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted">
            Name *
          </span>
          <Input name="name" required maxLength={100} placeholder="e.g. Lab Fee" />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted">
            Category *
          </span>
          <select name="category" defaultValue="OTHER" className="field-control h-11 w-full" required>
            {FEE_CATEGORIES.map((category) => (
              <option key={category} value={category}>
                {FEE_CATEGORY_LABELS[category]}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted">
            Frequency *
          </span>
          <select name="frequency" defaultValue="MONTHLY" className="field-control h-11 w-full" required>
            <option value="MONTHLY">Monthly (or selected months)</option>
            <option value="ONE_TIME">One-time</option>
            <option value="QUARTERLY">Quarterly</option>
            <option value="ANNUAL">Annual</option>
          </select>
        </label>
        <label className="block">
          <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted">
            Default amount (PKR)
          </span>
          <Input name="defaultAmount" inputMode="decimal" placeholder="Optional" />
        </label>
      </div>
      <fieldset>
        <legend className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
          Due months (optional)
        </legend>
        <div className="flex flex-wrap gap-2">
          {MONTH_OPTIONS.map((month) => (
            <label
              key={month.value}
              className="inline-flex items-center gap-1.5 rounded-full border border-line bg-mist/40 px-2.5 py-1 text-xs font-medium text-ink"
            >
              <input type="checkbox" name="months" value={month.value} />
              {month.label}
            </label>
          ))}
        </div>
      </fieldset>
      <Button type="submit">Create fee type</Button>
    </form>
  );
}
