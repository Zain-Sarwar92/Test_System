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
        "rounded-[1.15rem] border border-[rgba(15,40,70,0.08)] bg-gradient-to-br from-white/96 via-white/92 to-[#f3f8fb]/95 p-[1.35rem] shadow-[0_12px_30px_rgba(11,31,51,0.06)] md:p-6",
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
