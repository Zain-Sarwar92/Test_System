import { cn } from "@/lib/utils";

export function PageHeader({
  kicker,
  title,
  description,
  actions,
  className,
}: {
  kicker?: string;
  title: string;
  description?: string;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("page-header", className)}>
      <div className="min-w-0 flex-1">
        {kicker ? <p className="page-kicker">{kicker}</p> : null}
        <h2 className="page-title">{title}</h2>
        {description ? <p className="page-subtitle">{description}</p> : null}
      </div>
      {actions ? <div className="page-header-actions">{actions}</div> : null}
    </header>
  );
}

export function PageStack({
  children,
  wide = false,
  className,
}: {
  children: React.ReactNode;
  wide?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("page-stack", wide && "page-stack-wide", className)}>
      {children}
    </div>
  );
}
