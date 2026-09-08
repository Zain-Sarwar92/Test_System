"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FEE_CATEGORIES, feeCategoryLabel } from "@/lib/fee-categories";

type ClassOption = { id: string; name: string; boardName: string };
type SectionOption = { id: string; name: string; classId: string; className: string };

export function DuesFilterForm({
  classes,
  sections,
  defaults,
}: {
  classes: ClassOption[];
  sections: SectionOption[];
  defaults: {
    period?: string;
    classId?: string;
    sectionId?: string;
    status?: string;
    category?: string;
    q?: string;
  };
}) {
  const [classId, setClassId] = useState(defaults.classId ?? "");
  const [sectionId, setSectionId] = useState(defaults.sectionId ?? "");
  const classSections = useMemo(
    () => sections.filter((section) => !classId || section.classId === classId),
    [sections, classId],
  );

  function onClassChange(next: string) {
    setClassId(next);
    setSectionId("");
  }

  return (
    <form method="get" className="grid gap-3 md:grid-cols-3 lg:grid-cols-7">
      <Input name="period" type="month" defaultValue={defaults.period} aria-label="Period" />
      <select
        name="category"
        defaultValue={defaults.category}
        className="field-control h-11 w-full"
        aria-label="Fee type"
      >
        <option value="">All types</option>
        {FEE_CATEGORIES.map((category) => (
          <option key={category} value={category}>
            {feeCategoryLabel(category)}
          </option>
        ))}
      </select>
      <select
        name="classId"
        value={classId}
        onChange={(event) => onClassChange(event.target.value)}
        className="field-control h-11 w-full"
        aria-label="Class"
      >
        <option value="">All classes</option>
        {classes.map((klass) => (
          <option key={klass.id} value={klass.id}>
            {klass.boardName} — {klass.name}
          </option>
        ))}
      </select>
      <select
        name="sectionId"
        value={sectionId}
        onChange={(event) => setSectionId(event.target.value)}
        className="field-control h-11 w-full"
        aria-label="Section"
      >
        <option value="">All sections</option>
        {classSections.map((section) => (
          <option key={section.id} value={section.id}>
            {section.className} — {section.name}
          </option>
        ))}
      </select>
      <select
        name="status"
        defaultValue={defaults.status}
        className="field-control h-11 w-full"
        aria-label="Status"
      >
        <option value="">All statuses</option>
        <option value="UNPAID">UNPAID</option>
        <option value="PARTIAL">PARTIAL</option>
        <option value="PAID">PAID</option>
        <option value="WAIVED">WAIVED</option>
      </select>
      <Input
        name="q"
        defaultValue={defaults.q}
        placeholder="Student / roll / father"
        aria-label="Student search"
      />
      <Button type="submit">Apply filters</Button>
    </form>
  );
}
