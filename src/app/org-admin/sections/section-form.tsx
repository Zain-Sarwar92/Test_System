"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SearchSelect } from "@/components/ui/search-select";
import { createSection, updateSection } from "./actions";
import { toast } from "@/components/ui/toast";

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
  const [name, setName] = useState(initial?.name ?? "");
  const [boardId, setBoardId] = useState(initial?.boardId ?? "");
  const [classId, setClassId] = useState(initial?.classId ?? "");

  const boardOptions = useMemo(
    () => boards.map((board) => ({ value: board.id, label: board.name })),
    [boards],
  );

  const boardClasses = useMemo(
    () =>
      classes
        .filter((klass) => klass.boardId === boardId)
        .sort((a, b) =>
          a.name.localeCompare(b.name, undefined, {
            numeric: true,
            sensitivity: "base",
          }),
        )
        .map((klass) => ({ value: klass.id, label: klass.name })),
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
    if (!name.trim()) {
      toast.error("Enter a section name.");
      return;
    }
    if (!boardId) {
      toast.error("Select a board.");
      return;
    }
    if (!classId) {
      toast.error("Select a class.");
      return;
    }
    if (mode === "create" && previewNames.length === 0) {
      toast.error("Enter at least one section name.");
      return;
    }
    if (mode === "edit" && name.trim().length > 50) {
      toast.error("Section name must be 50 characters or fewer.");
      return;
    }
    if (mode === "create" && previewNames.some((item) => item.length > 50)) {
      toast.error("Each section name must be 50 characters or fewer.");
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
        toast.error(result.error);
        return;
      }
      toast.success(
        mode === "edit"
          ? "Section updated successfully."
          : previewNames.length > 1
            ? `${previewNames.length} sections created successfully.`
            : "Section created successfully.",
      );
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

      <div className="block">
        <span className="mb-1.5 block text-sm font-semibold text-ink">
          Board <span className="text-red-500">*</span>
        </span>
        <SearchSelect
          value={boardId}
          options={boardOptions}
          onChange={onBoardChange}
          placeholder="Select board"
          searchPlaceholder="Search board…"
          ariaLabel="Board"
          className="h-11 w-full"
        />
      </div>

      <div className="block">
        <span className="mb-1.5 block text-sm font-semibold text-ink">
          Class <span className="text-red-500">*</span>
        </span>
        <SearchSelect
          value={classId}
          options={boardClasses}
          onChange={setClassId}
          placeholder={boardId ? "Select class" : "Select board first"}
          searchPlaceholder="Search class…"
          emptyText={boardId ? "No classes for this board" : "Select a board first"}
          disabled={!boardId}
          ariaLabel="Class"
          className="h-11 w-full"
        />
      </div>

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
