"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

type RoundOption = {
  id: string;
  label: string;
  hasMarks: boolean;
};

export function CombineRoundsForm({
  sectionId,
  seriesId,
  rounds,
}: {
  sectionId: string;
  seriesId: string;
  rounds: RoundOption[];
}) {
  const router = useRouter();
  const selectable = useMemo(() => rounds.filter((round) => round.hasMarks), [rounds]);
  const [selected, setSelected] = useState<string[]>(() =>
    selectable.map((round) => round.id),
  );

  function toggle(id: string) {
    setSelected((current) =>
      current.includes(id) ? current.filter((row) => row !== id) : [...current, id],
    );
  }

  function openCombined() {
    if (selected.length === 0) return;
    const params = new URLSearchParams();
    params.set("rounds", selected.join(","));
    router.push(
      `/org-admin/results/sections/${sectionId}/series/${seriesId}/combined?${params.toString()}`,
    );
  }

  if (selectable.length === 0) {
    return (
      <p className="text-sm text-muted">
        Enter marks in at least one round, then combine them here.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {rounds.map((round) => (
          <label
            key={round.id}
            className={`flex items-start gap-3 rounded-[0.9rem] border px-3 py-3 text-sm ${
              round.hasMarks
                ? "border-[rgba(15,40,70,0.12)] bg-white"
                : "border-dashed border-[rgba(15,40,70,0.1)] bg-mist/40 text-muted"
            }`}
          >
            <input
              type="checkbox"
              className="mt-1"
              disabled={!round.hasMarks}
              checked={selected.includes(round.id)}
              onChange={() => toggle(round.id)}
            />
            <span>
              <span className="block font-semibold text-ink">{round.label}</span>
              <span className="text-xs text-muted">
                {round.hasMarks ? "Marks entered" : "No marks yet"}
              </span>
            </span>
          </label>
        ))}
      </div>
      <Button type="button" disabled={selected.length === 0} onClick={openCombined}>
        Generate combined result ({selected.length})
      </Button>
    </div>
  );
}
