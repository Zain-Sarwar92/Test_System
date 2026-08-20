"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { CheckCircle2, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  createBoard,
  createChapter,
  createClass,
  createSubject,
  createTopic,
  deleteBoard,
  deleteChapter,
  deleteClass,
  deleteSubject,
  deleteTopic,
  updateBoard,
  updateChapter,
  updateClass,
  updateSubject,
  updateTopic,
} from "./actions";
import type { CurriculumStructureBoard } from "@/lib/curriculum-tree";

export type HierarchyPayload = CurriculumStructureBoard[];

type Level = "board" | "class" | "subject" | "chapter" | "topic";

function sortByName<T extends { name: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => a.name.localeCompare(b.name));
}

function sortChapters<T extends { order: number; name: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));
}

export function HierarchyManager({ boards }: { boards: HierarchyPayload }) {
  const [localBoards, setLocalBoards] = useState(boards);
  const [boardId, setBoardId] = useState<string | null>(null);
  const [classId, setClassId] = useState<string | null>(null);
  const [subjectId, setSubjectId] = useState<string | null>(null);
  const [chapterId, setChapterId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [savedFlash, setSavedFlash] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLocalBoards(boards);
  }, [boards]);

  useEffect(() => {
    if (!savedFlash) return;
    const timer = window.setTimeout(() => setSavedFlash(false), 2000);
    return () => window.clearTimeout(timer);
  }, [savedFlash]);

  const board = localBoards.find((b) => b.id === boardId);
  const klass = board?.classes.find((c) => c.id === classId);
  const subject = klass?.subjects.find((s) => s.id === subjectId);
  const chapter = subject?.chapters.find((c) => c.id === chapterId);

  const breadcrumbs = useMemo(() => {
    const parts: Array<{ level: Level; id: string; label: string }> = [];
    if (board) parts.push({ level: "board", id: board.id, label: board.name });
    if (klass) parts.push({ level: "class", id: klass.id, label: klass.name });
    if (subject) parts.push({ level: "subject", id: subject.id, label: subject.name });
    if (chapter) parts.push({ level: "chapter", id: chapter.id, label: chapter.name });
    return parts;
  }, [board, klass, subject, chapter]);

  function flashSaved() {
    setSavedFlash(true);
  }

  function run(action: () => Promise<void>) {
    setError(null);
    startTransition(async () => {
      try {
        await action();
        flashSaved();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Action failed");
      }
    });
  }

  function jumpTo(level: Level) {
    if (level === "board") {
      setClassId(null);
      setSubjectId(null);
      setChapterId(null);
    } else if (level === "class") {
      setSubjectId(null);
      setChapterId(null);
    } else if (level === "subject") {
      setChapterId(null);
    }
  }

  return (
    <div className="space-y-4">
      <HierarchySaveToast pending={pending} saved={savedFlash} error={error} />

      <div className="flex flex-wrap gap-2 text-sm">
        {breadcrumbs.map((crumb, idx) => (
          <span key={crumb.id} className="flex items-center gap-2">
            {idx > 0 ? <span className="text-muted">/</span> : null}
            <button
              type="button"
              className="font-semibold text-brand hover:underline"
              onClick={() => jumpTo(crumb.level)}
            >
              {crumb.label}
            </button>
          </span>
        ))}
      </div>

      {!boardId ? (
        <LevelPanel title="Boards" pending={pending} saved={savedFlash}>
          {localBoards.map((b) => (
            <Row
              key={b.id}
              name={b.name}
              meta={`${b.classes.length} classes`}
              pending={pending}
              onOpen={() => {
                setBoardId(b.id);
                setClassId(null);
                setSubjectId(null);
                setChapterId(null);
              }}
              onDelete={() => {
                if (!confirm(`Delete board "${b.name}" and all nested data?`)) return;
                run(async () => {
                  const fd = new FormData();
                  fd.set("id", b.id);
                  await deleteBoard(fd);
                  setLocalBoards((prev) => prev.filter((row) => row.id !== b.id));
                  setBoardId(null);
                });
              }}
              onRename={(name) => {
                run(async () => {
                  const fd = new FormData();
                  fd.set("id", b.id);
                  fd.set("name", name);
                  const updated = await updateBoard(fd);
                  setLocalBoards((prev) =>
                    sortByName(
                      prev.map((row) =>
                        row.id === b.id ? { ...row, name: updated.name } : row,
                      ),
                    ),
                  );
                });
              }}
            />
          ))}
          <AddRow
            placeholder="New board name"
            pending={pending}
            onAdd={(name) => {
              run(async () => {
                const fd = new FormData();
                fd.set("name", name);
                const created = await createBoard(fd);
                setLocalBoards((prev) =>
                  sortByName([
                    ...prev,
                    { id: created.id, name: created.name, classes: [] },
                  ]),
                );
              });
            }}
          />
        </LevelPanel>
      ) : !classId ? (
        <LevelPanel title={`Classes — ${board?.name}`} pending={pending} saved={savedFlash}>
          <Button variant="outline" size="sm" onClick={() => setBoardId(null)}>
            ← All boards
          </Button>
          {board?.classes.map((c) => (
            <Row
              key={c.id}
              name={c.name}
              meta={`${c.subjects.length} subjects`}
              pending={pending}
              onOpen={() => {
                setClassId(c.id);
                setSubjectId(null);
                setChapterId(null);
              }}
              onDelete={() => {
                if (!confirm(`Delete class "${c.name}"?`)) return;
                run(async () => {
                  const fd = new FormData();
                  fd.set("id", c.id);
                  await deleteClass(fd);
                  setLocalBoards((prev) =>
                    prev.map((b) =>
                      b.id === boardId
                        ? { ...b, classes: b.classes.filter((row) => row.id !== c.id) }
                        : b,
                    ),
                  );
                  setClassId(null);
                });
              }}
              onRename={(name) => {
                run(async () => {
                  const fd = new FormData();
                  fd.set("id", c.id);
                  fd.set("name", name);
                  const updated = await updateClass(fd);
                  setLocalBoards((prev) =>
                    prev.map((b) =>
                      b.id === boardId
                        ? {
                            ...b,
                            classes: sortByName(
                              b.classes.map((row) =>
                                row.id === c.id ? { ...row, name: updated.name } : row,
                              ),
                            ),
                          }
                        : b,
                    ),
                  );
                });
              }}
            />
          ))}
          <AddRow
            placeholder="New class name"
            pending={pending}
            onAdd={(name) => {
              run(async () => {
                const fd = new FormData();
                fd.set("boardId", boardId);
                fd.set("name", name);
                const created = await createClass(fd);
                setLocalBoards((prev) =>
                  prev.map((b) =>
                    b.id === boardId
                      ? {
                          ...b,
                          classes: sortByName([
                            ...b.classes,
                            { id: created.id, name: created.name, subjects: [] },
                          ]),
                        }
                      : b,
                  ),
                );
              });
            }}
          />
        </LevelPanel>
      ) : !subjectId ? (
        <LevelPanel title={`Subjects — ${klass?.name}`} pending={pending} saved={savedFlash}>
          <Button variant="outline" size="sm" onClick={() => setClassId(null)}>
            ← Classes
          </Button>
          {klass?.subjects.map((s) => (
            <Row
              key={s.id}
              name={s.name}
              meta={`${s.chapters.length} chapters`}
              pending={pending}
              onOpen={() => {
                setSubjectId(s.id);
                setChapterId(null);
              }}
              onDelete={() => {
                if (!confirm(`Delete subject "${s.name}"?`)) return;
                run(async () => {
                  const fd = new FormData();
                  fd.set("id", s.id);
                  await deleteSubject(fd);
                  setLocalBoards((prev) =>
                    prev.map((b) =>
                      b.id === boardId
                        ? {
                            ...b,
                            classes: b.classes.map((cl) =>
                              cl.id === classId
                                ? {
                                    ...cl,
                                    subjects: cl.subjects.filter((row) => row.id !== s.id),
                                  }
                                : cl,
                            ),
                          }
                        : b,
                    ),
                  );
                  setSubjectId(null);
                });
              }}
              onRename={(name) => {
                run(async () => {
                  const fd = new FormData();
                  fd.set("id", s.id);
                  fd.set("name", name);
                  const updated = await updateSubject(fd);
                  setLocalBoards((prev) =>
                    prev.map((b) =>
                      b.id === boardId
                        ? {
                            ...b,
                            classes: b.classes.map((cl) =>
                              cl.id === classId
                                ? {
                                    ...cl,
                                    subjects: sortByName(
                                      cl.subjects.map((row) =>
                                        row.id === s.id
                                          ? { ...row, name: updated.name }
                                          : row,
                                      ),
                                    ),
                                  }
                                : cl,
                            ),
                          }
                        : b,
                    ),
                  );
                });
              }}
            />
          ))}
          <AddRow
            placeholder="New subject name"
            pending={pending}
            onAdd={(name) => {
              run(async () => {
                const fd = new FormData();
                fd.set("classId", classId);
                fd.set("name", name);
                const created = await createSubject(fd);
                setLocalBoards((prev) =>
                  prev.map((b) =>
                    b.id === boardId
                      ? {
                          ...b,
                          classes: b.classes.map((cl) =>
                            cl.id === classId
                              ? {
                                  ...cl,
                                  subjects: sortByName([
                                    ...cl.subjects,
                                    { id: created.id, name: created.name, chapters: [] },
                                  ]),
                                }
                              : cl,
                          ),
                        }
                      : b,
                  ),
                );
              });
            }}
          />
        </LevelPanel>
      ) : !chapterId ? (
        <LevelPanel title={`Chapters — ${subject?.name}`} pending={pending} saved={savedFlash}>
          <Button variant="outline" size="sm" onClick={() => setSubjectId(null)}>
            ← Subjects
          </Button>
          {subject?.chapters.map((ch) => (
            <Row
              key={ch.id}
              name={ch.name}
              meta={`order ${ch.order} · ${ch.topics.length} topics`}
              pending={pending}
              onOpen={() => setChapterId(ch.id)}
              onDelete={() => {
                if (!confirm(`Delete chapter "${ch.name}"?`)) return;
                run(async () => {
                  const fd = new FormData();
                  fd.set("id", ch.id);
                  await deleteChapter(fd);
                  setLocalBoards((prev) =>
                    prev.map((b) =>
                      b.id === boardId
                        ? {
                            ...b,
                            classes: b.classes.map((cl) =>
                              cl.id === classId
                                ? {
                                    ...cl,
                                    subjects: cl.subjects.map((sub) =>
                                      sub.id === subjectId
                                        ? {
                                            ...sub,
                                            chapters: sub.chapters.filter(
                                              (row) => row.id !== ch.id,
                                            ),
                                          }
                                        : sub,
                                    ),
                                  }
                                : cl,
                            ),
                          }
                        : b,
                    ),
                  );
                  setChapterId(null);
                });
              }}
              onRename={(name, order) => {
                run(async () => {
                  const fd = new FormData();
                  fd.set("id", ch.id);
                  fd.set("name", name);
                  fd.set("order", String(order ?? 0));
                  const updated = await updateChapter(fd);
                  setLocalBoards((prev) =>
                    prev.map((b) =>
                      b.id === boardId
                        ? {
                            ...b,
                            classes: b.classes.map((cl) =>
                              cl.id === classId
                                ? {
                                    ...cl,
                                    subjects: cl.subjects.map((sub) =>
                                      sub.id === subjectId
                                        ? {
                                            ...sub,
                                            chapters: sortChapters(
                                              sub.chapters.map((row) =>
                                                row.id === ch.id
                                                  ? {
                                                      ...row,
                                                      name: updated.name,
                                                      order: updated.order,
                                                    }
                                                  : row,
                                              ),
                                            ),
                                          }
                                        : sub,
                                    ),
                                  }
                                : cl,
                            ),
                          }
                        : b,
                    ),
                  );
                });
              }}
              showOrder
              order={ch.order}
            />
          ))}
          <AddRow
            placeholder="New chapter name"
            showOrder
            pending={pending}
            onAdd={(name, order) => {
              run(async () => {
                const fd = new FormData();
                fd.set("subjectId", subjectId);
                fd.set("name", name);
                fd.set("order", String(order ?? 0));
                const created = await createChapter(fd);
                setLocalBoards((prev) =>
                  prev.map((b) =>
                    b.id === boardId
                      ? {
                          ...b,
                          classes: b.classes.map((cl) =>
                            cl.id === classId
                              ? {
                                  ...cl,
                                  subjects: cl.subjects.map((sub) =>
                                    sub.id === subjectId
                                      ? {
                                          ...sub,
                                          chapters: sortChapters([
                                            ...sub.chapters,
                                            {
                                              id: created.id,
                                              name: created.name,
                                              order: created.order,
                                              topics: [],
                                            },
                                          ]),
                                        }
                                      : sub,
                                  ),
                                }
                              : cl,
                          ),
                        }
                      : b,
                  ),
                );
              });
            }}
          />
        </LevelPanel>
      ) : (
        <LevelPanel title={`Topics — ${chapter?.name}`} pending={pending} saved={savedFlash}>
          <Button variant="outline" size="sm" onClick={() => setChapterId(null)}>
            ← Chapters
          </Button>
          {chapter?.topics.map((t) => (
            <Row
              key={t.id}
              name={t.name}
              meta={`order ${t.order} · ${t.questionCount} questions`}
              pending={pending}
              onDelete={() => {
                if (t.questionCount > 0) {
                  alert("Cannot delete topic with linked questions.");
                  return;
                }
                if (!confirm(`Delete topic "${t.name}"?`)) return;
                run(async () => {
                  const fd = new FormData();
                  fd.set("id", t.id);
                  await deleteTopic(fd);
                  setLocalBoards((prev) =>
                    prev.map((b) =>
                      b.id === boardId
                        ? {
                            ...b,
                            classes: b.classes.map((cl) =>
                              cl.id === classId
                                ? {
                                    ...cl,
                                    subjects: cl.subjects.map((sub) =>
                                      sub.id === subjectId
                                        ? {
                                            ...sub,
                                            chapters: sub.chapters.map((ch) =>
                                              ch.id === chapterId
                                                ? {
                                                    ...ch,
                                                    topics: ch.topics.filter(
                                                      (row) => row.id !== t.id,
                                                    ),
                                                  }
                                                : ch,
                                            ),
                                          }
                                        : sub,
                                    ),
                                  }
                                : cl,
                            ),
                          }
                        : b,
                    ),
                  );
                });
              }}
              onRename={(name, order) => {
                run(async () => {
                  const fd = new FormData();
                  fd.set("id", t.id);
                  fd.set("name", name);
                  fd.set("order", String(order ?? 0));
                  const updated = await updateTopic(fd);
                  setLocalBoards((prev) =>
                    prev.map((b) =>
                      b.id === boardId
                        ? {
                            ...b,
                            classes: b.classes.map((cl) =>
                              cl.id === classId
                                ? {
                                    ...cl,
                                    subjects: cl.subjects.map((sub) =>
                                      sub.id === subjectId
                                        ? {
                                            ...sub,
                                            chapters: sub.chapters.map((ch) =>
                                              ch.id === chapterId
                                                ? {
                                                    ...ch,
                                                    topics: sortChapters(
                                                      ch.topics.map((row) =>
                                                        row.id === t.id
                                                          ? {
                                                              ...row,
                                                              name: updated.name,
                                                              order: updated.order,
                                                            }
                                                          : row,
                                                      ),
                                                    ),
                                                  }
                                                : ch,
                                            ),
                                          }
                                        : sub,
                                    ),
                                  }
                                : cl,
                            ),
                          }
                        : b,
                    ),
                  );
                });
              }}
              showOrder
              order={t.order}
            />
          ))}
          <AddRow
            placeholder="New topic name"
            showOrder
            pending={pending}
            onAdd={(name, order) => {
              run(async () => {
                const fd = new FormData();
                fd.set("chapterId", chapterId);
                fd.set("name", name);
                fd.set("order", String(order ?? 0));
                const created = await createTopic(fd);
                setLocalBoards((prev) =>
                  prev.map((b) =>
                    b.id === boardId
                      ? {
                          ...b,
                          classes: b.classes.map((cl) =>
                            cl.id === classId
                              ? {
                                  ...cl,
                                  subjects: cl.subjects.map((sub) =>
                                    sub.id === subjectId
                                      ? {
                                          ...sub,
                                          chapters: sub.chapters.map((ch) =>
                                            ch.id === chapterId
                                              ? {
                                                  ...ch,
                                                  topics: sortChapters([
                                                    ...ch.topics,
                                                    {
                                                      id: created.id,
                                                      name: created.name,
                                                      order: created.order,
                                                      questionCount: 0,
                                                    },
                                                  ]),
                                                }
                                              : ch,
                                          ),
                                        }
                                      : sub,
                                  ),
                                }
                              : cl,
                          ),
                        }
                      : b,
                  ),
                );
              });
            }}
          />
        </LevelPanel>
      )}
    </div>
  );
}

