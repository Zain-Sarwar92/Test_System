"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, Search } from "lucide-react";
import { cn } from "@/lib/utils";

export type MultiSearchSelectOption = {
  value: string;
  label: string;
  hint?: string;
  /** Kept out of the default list; only reachable through the search box. */
  searchOnly?: boolean;
};

type PanelPosition = {
  left: number;
  width: number;
  top?: number;
  bottom?: number;
};

const PANEL_MAX_HEIGHT = 288;

export function MultiSearchSelect({
  values,
  options,
  onChange,
  placeholder = "Select",
  searchPlaceholder = "Search…",
  emptyText = "No match found",
  disabled,
  className,
  ariaLabel,
}: {
  values: string[];
  options: MultiSearchSelectOption[];
  onChange: (values: string[]) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  disabled?: boolean;
  className?: string;
  ariaLabel?: string;
}) {
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [position, setPosition] = useState<PanelPosition | null>(null);

  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => setMounted(true), []);

  const selectedLabels = useMemo(
    () =>
      options
        .filter((option) => values.includes(option.value))
        .map((option) => option.label),
    [options, values],
  );

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) {
      return options.filter(
        (option) => !option.searchOnly || values.includes(option.value),
      );
    }
    return options.filter((option) =>
      `${option.label} ${option.hint ?? ""}`.toLowerCase().includes(needle),
    );
  }, [options, query, values]);

  const updatePosition = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const openUp = spaceBelow < PANEL_MAX_HEIGHT && rect.top > spaceBelow;
    setPosition({
      left: rect.left,
      width: rect.width,
      ...(openUp
        ? { bottom: window.innerHeight - rect.top + 6 }
        : { top: rect.bottom + 6 }),
    });
  }, []);

  useEffect(() => {
    if (!open) return;
    updatePosition();
    const onViewportChange = () => updatePosition();
    window.addEventListener("resize", onViewportChange);
    window.addEventListener("scroll", onViewportChange, true);
    return () => {
      window.removeEventListener("resize", onViewportChange);
      window.removeEventListener("scroll", onViewportChange, true);
    };
  }, [open, updatePosition]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        triggerRef.current?.contains(target) ||
        panelRef.current?.contains(target)
      ) {
        return;
      }
      setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => searchRef.current?.focus(), 10);
    return () => window.clearTimeout(timer);
  }, [open]);

  function openPanel() {
    if (disabled) return;
    setQuery("");
    setActiveIndex(0);
    setOpen(true);
  }

  function toggle(next: string) {
    onChange(
      values.includes(next)
        ? values.filter((value) => value !== next)
        : [...values, next],
    );
  }

  function onKeyDown(event: React.KeyboardEvent) {
    if (event.key === "Escape") {
      event.preventDefault();
      setOpen(false);
      triggerRef.current?.focus();
      return;
    }
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!open) {
        openPanel();
        return;
      }
      if (filtered.length === 0) return;
      const step = event.key === "ArrowDown" ? 1 : -1;
      setActiveIndex((prev) => {
        const next = prev + step;
        if (next < 0) return filtered.length - 1;
        if (next >= filtered.length) return 0;
        return next;
      });
      return;
    }
    if (event.key === "Enter" && open) {
      event.preventDefault();
      const option = filtered[activeIndex];
      if (option) toggle(option.value);
    }
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        onClick={() => (open ? setOpen(false) : openPanel())}
        onKeyDown={onKeyDown}
        className={cn("pts-select-trigger", open && "is-open", className)}
      >
        <span
          className={cn(
            "pts-select-value",
            selectedLabels.length === 0 && "pts-select-value--placeholder",
          )}
        >
          {selectedLabels.length > 0 ? selectedLabels.join(", ") : placeholder}
        </span>
        <ChevronDown className={cn("pts-select-chevron", open && "is-open")} />
      </button>

      {mounted && open && position
        ? createPortal(
            <div
              ref={panelRef}
              className="pts-select-panel"
              style={{
                left: position.left,
                top: position.top,
                bottom: position.bottom,
                width: Math.max(position.width, 224),
              }}
              role="listbox"
              aria-multiselectable
            >
              <div className="pts-select-search">
                <Search className="h-3.5 w-3.5 shrink-0 text-[color:var(--muted)]" />
                <input
                  ref={searchRef}
                  value={query}
                  placeholder={searchPlaceholder}
                  onChange={(event) => {
                    setQuery(event.target.value);
                    setActiveIndex(0);
                  }}
                  onKeyDown={onKeyDown}
                />
              </div>

              <div className="pts-select-options nice-scroll">
                {filtered.length === 0 ? (
                  <p className="pts-select-empty">{emptyText}</p>
                ) : (
                  filtered.map((option, index) => {
                    const isSelected = values.includes(option.value);
                    return (
                      <button
                        key={option.value}
                        type="button"
                        role="option"
                        aria-selected={isSelected}
                        onMouseEnter={() => setActiveIndex(index)}
                        onClick={() => toggle(option.value)}
                        className={cn(
                          "pts-select-option",
                          index === activeIndex && "is-active",
                          isSelected && "is-selected",
                        )}
                      >
                        <span className="pts-select-checkbox" aria-hidden="true">
                          {isSelected ? <Check className="h-3 w-3" /> : null}
                        </span>
                        <span className="pts-select-option-label">
                          {option.label}
                        </span>
                        {option.hint ? (
                          <span className="pts-select-option-hint">
                            {option.hint}
                          </span>
                        ) : null}
                      </button>
                    );
                  })
                )}
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
