"use client";

import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

export function PrintButton({ label = "Print / Save PDF" }: { label?: string }) {
  return (
    <Button size="sm" onClick={() => window.print()}>
      <Printer className="h-3.5 w-3.5" />
      {label}
    </Button>
  );
}
