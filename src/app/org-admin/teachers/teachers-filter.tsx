"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SearchSelect } from "@/components/ui/search-select";

export function TeachersFilter({
  subjectNames,
  defaultQuery,
  defaultSubject,
}: {
  subjectNames: string[];
  defaultQuery: string;
  defaultSubject: string;
}) {
  const [subject, setSubject] = useState(defaultSubject);

  return (
    <form className="mb-4 grid gap-2 rounded-[0.9rem] border border-[rgba(15,40,70,0.08)] bg-white/70 p-3 sm:grid-cols-[1fr_14rem_auto]">
      <Input
        name="q"
        defaultValue={defaultQuery}
        placeholder="Search name, email, subject, class, or section"
      />
      <input type="hidden" name="subject" value={subject} />
      <SearchSelect
        ariaLabel="Filter by subject"
        value={subject}
        onChange={setSubject}
        placeholder="All subjects"
        searchPlaceholder="Search subject…"
        emptyText="No subject found"
        options={[
          { value: "", label: "All subjects" },
          ...subjectNames.map((name) => ({ value: name, label: name })),
        ]}
      />
      <Button type="submit" variant="secondary">
        Apply
      </Button>
    </form>
  );
}
