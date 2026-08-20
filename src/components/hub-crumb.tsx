import { cn } from "@/lib/utils";

export function HubCrumb({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <nav
      className={cn(
        "hub-crumb flex flex-wrap items-center gap-1.5 text-sm",
        className,
      )}
    >
      {children}
    </nav>
  );
}
