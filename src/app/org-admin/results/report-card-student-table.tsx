"use client";

import Link from "next/link";
import { useDeferredValue, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  formatResultMarks,
  formatResultPercent,
} from "@/lib/results";

export type ReportCardStudentRow = {
  id: string;
  rollNumber: string;
  name: string;
  fatherName: string;
  obtainedTotal: number;
  maxTotal: number;
  percent: number | null;
  grade: string;
  position: number | null;
};

export function ReportCardStudentTable({
  rows,
  cardHrefPrefix,
  cardHrefSuffix = "",
}: {
  rows: ReportCardStudentRow[];
  /** Path before student id, e.g. `/…/report-cards/` */
  cardHrefPrefix: string;
  /** Optional query after student id, e.g. `?exams=…` */
  cardHrefSuffix?: string;
}) {
  const [query, setQuery] = useState("");
  const deferred = useDeferredValue(query.trim().toLowerCase());

  const filtered = useMemo(() => {
    if (!deferred) return rows;
    return rows.filter((row) => {
      const haystack = [
        row.rollNumber,
        row.name,
        row.fatherName,
        row.grade,
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(deferred);
    });
  }, [deferred, rows]);

  return (
    <div className="space-y-3">
      <div className="no-print flex flex-wrap items-center gap-3 px-1">
        <Input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search roll, name, or father…"
          aria-label="Search students"
          className="max-w-md"
        />
        <p className="text-xs text-muted">
          {filtered.length === rows.length
            ? `${rows.length} students`
            : `${filtered.length} of ${rows.length} students`}
        </p>
      </div>

      <div className="overflow-hidden rounded-[1.25rem] border border-line bg-card shadow-[var(--shadow-soft)]">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line bg-[rgba(15,40,70,0.03)] text-left">
              <th className="px-4 py-3 font-semibold text-muted">Roll</th>
              <th className="px-4 py-3 font-semibold text-muted">Student</th>
              <th className="px-4 py-3 font-semibold text-muted">Total</th>
              <th className="px-4 py-3 font-semibold text-muted">%</th>
              <th className="px-4 py-3 font-semibold text-muted">Grade</th>
              <th className="px-4 py-3 font-semibold text-muted">Pos</th>
              <th className="px-4 py-3 font-semibold text-muted" />
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td
                  colSpan={7}
                  className="px-4 py-8 text-center text-sm text-muted"
                >
                  No students match “{query.trim()}”.
                </td>
              </tr>
            ) : (
              filtered.map((row) => (
                <tr
                  key={row.id}
                  className="border-b border-line last:border-0 hover:bg-[rgba(15,40,70,0.02)]"
                >
                  <td className="px-4 py-3 font-medium text-ink">
                    {row.rollNumber}
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-semibold text-ink">{row.name}</p>
                    <p className="text-xs text-muted">{row.fatherName}</p>
                  </td>
                  <td className="px-4 py-3 text-ink">
                    {row.maxTotal > 0
                      ? `${formatResultMarks(row.obtainedTotal)}/${formatResultMarks(row.maxTotal)}`
                      : "—"}
                  </td>
                  <td className="px-4 py-3 text-ink">
                    {row.percent == null
                      ? "—"
                      : formatResultPercent(row.percent)}
                  </td>
                  <td className="px-4 py-3 text-ink">{row.grade}</td>
                  <td className="px-4 py-3 text-ink">
                    {row.position ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`${cardHrefPrefix}${row.id}${cardHrefSuffix}`}
                    >
                      <Button size="sm">Print card</Button>
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
