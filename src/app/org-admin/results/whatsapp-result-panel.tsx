"use client";

import { useMemo, useState } from "react";
import { Check, ChevronLeft, ChevronRight, Copy, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  buildResultWhatsAppMessage,
  toWhatsAppDigits,
  whatsAppClickUrl,
  type WhatsAppResultLine,
} from "@/lib/whatsapp";

export type WhatsAppShareStudent = {
  id: string;
  rollNumber: string;
  name: string;
  fatherName: string;
  phone: string | null;
  lines: WhatsAppResultLine[];
  total?: string | null;
  percent?: string | number | null;
  grade?: string | null;
  position?: string | number | null;
};

export function WhatsAppResultPanel({
  orgName,
  title,
  className,
  sectionName,
  session,
  students,
}: {
  orgName: string;
  title: string;
  className: string;
  sectionName: string;
  session: string;
  students: WhatsAppShareStudent[];
}) {
  const withPhone = useMemo(
    () =>
      students.filter((student) => toWhatsAppDigits(student.phone) != null),
    [students],
  );
  const missingPhone = students.length - withPhone.length;

  const [index, setIndex] = useState(0);
  const [sentIds, setSentIds] = useState<Set<string>>(() => new Set());
  const [copied, setCopied] = useState(false);
  const [open, setOpen] = useState(false);

  const current = withPhone[index] ?? null;
  const digits = current ? toWhatsAppDigits(current.phone) : null;

  const message = current
    ? buildResultWhatsAppMessage({
        orgName,
        title,
        className,
        sectionName,
        session,
        rollNumber: current.rollNumber,
        studentName: current.name,
        fatherName: current.fatherName,
        lines: current.lines,
        total: current.total,
        percent: current.percent,
        grade: current.grade,
        position: current.position,
      })
    : "";

  const url =
    current && digits ? whatsAppClickUrl(digits, message) : null;

  function markSentAndNext() {
    if (!current) return;
    setSentIds((prev) => new Set(prev).add(current.id));
    if (index < withPhone.length - 1) setIndex((value) => value + 1);
  }

  async function copyMessage() {
    if (!message) return;
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="no-print mb-4 rounded-[1rem] border border-line bg-card p-4 shadow-[var(--shadow-soft)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-ink">WhatsApp result share (free)</p>
          <p className="mt-1 max-w-xl text-xs text-muted">
            Opens WhatsApp with a ready text message. PDF cannot auto-attach on free
            share — use Print / Save PDF separately if needed.
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          variant={open ? "secondary" : "default"}
          onClick={() => setOpen((value) => !value)}
        >
          <MessageCircle className="h-3.5 w-3.5" />
          {open ? "Hide" : "Share on WhatsApp"}
        </Button>
      </div>

      {open ? (
        <div className="mt-4 space-y-3">
          <div className="flex flex-wrap gap-3 text-xs text-muted">
            <span>
              With phone: <strong className="text-ink">{withPhone.length}</strong>
            </span>
            <span>
              Missing phone: <strong className="text-ink">{missingPhone}</strong>
            </span>
            <span>
              Marked sent: <strong className="text-ink">{sentIds.size}</strong>
            </span>
          </div>

          {withPhone.length === 0 ? (
            <p className="text-sm text-muted">
              No student phone numbers found. Add phones on student profiles first.
            </p>
          ) : current && url ? (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line bg-mist/60 px-3 py-2">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-ink">
                    {current.rollNumber} · {current.name}
                    {sentIds.has(current.id) ? (
                      <span className="ml-2 text-xs font-medium text-brand">
                        (sent)
                      </span>
                    ) : null}
                  </p>
                  <p className="truncate text-xs text-muted">
                    {current.phone} · {index + 1}/{withPhone.length}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={index === 0}
                    onClick={() => setIndex((value) => Math.max(0, value - 1))}
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                    Prev
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={index >= withPhone.length - 1}
                    onClick={() =>
                      setIndex((value) =>
                        Math.min(withPhone.length - 1, value + 1),
                      )
                    }
                  >
                    Next
                    <ChevronRight className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>

              <textarea
                readOnly
                value={message}
                rows={10}
                className="w-full resize-y rounded-xl border border-line bg-card px-3 py-2 font-mono text-xs text-ink"
              />

              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  onClick={() => {
                    window.open(url, "_blank", "noopener,noreferrer");
                    markSentAndNext();
                  }}
                >
                  <MessageCircle className="h-3.5 w-3.5" />
                  Open WhatsApp &amp; next
                </Button>
                <Button type="button" size="sm" variant="secondary" onClick={copyMessage}>
                  {copied ? (
                    <Check className="h-3.5 w-3.5" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                  {copied ? "Copied" : "Copy text"}
                </Button>
              </div>
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
