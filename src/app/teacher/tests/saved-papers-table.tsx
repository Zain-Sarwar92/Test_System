"use client";

import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MoreHorizontal, Pencil, Trash2, FilePlus2, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { toast } from "@/components/ui/toast";
import { deleteTeacherTest } from "./actions";

export type SavedPaperRow = {
  id: string;
  title: string;
  status: "FINAL" | "DRAFT";
  classSection: string | null;
  className: string | null;
  subjectName: string | null;
  testType: string;
  examDate: string | null;
  createdAt: string;
  questionCount: number;
  totalMarks: number;
  preparedBy: string | null;
  teacherName?: string | null;
};

function formatDate(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatDateTime(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

type MenuPos = { top: number; left: number; openUp: boolean };

export function SavedPapersTable({
  papers,
  variant = "teacher",
}: {
  papers: SavedPaperRow[];
  variant?: "teacher" | "org";
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [menuPos, setMenuPos] = useState<MenuPos | null>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const menuBtnRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  const isOrg = variant === "org";

  useEffect(() => {
    setMounted(true);
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return papers;
    return papers.filter((p) => {
      const hay = [
        p.title,
        p.classSection,
        p.className,
        p.subjectName,
        p.preparedBy,
        p.teacherName,
        p.status,
        p.testType,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [papers, query]);

  function paperHref(id: string) {
    return isOrg ? `/org-admin/tests/${id}/print` : `/teacher/tests/${id}`;
  }

  function printHref(id: string) {
    return isOrg
      ? `/org-admin/tests/${id}/print`
      : `/teacher/tests/${id}/print`;
  }

  function closeMenu() {
    setOpenMenuId(null);
    setMenuPos(null);
  }

  function updateMenuPosition(id: string) {
    const btn = menuBtnRefs.current.get(id);
    if (!btn) return;
    const rect = btn.getBoundingClientRect();
    const menuHeight = 140;
    const openUp =
      rect.bottom + menuHeight > window.innerHeight && rect.top > menuHeight;
    const top = openUp ? rect.top - 6 : rect.bottom + 6;
    const left = Math.min(
      Math.max(8, rect.right - 176),
      window.innerWidth - 184,
    );
    setMenuPos({ top, left, openUp });
  }

  function toggleMenu(id: string) {
    if (openMenuId === id) {
      closeMenu();
      return;
    }
    setOpenMenuId(id);
    updateMenuPosition(id);
  }

  useLayoutEffect(() => {
    if (!openMenuId) return;
    updateMenuPosition(openMenuId);

    function onReposition() {
      updateMenuPosition(openMenuId!);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") closeMenu();
    }

    window.addEventListener("resize", onReposition);
    window.addEventListener("scroll", onReposition, true);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("resize", onReposition);
      window.removeEventListener("scroll", onReposition, true);
      window.removeEventListener("keydown", onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only rebind when menu id changes
  }, [openMenuId]);

  function handleDelete(id: string, title: string) {
    if (!window.confirm(`Delete test “${title}”? This cannot be undone.`)) {
      return;
    }
    setError(null);
    closeMenu();
    startTransition(async () => {
      try {
        await deleteTeacherTest(id);
        toast.success("Test deleted successfully.");
        router.refresh();
      } catch (err) {
        const message = err instanceof Error ? err.message : "Delete failed";
        setError(message);
        toast.error(message);
      }
    });
  }

  const openPaper = openMenuId
    ? filtered.find((p) => p.id === openMenuId)
    : null;

  const menuPortal =
    mounted && openMenuId && menuPos && openPaper
      ? createPortal(
          <>
            <button
              type="button"
              className="fixed inset-0 z-40 cursor-default bg-transparent"
              aria-label="Close menu"
              onClick={closeMenu}
            />
            <div
              role="menu"
              className="papers-menu fixed z-50 w-44"
              style={{
                top: menuPos.top,
                left: menuPos.left,
                transform: menuPos.openUp ? "translateY(-100%)" : undefined,
              }}
            >
              {!isOrg ? (
                <Link
                  href={`/teacher/tests/${openPaper.id}`}
                  className="papers-menu-item"
                  role="menuitem"
                  onClick={closeMenu}
                >
                  <Pencil className="h-3.5 w-3.5 shrink-0" />
                  Open / Edit
                </Link>
              ) : null}
              <Link
                href={printHref(openPaper.id)}
                className="papers-menu-item"
                role="menuitem"
                onClick={closeMenu}
              >
                <Printer className="h-3.5 w-3.5 shrink-0" />
                Print / PDF
              </Link>
              {!isOrg ? (
                <button
                  type="button"
                  className="papers-menu-item papers-menu-danger"
                  role="menuitem"
                  onClick={() => handleDelete(openPaper.id, openPaper.title)}
                >
                  <Trash2 className="h-3.5 w-3.5 shrink-0" />
                  Delete
                </button>
              ) : null}
            </div>
          </>,
          document.body,
        )
      : null;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="page-title">Saved Tests</h2>
          <p className="mt-1 text-sm text-muted">
            {filtered.length} record{filtered.length === 1 ? "" : "s"} found
            {query.trim() ? ` for “${query.trim()}”` : ""}
            {isOrg ? " · organization-wide" : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={
              isOrg ? "Search tests or teacher…" : "Search tests…"
            }
            className="h-10 w-full min-w-[200px] sm:w-64"
          />
          {!isOrg ? (
            <Link href="/teacher/generate">
              <Button className="h-10 gap-1.5">
                <FilePlus2 className="h-4 w-4" />
                New test
              </Button>
            </Link>
          ) : (
            <Link href="/org-admin/generate">
              <Button className="h-10 gap-1.5">
                <FilePlus2 className="h-4 w-4" />
                New test
              </Button>
            </Link>
          )}
        </div>
      </div>

      {error ? <p className="text-sm font-medium text-red-700">{error}</p> : null}

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[rgba(15,40,70,0.14)] bg-card px-6 py-14 text-center shadow-[0_8px_24px_rgba(11,31,51,0.04)]">
          <p className="text-sm font-semibold text-ink">
            {papers.length === 0 ? "No saved tests yet" : "No matching tests"}
          </p>
          <p className="mt-1 text-sm text-muted">
            {papers.length === 0
              ? isOrg
                ? "Generate a test or wait for teachers — saved tests appear here."
                : "Generate a test and save it — it will show up here."
              : "Try a different search."}
          </p>
          {!isOrg && papers.length === 0 ? (
            <Link href="/teacher/generate" className="mt-5 inline-block">
              <Button>Generate test</Button>
            </Link>
          ) : isOrg && papers.length === 0 ? (
            <Link href="/org-admin/generate" className="mt-5 inline-block">
              <Button>Generate test</Button>
            </Link>
          ) : null}
        </div>
      ) : (
        <div className="papers-table-wrap">
          <table className="papers-table">
            <thead>
              <tr>
                <th className="w-12">Sr</th>
                <th>Test name</th>
                {isOrg ? <th>Teacher</th> : null}
                <th>Class</th>
                <th>Subject</th>
                <th>Type</th>
                <th>Exam date</th>
                <th>Created</th>
                <th>Status</th>
                <th className="w-14 text-right"> </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((paper, index) => (
                <tr key={paper.id}>
                  <td className="tabular-nums text-muted">{index + 1}</td>
                  <td>
                    <Link
                      href={paperHref(paper.id)}
                      className="font-semibold text-ink transition-colors hover:text-brand"
                    >
                      {paper.title}
                    </Link>
                    <p className="mt-0.5 text-[11px] text-muted">
                      {paper.questionCount} Q · {paper.totalMarks} marks
                    </p>
                  </td>
                  {isOrg ? (
                    <td>
                      <span className="font-medium text-ink">
                        {paper.teacherName || "—"}
                      </span>
                    </td>
                  ) : null}
                  <td>{paper.classSection || paper.className || "—"}</td>
                  <td>{paper.subjectName || "—"}</td>
                  <td>
                    <span className="status-chip status-chip-warn">
                      {paper.testType}
                    </span>
                  </td>
                  <td className="whitespace-nowrap">
                    {formatDate(paper.examDate)}
                  </td>
                  <td className="whitespace-nowrap text-muted">
                    {formatDateTime(paper.createdAt)}
                  </td>
                  <td>
                    <span
                      className={cn(
                        "status-chip",
                        paper.status === "FINAL"
                          ? "status-chip-success"
                          : "status-chip-warn",
                      )}
                    >
                      {paper.status === "FINAL" ? "Final" : "Draft"}
                    </span>
                  </td>
                  <td className="text-right">
                    <button
                      type="button"
                      ref={(el) => {
                        if (el) menuBtnRefs.current.set(paper.id, el);
                        else menuBtnRefs.current.delete(paper.id);
                      }}
                      className={cn(
                        "inline-flex h-8 w-8 items-center justify-center rounded-lg text-ink-soft transition-colors hover:bg-[#e8eef4] hover:text-ink",
                        openMenuId === paper.id && "bg-[#e8eef4] text-ink",
                      )}
                      aria-label="Actions"
                      aria-expanded={openMenuId === paper.id}
                      aria-haspopup="menu"
                      disabled={pending}
                      onClick={() => toggleMenu(paper.id)}
                    >
                      <MoreHorizontal className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {menuPortal}
    </div>
  );
}
