import type { ReactNode } from "react";

import { cn } from "../../lib/cn";

export function Card({
  title,
  subtitle,
  action,
  children,
  className,
  accent,
}: {
  title?: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  accent?: boolean;
}) {
  return (
    <section
      className={cn(
        "overflow-hidden rounded-lg border border-border bg-surface shadow-sm",
        accent && "border-brand/25 bg-gradient-to-b from-brand-soft to-surface to-40%",
        className,
      )}
    >
      {(title || subtitle || action) && (
        <header className="flex items-start justify-between gap-3 px-5 pt-4">
          <div>
            {title && <h2 className="text-lg">{title}</h2>}
            {subtitle && <p className="mt-1 text-sm text-text-muted">{subtitle}</p>}
          </div>
          {action}
        </header>
      )}
      <div className="grid gap-4 px-5 pb-5 pt-4">{children}</div>
    </section>
  );
}
