"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { FeeCategory } from "@/generated/prisma/client";
import { feeCategoryLabel } from "@/lib/fee-categories";
import { formatPkr } from "@/lib/fee-format";
import { deleteFeePlanItem, updateFeePlanItem } from "../actions";

type PlanItemRowProps = {
  item: {
    id: string;
    amount: string;
    frequency: "MONTHLY" | "QUARTERLY" | "ANNUAL" | "ONE_TIME";
    feeHead: { name: string; isActive: boolean; category: FeeCategory };
    chargeCount: number;
  };
  canDelete: boolean;
};

export function PlanItemRow({ item, canDelete }: PlanItemRowProps) {
  return (
    <div className="rounded-lg bg-mist/45 px-3 py-3 text-sm">
      <p>
        <span className="font-semibold text-ink">{item.feeHead.name}</span>
        <span className="text-muted">
          {" "}
          · {feeCategoryLabel(item.feeHead.category)} · {formatPkr(item.amount)}
          {!item.feeHead.isActive ? " · head inactive" : ""}
          {item.chargeCount ? ` · ${item.chargeCount} charge(s)` : ""}
        </span>
      </p>
      <form action={updateFeePlanItem} className="mt-3 grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
        <input type="hidden" name="itemId" value={item.id} />
        <Input
          name="amount"
          required
          inputMode="decimal"
          defaultValue={item.amount}
          className="h-10"
          aria-label="Amount"
        />
        <select
          name="frequency"
          defaultValue={item.frequency}
          className="field-control h-10 w-full"
          aria-label="Frequency"
        >
          <option value="MONTHLY">Monthly</option>
          <option value="QUARTERLY">Quarterly</option>
          <option value="ANNUAL">Annual</option>
          <option value="ONE_TIME">One time</option>
        </select>
        <Button type="submit" size="sm" variant="outline">
          Update
        </Button>
      </form>
      {canDelete && !item.chargeCount ? (
        <form action={deleteFeePlanItem} className="mt-2">
          <input type="hidden" name="itemId" value={item.id} />
          <Button type="submit" size="sm" variant="danger">
            Delete item
          </Button>
        </form>
      ) : null}
    </div>
  );
}
