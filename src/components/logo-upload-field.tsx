"use client";

import { useId, useRef, useState } from "react";
import { ImagePlus, Upload } from "lucide-react";

export function LogoUploadField({
  currentUrl = "",
}: {
  currentUrl?: string | null;
}) {
  const id = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState("");
  const [preview, setPreview] = useState(currentUrl ?? "");

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-stretch">
      <div className="flex h-[5.5rem] w-[5.5rem] shrink-0 items-center justify-center overflow-hidden rounded-[0.9rem] border border-[rgba(15,40,70,0.12)] bg-card">
        {preview ? (
          <img src={preview} alt="" className="h-full w-full object-contain p-1.5" />
        ) : (
          <ImagePlus className="h-7 w-7 text-muted" aria-hidden />
        )}
      </div>

      <label
        htmlFor={id}
        className="flex min-h-[5.5rem] flex-1 cursor-pointer flex-col items-center justify-center rounded-[0.9rem] border border-dashed border-[rgba(15,118,110,0.35)] bg-mist px-4 py-3 text-center transition hover:border-brand hover:bg-brand/5"
      >
        <Upload className="mb-1 h-4 w-4 text-brand" aria-hidden />
        <span className="text-sm font-semibold text-ink">
          {name || "Click to upload logo"}
        </span>
        <span className="mt-0.5 text-xs text-muted">JPG, PNG, WEBP, or GIF · max 2 MB</span>
        <input
          id={id}
          ref={inputRef}
          name="logoFile"
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          className="sr-only"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (!file) {
              setName("");
              setPreview(currentUrl ?? "");
              return;
            }
            setName(file.name);
            const next = URL.createObjectURL(file);
            setPreview((prev) => {
              if (prev.startsWith("blob:")) URL.revokeObjectURL(prev);
              return next;
            });
          }}
        />
      </label>
    </div>
  );
}
