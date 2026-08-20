import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Consistent back control for results flow — always goes to an explicit parent route. */
export function ResultsBackLink({
  href,
  label = "Back",
}: {
  href: string;
  label?: string;
}) {
  return (
    <Link href={href}>
      <Button variant="outline" size="sm" className="gap-1.5">
        <ArrowLeft className="h-3.5 w-3.5" />
        {label}
      </Button>
    </Link>
  );
}
