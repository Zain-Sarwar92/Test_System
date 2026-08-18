"use client";

import { CalendarDays } from "lucide-react";
import { cn } from "@/lib/utils";

function formatDisplayDate(value: string) {
  if (!value) return "";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function DateField({
  value,
  onChange,
  disabled,
  readOnly,
  className,
  id,
}: {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  readOnly?: boolean;
  className?: string;
  id?: string;
}) {
  const locked = Boolean(disabled || readOnly);

  return (
    <div className={cn("pts-date-field", locked && "is-locked", className)}>
      <CalendarDays className="pts-date-field-icon" aria-hidden />
      <div className="pts-date-field-body">
        <span className={cn("pts-date-field-display", !value && "is-empty")}>
          {value ? formatDisplayDate(value) : "Pick a date"}
        </span>
        <input
          id={id}
          type="date"
          className="pts-date-field-input"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          disabled={disabled}
          readOnly={readOnly}
        />
      </div>
    </div>
  );
}
