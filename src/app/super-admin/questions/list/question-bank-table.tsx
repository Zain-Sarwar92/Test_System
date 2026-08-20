"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState, useTransition } from "react";
import { Pencil, Power, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { deleteQuestion, searchQuestions, toggleQuestionActive } from "../actions";

type Row = {
  id: string;
  type: string;
  text: string;
  marks: number;
  isActive: boolean;
  path: string;
};

export function QuestionBankTable() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [rows, setRows] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [q, setQ] = useState(searchParams.get("q") ?? "");
  const [type, setType] = useState(searchParams.get("type") ?? "ALL");
  const [active, setActive] = useState(searchParams.get("active") ?? "active");

  const load = useCallback(() => {
    startTransition(async () => {
      const result = await searchQuestions({
        q: q || undefined,
        type: type as "MCQ" | "SHORT" | "LONG" | "ALL",
        active: active as "active" | "inactive" | "all",
        page,
        pageSize: 25,
      });
      setRows(result.items);
      setTotal(result.total);
      setTotalPages(result.totalPages);
    });
  }, [q, type, active, page]);

  useEffect(() => {
    load();
  }, [load]);

  function applyFilters() {
    setPage(1);
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (type !== "ALL") params.set("type", type);
    if (active !== "active") params.set("active", active);
    router.replace(`/super-admin/questions/list?${params.toString()}`);
    load();
  }

  function runToggle(id: string) {
    const fd = new FormData();
    fd.set("id", id);
    startTransition(async () => {
      await toggleQuestionActive(fd);
      load();
    });
  }

  function runDelete(id: string) {
    if (!confirm("Permanently delete this question?")) return;
    const fd = new FormData();
    fd.set("id", id);
    startTransition(async () => {
      await deleteQuestion(fd);
      load();
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Input
          className="min-w-[200px] flex-1"
          placeholder="Search question text…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <select
          className="rounded-xl border border-[rgba(15,40,70,0.12)] bg-card px-3 py-2 text-sm"
          value={type}
          onChange={(e) => setType(e.target.value)}
        >
          <option value="ALL">All types</option>
          <option value="MCQ">MCQ</option>
          <option value="SHORT">Short</option>
          <option value="LONG">Long</option>
        </select>
        <select
          className="rounded-xl border border-[rgba(15,40,70,0.12)] bg-card px-3 py-2 text-sm"
          value={active}
          onChange={(e) => setActive(e.target.value)}
        >
          <option value="active">Active only</option>
          <option value="inactive">Inactive only</option>
          <option value="all">All</option>
        </select>
        <Button onClick={applyFilters} disabled={pending}>
          Filter
        </Button>
      </div>

      <p className="text-sm text-muted">{total.toLocaleString()} questions</p>

      <div className="list-stack">
        {rows.map((row) => (
          <div
            key={row.id}
            className="chart-card flex flex-col gap-3 rounded-[1rem] border border-[rgba(15,40,70,0.08)] bg-card px-4 py-3 sm:flex-row sm:items-start sm:justify-between"
          >
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="status-chip status-chip-muted">{row.type}</span>
                <span className="text-xs text-muted">{row.marks} marks</span>
                {!row.isActive ? (
                  <span className="status-chip status-chip-warn">Inactive</span>
                ) : null}
              </div>
              <p className="mt-2 line-clamp-2 text-sm font-medium text-ink">{row.text}</p>
              <p className="mt-1 text-xs text-muted">{row.path}</p>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              <Link href={`/super-admin/questions/${row.id}/edit`}>
                <Button size="sm" variant="secondary">
                  <Pencil className="h-3.5 w-3.5" />
                  Edit
                </Button>
              </Link>
              <Button size="sm" variant="outline" onClick={() => runToggle(row.id)}>
                <Power className="h-3.5 w-3.5" />
                {row.isActive ? "Deactivate" : "Activate"}
              </Button>
              <Button size="sm" variant="outline" onClick={() => runDelete(row.id)}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2">
        <Button
          size="sm"
          variant="outline"
          disabled={page <= 1 || pending}
          onClick={() => setPage((p) => Math.max(1, p - 1))}
        >
          Previous
        </Button>
        <span className="text-sm text-muted">
          Page {page} of {totalPages}
        </span>
        <Button
          size="sm"
          variant="outline"
          disabled={page >= totalPages || pending}
          onClick={() => setPage((p) => p + 1)}
        >
          Next
        </Button>
      </div>
    </div>
  );
}
