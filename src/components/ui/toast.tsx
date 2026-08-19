"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, Info, X } from "lucide-react";
import { cn } from "@/lib/utils";

type ToastVariant = "error" | "success" | "warning" | "info";

type ToastItem = {
  id: number;
  variant: ToastVariant;
  message: string;
  leaving: boolean;
};

const DEFAULT_DURATION = 4200;
/** Must stay in sync with the pts-toast-out animation duration in globals.css. */
const EXIT_DURATION = 420;

let items: ToastItem[] = [];
let nextId = 1;
const listeners = new Set<(next: ToastItem[]) => void>();

function emit() {
  const snapshot = [...items];
  listeners.forEach((listener) => listener(snapshot));
}

function removeToast(id: number) {
  items = items.filter((item) => item.id !== id);
  emit();
}

function dismissToast(id: number) {
  const target = items.find((item) => item.id === id);
  if (!target || target.leaving) return;
  items = items.map((item) =>
    item.id === id ? { ...item, leaving: true } : item,
  );
  emit();
  window.setTimeout(() => removeToast(id), EXIT_DURATION);
}

function pushToast(variant: ToastVariant, message: string, duration?: number) {
  if (!message?.trim()) return;
  const id = nextId++;
  items = [...items, { id, variant, message, leaving: false }];
  emit();
  if (typeof window !== "undefined") {
    window.setTimeout(() => dismissToast(id), duration ?? DEFAULT_DURATION);
  }
}

export const toast = {
  error: (message: string, duration?: number) =>
    pushToast("error", message, duration),
  success: (message: string, duration?: number) =>
    pushToast("success", message, duration),
  warning: (message: string, duration?: number) =>
    pushToast("warning", message, duration),
  info: (message: string, duration?: number) =>
    pushToast("info", message, duration),
};

const ICONS: Record<ToastVariant, typeof AlertTriangle> = {
  error: AlertTriangle,
  warning: AlertTriangle,
  success: CheckCircle2,
  info: Info,
};

export function Toaster() {
  const [visible, setVisible] = useState<ToastItem[]>([]);

  useEffect(() => {
    const listener = (next: ToastItem[]) => setVisible(next);
    listeners.add(listener);
    setVisible([...items]);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  if (visible.length === 0) return null;

  return (
    <div className="pts-toast-viewport" role="region" aria-label="Notifications">
      {visible.map((item) => {
        const Icon = ICONS[item.variant];
        return (
          <div
            key={item.id}
            role={item.variant === "error" ? "alert" : "status"}
            className={cn(
              "pts-toast",
              `pts-toast--${item.variant}`,
              item.leaving && "pts-toast--leaving",
            )}
          >
            <span className="pts-toast-icon">
              <Icon className="h-[1.05rem] w-[1.05rem]" />
            </span>
            <p className="pts-toast-message">{item.message}</p>
            <button
              type="button"
              className="pts-toast-close"
              onClick={() => dismissToast(item.id)}
              aria-label="Dismiss notification"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
