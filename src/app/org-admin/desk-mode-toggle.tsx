"use client";

import { useState, useTransition } from "react";
import { FilePlus2, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/toast";
import { setOrgDeskMode } from "./desk-mode-actions";
import type { OrgDeskMode } from "@/lib/org-desk-mode";

export function DeskModeToggle({ mode }: { mode: OrgDeskMode }) {
  const [pending, startTransition] = useTransition();
  const [askPin, setAskPin] = useState(false);
  const [pin, setPin] = useState("");

  function switchMode(next: OrgDeskMode, unlockPin?: string) {
    startTransition(async () => {
      const result = await setOrgDeskMode({ mode: next, unlockPin });
      // redirect throws; only errors return
      if (result && !result.ok) {
        toast.error(result.error);
      }
    });
  }

  if (mode === "paper") {
    if (!askPin) {
      return (
        <Button
          type="button"
          size="sm"
          variant="secondary"
          disabled={pending}
          onClick={() => setAskPin(true)}
          className="w-full justify-start"
        >
          <Shield className="h-3.5 w-3.5" />
          Full admin
        </Button>
      );
    }

    return (
      <form
        className="space-y-2 rounded-xl border border-white/15 bg-white/5 p-2.5"
        onSubmit={(event) => {
          event.preventDefault();
          switchMode("full", pin);
        }}
      >
        <p className="px-0.5 text-[10px] font-semibold tracking-wide text-white/55 uppercase">
          Full admin PIN
        </p>
        <Input
          type="password"
          inputMode="numeric"
          autoComplete="off"
          value={pin}
          onChange={(event) => setPin(event.target.value)}
          placeholder="PIN"
          className="h-9 border-white/20 bg-white/10 text-white placeholder:text-white/40"
          autoFocus
        />
        <div className="flex gap-1.5">
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={pending}
            className="h-8 flex-1 border-white/20 bg-transparent text-white hover:bg-white/10"
            onClick={() => {
              setAskPin(false);
              setPin("");
            }}
          >
            Cancel
          </Button>
          <Button type="submit" size="sm" disabled={pending || !pin.trim()} className="h-8 flex-1">
            {pending ? "…" : "Unlock"}
          </Button>
        </div>
      </form>
    );
  }

  return (
    <Button
      type="button"
      size="sm"
      variant="secondary"
      disabled={pending}
      onClick={() => switchMode("paper")}
      className="w-full justify-start"
    >
      <FilePlus2 className="h-3.5 w-3.5" />
      {pending ? "…" : "Paper desk"}
    </Button>
  );
}
