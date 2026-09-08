"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { feeCategoryLabel } from "@/lib/fee-categories";
import type { FeeCategory } from "@/generated/prisma/client";
import { createFeePlan } from "../actions";

type ClassOption = {
  id: string;
  name: string;
  boardName: string;
};

type SectionOption = {
  id: string;
  name: string;
  classId: string;
};

type FeeHeadOption = {
  id: string;
  name: string;
  category: FeeCategory;
};

export function CreateFeePlanForm({
  classes,
  sections,
  feeHeads,
}: {
  classes: ClassOption[];
  sections: SectionOption[];
  feeHeads: FeeHeadOption[];
}) {
  const [classId, setClassId] = useState("");
  const [sectionId, setSectionId] = useState("");

  const classSections = useMemo(
    () => sections.filter((section) => section.classId === classId),
    [sections, classId],
  );

  function onClassChange(nextClassId: string) {
    setClassId(nextClassId);
    setSectionId("");
  }

  return (
    <form action={createFeePlan} className="mt-5 grid gap-4 sm:grid-cols-2">
      <label className="block sm:col-span-2">
        <span className="mb-1.5 block text-sm font-semibold text-ink">Plan name *</span>
        <Input name="name" required maxLength={100} placeholder="Class 9 Monthly Fees" />
      </label>
      <label className="block">
        <span className="mb-1.5 block text-sm font-semibold text-ink">Class *</span>
        <select
          name="classId"
          required
          value={classId}
          onChange={(event) => onClassChange(event.target.value)}
          className="field-control h-11 w-full"
        >
          <option value="">Select class</option>
          {classes.map((klass) => (
            <option key={klass.id} value={klass.id}>
              {klass.boardName} — {klass.name}
            </option>
          ))}
        </select>
      </label>
      <label className="block">
        <span className="mb-1.5 block text-sm font-semibold text-ink">
          Section (optional)
        </span>
        <select
          name="sectionId"
          value={sectionId}
          onChange={(event) => setSectionId(event.target.value)}
          disabled={!classId}
          className="field-control h-11 w-full"
        >
          <option value="">All sections in class</option>
          {classSections.map((section) => (
            <option key={section.id} value={section.id}>
              {section.name}
            </option>
          ))}
        </select>
      </label>
      <label className="block">
        <span className="mb-1.5 block text-sm font-semibold text-ink">Fee head *</span>
        <select name="feeHeadId" required className="field-control h-11 w-full">
          <option value="">Select fee head</option>
          {feeHeads.map((head) => (
            <option key={head.id} value={head.id}>
              {feeCategoryLabel(head.category)} — {head.name}
            </option>
          ))}
        </select>
      </label>
      <label className="block">
        <span className="mb-1.5 block text-sm font-semibold text-ink">Amount *</span>
        <Input name="amount" required inputMode="decimal" placeholder="2500.00" />
      </label>
      <label className="block">
        <span className="mb-1.5 block text-sm font-semibold text-ink">Frequency *</span>
        <select name="frequency" defaultValue="MONTHLY" className="field-control h-11 w-full">
          <option value="MONTHLY">Monthly</option>
          <option value="QUARTERLY">Quarterly</option>
          <option value="ANNUAL">Annual</option>
          <option value="ONE_TIME">One time</option>
        </select>
      </label>
      <div className="flex items-end">
        <Button type="submit" disabled={!feeHeads.length || !classes.length}>
          Create fee plan
        </Button>
      </div>
    </form>
  );
}