function HierarchySaveToast({
  pending,
  saved,
  error,
}: {
  pending: boolean;
  saved: boolean;
  error: string | null;
}) {
  if (!pending && !saved && !error) return null;

  return (
    <div
      className="fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2.5 rounded-full border border-[rgba(15,40,70,0.1)] bg-card/95 px-4 py-2.5 text-sm font-medium shadow-[0_12px_40px_rgba(11,31,51,0.18)] backdrop-blur-sm"
      role="status"
      aria-live="polite"
    >
      {pending ? (
        <>
          <Loader2 className="h-4 w-4 shrink-0 animate-spin text-brand" aria-hidden />
          <span className="text-ink">Saving changes…</span>
        </>
      ) : error ? (
        <span className="text-[#b42318]">{error}</span>
      ) : saved ? (
        <>
          <CheckCircle2 className="h-4 w-4 shrink-0 text-brand" aria-hidden />
          <span className="text-brand">All changes saved</span>
        </>
      ) : null}
    </div>
  );
}

function LevelPanel({
  title,
  children,
  pending,
  saved,
}: {
  title: string;
  children: React.ReactNode;
  pending?: boolean;
  saved?: boolean;
}) {
  return (
    <div className="chart-card space-y-3 rounded-[1rem] border border-[rgba(15,40,70,0.08)] bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-display text-lg font-semibold text-ink">{title}</h3>
        {pending ? (
          <span className="flex items-center gap-1.5 text-xs font-medium text-muted">
            <Loader2 className="h-3.5 w-3.5 animate-spin text-brand" aria-hidden />
            Saving…
          </span>
        ) : saved ? (
          <span className="flex items-center gap-1.5 text-xs font-medium text-brand">
            <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
            Saved
          </span>
        ) : null}
      </div>
      {children}
    </div>
  );
}

