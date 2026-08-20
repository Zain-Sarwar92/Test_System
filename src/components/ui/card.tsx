import { cn } from "@/lib/utils";

export function Card({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "rounded-[1.15rem] border border-line bg-card p-[1.35rem] shadow-[var(--shadow-soft)] md:p-6",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function CardTitle({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <h2
      className={cn(
        "font-display text-[1.15rem] leading-snug font-semibold tracking-tight text-ink md:text-xl",
        className,
      )}
    >
      {children}
    </h2>
  );
}

export function CardDescription({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <p className={cn("mt-1.5 text-[0.95rem] leading-relaxed text-muted", className)}>
      {children}
    </p>
  );
}
