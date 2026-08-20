"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, CheckCircle2, FilePlus2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { statusChipClass } from "@/lib/test-schedule-status";
import { shortClassLabel } from "@/lib/test-schedule-sections";
import {
  updateAssignmentSyllabus,
  type TeacherAssignedSchedule,
} from "./actions";

function AssignmentSyllabusCell({
  assignmentId,
  syllabusText,
  status,
}: {
  assignmentId: string;
  syllabusText: string | null;
  status: TeacherAssignedSchedule["status"];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [value, setValue] = useState(syllabusText ?? "");
  const [error, setError] = useState<string | null>(null);
  const [savedFlash, setSavedFlash] = useState(false);

  const dirty = value.trim() !== (syllabusText ?? "").trim();
  const missing =
    !(syllabusText ?? "").trim() && status !== "COMPLETED";

  function save() {
    setError(null);
    startTransition(async () => {
      const result = await updateAssignmentSyllabus({
        assignmentId,
        syllabusText: value,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setSavedFlash(true);
      window.setTimeout(() => setSavedFlash(false), 1500);
      router.refresh();
    });
  }

  return (
    <div className="min-w-[14rem] max-w-[18rem] space-y-1.5">
      <div className="flex items-center gap-1.5">
        <Input
          value={value}
          onChange={(e) => {
            setValue(e.target.value.slice(0, 200));
            setError(null);
          }}
          onBlur={() => {
            if (dirty && !pending) save();
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              if (dirty && !pending) save();
            }
          }}
          placeholder="Add syllabus…"
          maxLength={200}
          disabled={pending}
          className="h-9 text-sm"
          aria-label="Exam syllabus"
        />
        <Button
          type="button"
          size="sm"
          variant="secondary"
          disabled={pending || !dirty}
          onClick={save}
        >
          {pending ? "…" : "Save"}
        </Button>
      </div>
      {error ? (
        <p className="text-[11px] font-medium text-red-700">{error}</p>
      ) : savedFlash ? (
        <p className="text-[11px] font-medium text-brand">Saved</p>
      ) : missing ? (
        <p className="text-[11px] font-medium text-[#8a5a00]">
          Syllabus not added yet
        </p>
      ) : null}
    </div>
  );
}

export function TeacherScheduleFormView({
  schedules,
}: {
  schedules: TeacherAssignedSchedule[];
}) {
  const groups = useMemo(() => {
    const map = new Map<
      string,
      {
        scheduleId: string;
        scheduleName: string;
        rounds: Map<
          string,
          {
            roundId: string;
            roundName: string;
            roundOrder: number;
            rows: TeacherAssignedSchedule[];
          }
        >;
      }
    >();

    for (const item of schedules) {
      let scheduleGroup = map.get(item.scheduleId);
      if (!scheduleGroup) {
        scheduleGroup = {
          scheduleId: item.scheduleId,
          scheduleName: item.scheduleName,
          rounds: new Map(),
        };
        map.set(item.scheduleId, scheduleGroup);
      }
      let roundGroup = scheduleGroup.rounds.get(item.roundId);
      if (!roundGroup) {
        roundGroup = {
          roundId: item.roundId,
          roundName: item.roundName,
          roundOrder: item.roundOrder,
          rows: [],
        };
        scheduleGroup.rounds.set(item.roundId, roundGroup);
      }
      roundGroup.rows.push(item);
    }

    return [...map.values()].map((group) => ({
      scheduleId: group.scheduleId,
      scheduleName: group.scheduleName,
      rounds: [...group.rounds.values()]
        .sort((a, b) => a.roundOrder - b.roundOrder || a.roundName.localeCompare(b.roundName))
        .map((round) => {
          const rows = [...round.rows].sort(
            (a, b) =>
              new Date(a.testDate).getTime() - new Date(b.testDate).getTime() ||
              a.subjectName.localeCompare(b.subjectName),
          );
          const byDate = new Map<string, TeacherAssignedSchedule[]>();
          for (const row of rows) {
            const dateKey = row.testDate.slice(0, 10);
            const list = byDate.get(dateKey) ?? [];
            list.push(row);
            byDate.set(dateKey, list);
          }
          return {
            ...round,
            rows,
            dateGroups: [...byDate.entries()].map(([dateKey, items]) => ({
              dateKey,
              items,
            })),
          };
        }),
    }));
  }, [schedules]);

  return (
    <div className="space-y-5">
      {groups.map((group) => (
        <div
          key={group.scheduleId}
          className="overflow-hidden rounded-[1.15rem] border border-line bg-card shadow-[var(--shadow-soft)]"
        >
          <div className="border-b border-line bg-mist px-4 py-3 sm:px-5">
            <p className="text-[11px] font-semibold tracking-[0.14em] text-muted uppercase">
              Test Schedule
            </p>
            <h2 className="mt-1 text-lg font-semibold text-ink">
              {group.scheduleName}
            </h2>
            <p className="mt-1 text-sm text-muted">
              Syllabus is per round exam. Add it, then create the test when ready.
            </p>
          </div>

          <div className="space-y-4 p-4 sm:p-5">
            {group.rounds.map((round) => (
              <div
                key={round.roundId}
                className="overflow-hidden rounded-[0.95rem] border border-line"
              >
                <div className="border-b border-line bg-brand/10 px-3 py-2.5">
                  <p className="text-sm font-semibold text-ink">{round.roundName}</p>
                </div>
                <div className="nice-scroll overflow-x-auto">
                  <table className="min-w-full border-collapse text-left text-sm">
                    <thead>
                      <tr className="border-b border-line bg-card">
                        <th className="whitespace-nowrap px-3 py-3 font-semibold text-ink">
                          Date
                        </th>
                        <th className="whitespace-nowrap px-3 py-3 font-semibold text-ink">
                          Subject
                        </th>
                        <th className="whitespace-nowrap px-3 py-3 font-semibold text-ink">
                          Class
                        </th>
                        <th className="whitespace-nowrap px-3 py-3 font-semibold text-ink">
                          Section
                        </th>
                        <th className="whitespace-nowrap px-3 py-3 font-semibold text-ink">
                          Syllabus
                        </th>
                        <th className="whitespace-nowrap px-3 py-3 font-semibold text-ink">
                          Status
                        </th>
                        <th className="whitespace-nowrap px-3 py-3 font-semibold text-ink">
                          Test
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {round.dateGroups.map((dateGroup) => {
                        const first = dateGroup.items[0]!;
                        return (
                        <tr
                          key={dateGroup.dateKey}
                          className="border-b border-line last:border-b-0"
                        >
                          <td className="whitespace-nowrap px-3 py-3 align-top font-medium text-ink">
                            {first.testDateLabel}
                            {dateGroup.items.some(
                              (item) =>
                                item.dueTomorrow && item.status !== "COMPLETED",
                            ) ? (
                              <p className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-[#8a5a00]">
                                <AlertTriangle className="h-3 w-3" />
                                Due tomorrow — email reminder
                              </p>
                            ) : dateGroup.items.some(
                                (item) =>
                                  item.dueThisWeek && item.status !== "COMPLETED",
                              ) ? (
                              <p className="mt-1 text-[11px] font-semibold text-[#8a5a00]">
                                Due within 1 week — create test
                              </p>
                            ) : null}
                          </td>
                          <td className="p-0 align-top font-semibold text-ink">
                            {dateGroup.items.map((item) => (
                              <div
                                key={item.assignmentId}
                                className="min-h-[4.25rem] whitespace-nowrap border-b border-line px-3 py-3 last:border-b-0"
                              >
                                {item.subjectName}
                              </div>
                            ))}
                          </td>
                          <td className="p-0 align-top text-ink">
                            {dateGroup.items.map((item) => (
                              <div
                                key={item.assignmentId}
                                className="min-h-[4.25rem] whitespace-nowrap border-b border-line px-3 py-3 last:border-b-0"
                              >
                                {shortClassLabel(item.className)}
                              </div>
                            ))}
                          </td>
                          <td className="p-0 align-top text-ink">
                            {dateGroup.items.map((item) => (
                              <div
                                key={item.assignmentId}
                                className="min-h-[4.25rem] whitespace-nowrap border-b border-line px-3 py-3 last:border-b-0"
                              >
                                {item.sectionName?.trim() || "—"}
                              </div>
                            ))}
                          </td>
                          <td className="p-0 align-top">
                            {dateGroup.items.map((item) => (
                              <div
                                key={item.assignmentId}
                                className="min-h-[4.25rem] border-b border-line px-3 py-3 last:border-b-0"
                              >
                                <AssignmentSyllabusCell
                                  assignmentId={item.assignmentId}
                                  syllabusText={item.syllabusText}
                                  status={item.status}
                                />
                              </div>
                            ))}
                          </td>
                          <td className="p-0 align-top">
                            {dateGroup.items.map((item) => (
                              <div
                                key={item.assignmentId}
                                className="min-h-[4.25rem] border-b border-line px-3 py-3 last:border-b-0"
                              >
                                <span className={statusChipClass(item.status)}>
                                  {item.status}
                                </span>
                              </div>
                            ))}
                          </td>
                          <td className="p-0 align-top">
                            {dateGroup.items.map((item) => (
                              <div
                                key={item.assignmentId}
                                className="min-h-[4.25rem] border-b border-line px-3 py-3 last:border-b-0"
                              >
                                {item.status === "COMPLETED" &&
                                (item.testId || item.coveredByTestId) ? (
                                  <Link
                                    href={`/teacher/tests/${item.testId ?? item.coveredByTestId}`}
                                  >
                                    <Button
                                      variant="secondary"
                                      size="sm"
                                      className="gap-1.5"
                                    >
                                      <CheckCircle2 className="h-3.5 w-3.5" />
                                      View
                                    </Button>
                                  </Link>
                                ) : (
                                  <Link
                                    href={`/teacher/generate?assignmentId=${item.assignmentId}`}
                                  >
                                    <Button size="sm" className="gap-1.5">
                                      <FilePlus2 className="h-3.5 w-3.5" />
                                      Create
                                    </Button>
                                  </Link>
                                )}
                              </div>
                            ))}
                          </td>
                        </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
