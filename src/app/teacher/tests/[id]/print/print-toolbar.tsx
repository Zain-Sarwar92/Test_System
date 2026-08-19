"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";

export function PrintToolbar({
  backHref,
  listHref,
}: {
  backHref: string;
  listHref: string;
}) {
  return (
    <div className="print-toolbar no-print">
      <div className="flex flex-wrap gap-2">
        <Link href={listHref}>
          <Button variant="outline" size="sm">
            Saved Tests
          </Button>
        </Link>
        <Link href={backHref}>
          <Button variant="outline" size="sm">
            Edit test
          </Button>
        </Link>
      </div>
      <Button size="sm" onClick={() => window.print()}>
        Print / Save PDF
      </Button>
    </div>
  );
}
