"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createSection, updateSection } from "./actions";

type ClassOption = {
  id: string;
  name: string;
  boardId: string;
  boardName: string;
};

type BoardOption = {
  id: string;
  name: string;
};

function splitPreviewNames(raw: string) {
  return [
    ...new Set(
      raw
        .split(/[,/|]+/)
        .map((part) => part.trim())
        .filter(Boolean),
    ),
  ];
}

export function SectionForm({
  boards,
  classes,
  mode,
  initial,
}: {
  boards: BoardOption[];
  classes: ClassOption[];
  mode: "create" | "edit";
  initial?: { id: string; name: string; classId: string; boardId: string };
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState(initial?.name ?? "");
  const [boardId, setBoardId] = useState(initial?.boardId ?? "");
  const [classId, setClassId] = useState(initial?.classId ?? "");

  const boardClasses = useMemo(
    () =>
      classes
        .filter((klass) => klass.boardId === boardId)
        .sort((a, b) =>
          a.name.localeCompare(b.name, undefined, {
            numeric: true,
            sensitivity: "base",
          }),
        ),
    [classes, boardId],
  );

  const previewNames = useMemo(
    () => (mode === "create" ? splitPreviewNames(name) : []),
    [mode, name],
  );

  function onBoardChange(nextBoardId: string) {
    setBoardId(nextBoardId);
    setClassId("");
  }

  function onSubmit() {
    setError(null);
    if (!name.trim()) {
      setError("Enter section name.");
      return;
    }
    if (!boardId) {
      setError("Select a board.");
      return;
    }
    if (!classId) {
      setError("Select a class.");
      return;
    }
    if (mode === "create" && previewNames.length === 0) {
      setError("Enter at least one section name.");
      return;
    }

    const formData = new FormData();
    formData.set("name", name.trim());
    formData.set("classId", classId);
    if (mode === "edit" && initial) {
      formData.set("id", initial.id);
    }

    startTransition(async () => {
      const result =
        mode === "edit" ? await updateSection(formData) : await createSection(formData);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.push("/org-admin/sections");
      router.refresh();
    });
  }

  return (
    <div className="space-y-5">
      <label className="block">
        <span className="mb-1.5 block text-sm font-semibold text-ink">
          Section name <span className="text-red-500">*</span>
        </span>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={
            mode === "create"
              ? "e.g. Red, Blue, Green"
              : "e.g. Red"
          }
          className="h-11"
        />
        {mode === "create" ? (
          <p className="mt-1.5 text-xs text-muted">
            Comma-separated names create multiple sections (Red, Blue → 2 sections).
          </p>
        ) : null}
        {mode === "create" && previewNames.length > 1 ? (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {previewNames.map((item) => (
              <span key={item} className="status-chip status-chip-warn">
                {item}
              </span>
            ))}
          </div>
        ) : null}
      </label>

      <label className="block">
        <span className="mb-1.5 block text-sm font-semibold text-ink">
          Board <span className="text-red-500">*</span>
        </span>
        <select
          value={boardId}
          onChange={(e) => onBoardChange(e.target.value)}
          className="field-control h-11 w-full"
        >
          <option value="">Select board</option>
          {boards.map((board) => (
            <option key={board.id} value={board.id}>
              {board.name}
            </option>
          ))}
        </select>
      </label>

      <label className="block">
        <span className="mb-1.5 block text-sm font-semibold text-ink">
          Class <span className="text-red-500">*</span>
        </span>
        <select
          value={classId}
          onChange={(e) => setClassId(e.target.value)}
          disabled={!boardId}
          className="field-control h-11 w-full disabled:opacity-60"
        >
          <option value="">
            {boardId ? "Select class" : "Select board first"}
          </option>
          {boardClasses.map((klass) => (
            <option key={klass.id} value={klass.id}>
              {klass.name}
            </option>
          ))}
        </select>
      </label>

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3">
          <p className="text-sm font-medium text-red-700">{error}</p>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
        <Link href="/org-admin/sections">
          <Button type="button" variant="outline">
            Cancel
          </Button>
        </Link>
        <Button type="button" onClick={onSubmit} disabled={pending}>
          {pending
            ? mode === "edit"
              ? "Saving…"
              : "Creating…"
            : mode === "edit"
              ? "Save Section"
              : previewNames.length > 1
                ? `Create ${previewNames.length} Sections`
                : "Create Section"}
        </Button>
      </div>
    </div>
  );
}
