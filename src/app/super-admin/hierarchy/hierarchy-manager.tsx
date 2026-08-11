"use client";

import { useMemo, useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
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

export type HierarchyPayload = Array<{
  id: string;
  name: string;
  classes: Array<{
    id: string;
    name: string;
    subjects: Array<{
      id: string;
      name: string;
      chapters: Array<{
        id: string;
        name: string;
        order: number;
        topics: Array<{ id: string; name: string; order: number; questionCount: number }>;
      }>;
    }>;
  }>;
}>;

type Level = "board" | "class" | "subject" | "chapter" | "topic";

export function HierarchyManager({ boards }: { boards: HierarchyPayload }) {
  const [boardId, setBoardId] = useState<string | null>(boards[0]?.id ?? null);
  const [classId, setClassId] = useState<string | null>(null);
  const [subjectId, setSubjectId] = useState<string | null>(null);
  const [chapterId, setChapterId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const board = boards.find((b) => b.id === boardId);
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

  function run(action: (fd: FormData) => Promise<void>, fd: FormData) {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      try {
        await action(fd);
        setMessage("Saved.");
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
        <LevelPanel title="Boards">
          {boards.map((b) => (
            <Row
              key={b.id}
              name={b.name}
              meta={`${b.classes.length} classes`}
              onOpen={() => {
                setBoardId(b.id);
                setClassId(null);
                setSubjectId(null);
                setChapterId(null);
              }}
              onDelete={() => {
                if (!confirm(`Delete board "${b.name}" and all nested data?`)) return;
                const fd = new FormData();
                fd.set("id", b.id);
                run(deleteBoard, fd);
                setBoardId(null);
              }}
              onRename={(name) => {
                const fd = new FormData();
                fd.set("id", b.id);
                fd.set("name", name);
                run(updateBoard, fd);
              }}
            />
          ))}
          <AddRow
            placeholder="New board name"
            onAdd={(name) => {
              const fd = new FormData();
              fd.set("name", name);
              run(createBoard, fd);
            }}
          />
        </LevelPanel>
      ) : !classId ? (
        <LevelPanel title={`Classes — ${board?.name}`}>
          <Button variant="outline" size="sm" onClick={() => setBoardId(null)}>
            ← All boards
          </Button>
          {board?.classes.map((c) => (
            <Row
              key={c.id}
              name={c.name}
              meta={`${c.subjects.length} subjects`}
              onOpen={() => {
                setClassId(c.id);
                setSubjectId(null);
                setChapterId(null);
              }}
              onDelete={() => {
                if (!confirm(`Delete class "${c.name}"?`)) return;
                const fd = new FormData();
                fd.set("id", c.id);
                run(deleteClass, fd);
                setClassId(null);
              }}
              onRename={(name) => {
                const fd = new FormData();
                fd.set("id", c.id);
                fd.set("name", name);
                run(updateClass, fd);
              }}
            />
          ))}
          <AddRow
            placeholder="New class name"
            onAdd={(name) => {
              const fd = new FormData();
              fd.set("boardId", boardId);
              fd.set("name", name);
              run(createClass, fd);
            }}
          />
        </LevelPanel>
      ) : !subjectId ? (
        <LevelPanel title={`Subjects — ${klass?.name}`}>
          <Button variant="outline" size="sm" onClick={() => setClassId(null)}>
            ← Classes
          </Button>
          {klass?.subjects.map((s) => (
            <Row
              key={s.id}
              name={s.name}
              meta={`${s.chapters.length} chapters`}
              onOpen={() => {
                setSubjectId(s.id);
                setChapterId(null);
              }}
              onDelete={() => {
                if (!confirm(`Delete subject "${s.name}"?`)) return;
                const fd = new FormData();
                fd.set("id", s.id);
                run(deleteSubject, fd);
                setSubjectId(null);
              }}
              onRename={(name) => {
                const fd = new FormData();
                fd.set("id", s.id);
                fd.set("name", name);
                run(updateSubject, fd);
              }}
            />
          ))}
          <AddRow
            placeholder="New subject name"
            onAdd={(name) => {
              const fd = new FormData();
              fd.set("classId", classId);
              fd.set("name", name);
              run(createSubject, fd);
            }}
          />
        </LevelPanel>
      ) : !chapterId ? (
        <LevelPanel title={`Chapters — ${subject?.name}`}>
          <Button variant="outline" size="sm" onClick={() => setSubjectId(null)}>
            ← Subjects
          </Button>
          {subject?.chapters.map((ch) => (
            <Row
              key={ch.id}
              name={ch.name}
              meta={`order ${ch.order} · ${ch.topics.length} topics`}
              onOpen={() => setChapterId(ch.id)}
              onDelete={() => {
                if (!confirm(`Delete chapter "${ch.name}"?`)) return;
                const fd = new FormData();
                fd.set("id", ch.id);
                run(deleteChapter, fd);
                setChapterId(null);
              }}
              onRename={(name, order) => {
                const fd = new FormData();
                fd.set("id", ch.id);
                fd.set("name", name);
                fd.set("order", String(order ?? 0));
                run(updateChapter, fd);
              }}
              showOrder
              order={ch.order}
            />
          ))}
          <AddRow
            placeholder="New chapter name"
            showOrder
            onAdd={(name, order) => {
              const fd = new FormData();
              fd.set("subjectId", subjectId);
              fd.set("name", name);
              fd.set("order", String(order ?? 0));
              run(createChapter, fd);
            }}
          />
        </LevelPanel>
      ) : (
        <LevelPanel title={`Topics — ${chapter?.name}`}>
          <Button variant="outline" size="sm" onClick={() => setChapterId(null)}>
            ← Chapters
          </Button>
          {chapter?.topics.map((t) => (
            <Row
              key={t.id}
              name={t.name}
              meta={`order ${t.order} · ${t.questionCount} questions`}
              onDelete={() => {
                if (t.questionCount > 0) {
                  alert("Cannot delete topic with linked questions.");
                  return;
                }
                if (!confirm(`Delete topic "${t.name}"?`)) return;
                const fd = new FormData();
                fd.set("id", t.id);
                run(deleteTopic, fd);
              }}
              onRename={(name, order) => {
                const fd = new FormData();
                fd.set("id", t.id);
                fd.set("name", name);
                fd.set("order", String(order ?? 0));
                run(updateTopic, fd);
              }}
              showOrder
              order={t.order}
            />
          ))}
          <AddRow
            placeholder="New topic name"
            showOrder
            onAdd={(name, order) => {
              const fd = new FormData();
              fd.set("chapterId", chapterId);
              fd.set("name", name);
              fd.set("order", String(order ?? 0));
              run(createTopic, fd);
            }}
          />
        </LevelPanel>
      )}

      {pending ? <p className="text-sm text-muted">Saving…</p> : null}
      {message ? <p className="text-sm font-medium text-brand">{message}</p> : null}
      {error ? <p className="text-sm font-medium text-red-700">{error}</p> : null}
    </div>
  );
}

function LevelPanel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="chart-card space-y-3 rounded-[1rem] border border-[rgba(15,40,70,0.08)] bg-white p-4">
      <h3 className="font-display text-lg font-semibold text-ink">{title}</h3>
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
}: {
  name: string;
  meta?: string;
  onOpen?: () => void;
  onDelete: () => void;
  onRename: (name: string, order?: number) => void;
  showOrder?: boolean;
  order?: number;
}) {
  const [editName, setEditName] = useState(name);
  const [editOrder, setEditOrder] = useState(String(order ?? 0));

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-[rgba(15,40,70,0.08)] bg-[#f8fafc] px-3 py-2">
      <Input
        className="min-w-[140px] flex-1"
        value={editName}
        onChange={(e) => setEditName(e.target.value)}
      />
      {showOrder ? (
        <Input
          className="w-20"
          type="number"
          value={editOrder}
          onChange={(e) => setEditOrder(e.target.value)}
        />
      ) : null}
      {meta ? <span className="text-xs text-muted">{meta}</span> : null}
      <Button
        type="button"
        size="sm"
        variant="secondary"
        onClick={() => onRename(editName, Number(editOrder) || 0)}
      >
        Save
      </Button>
      {onOpen ? (
        <Button type="button" size="sm" onClick={onOpen}>
          Open
        </Button>
      ) : null}
      <Button type="button" size="sm" variant="outline" onClick={onDelete}>
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

function AddRow({
  placeholder,
  showOrder,
  onAdd,
}: {
  placeholder: string;
  showOrder?: boolean;
  onAdd: (name: string, order?: number) => void;
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
      />
      {showOrder ? (
        <Input
          className="w-20"
          type="number"
          value={order}
          onChange={(e) => setOrder(e.target.value)}
        />
      ) : null}
      <Button
        type="button"
        disabled={!name.trim()}
        onClick={() => {
          onAdd(name.trim(), Number(order) || 0);
          setName("");
          setOrder("0");
        }}
      >
        Add
      </Button>
    </div>
  );
}