function Row({
  name,
  meta,
  onOpen,
  onDelete,
  onRename,
  showOrder,
  order,
  pending,
}: {
  name: string;
  meta?: string;
  onOpen?: () => void;
  onDelete: () => void;
  onRename: (name: string, order?: number) => void;
  showOrder?: boolean;
  order?: number;
  pending?: boolean;
}) {
  const [editName, setEditName] = useState(name);
  const [editOrder, setEditOrder] = useState(String(order ?? 0));

  useEffect(() => {
    setEditName(name);
    setEditOrder(String(order ?? 0));
  }, [name, order]);

  const dirty =
    editName.trim() !== name.trim() ||
    (showOrder && Number(editOrder) !== (order ?? 0));

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-[rgba(15,40,70,0.08)] bg-mist px-3 py-2">
      <Input
        className="min-w-[140px] flex-1"
        value={editName}
        onChange={(e) => setEditName(e.target.value)}
        disabled={pending}
      />
      {showOrder ? (
        <Input
          className="w-20"
          type="number"
          value={editOrder}
          onChange={(e) => setEditOrder(e.target.value)}
          disabled={pending}
        />
      ) : null}
      {meta ? <span className="text-xs text-muted">{meta}</span> : null}
      <Button
        type="button"
        size="sm"
        variant="secondary"
        disabled={pending || !dirty}
        onClick={() => onRename(editName, Number(editOrder) || 0)}
      >
        {pending && dirty ? "…" : "Save"}
      </Button>
      {onOpen ? (
        <Button type="button" size="sm" onClick={onOpen} disabled={pending}>
          Open
        </Button>
      ) : null}
      <Button type="button" size="sm" variant="outline" onClick={onDelete} disabled={pending}>
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

function AddRow({
  placeholder,
  showOrder,
  onAdd,
  pending,
}: {
  placeholder: string;
  showOrder?: boolean;
  onAdd: (name: string, order?: number) => void;
  pending?: boolean;
}) {
  const [name, setName] = useState("");
  const [order, setOrder] = useState("0");

  return (
    <div className="flex flex-wrap gap-2 pt-2">
      <Input
        className="min-w-[140px] flex-1"
        placeholder={placeholder}
        value={name}
        onChange={(e) => setName(e.target.value)}
        disabled={pending}
        onKeyDown={(e) => {
          if (e.key === "Enter" && name.trim() && !pending) {
            e.preventDefault();
            onAdd(name.trim(), Number(order) || 0);
            setName("");
            setOrder("0");
          }
        }}
      />
      {showOrder ? (
        <Input
          className="w-20"
          type="number"
          value={order}
          onChange={(e) => setOrder(e.target.value)}
          disabled={pending}
        />
      ) : null}
      <Button
        type="button"
        disabled={!name.trim() || pending}
        onClick={() => {
          onAdd(name.trim(), Number(order) || 0);
          setName("");
          setOrder("0");
        }}
      >
        {pending ? (
          <>
            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" aria-hidden />
            Adding…
          </>
        ) : (
          "Add"
        )}
      </Button>
    </div>
  );
}
