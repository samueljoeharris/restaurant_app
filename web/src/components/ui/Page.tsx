import type { ReactNode } from "react";
import { Link } from "react-router-dom";

import { cn } from "../../lib/cn";

export function Page({
  title,
  subtitle,
  back,
  children,
  narrow,
  className,
}: {
  title?: string;
  subtitle?: string;
  back?: ReactNode;
  children: ReactNode;
  narrow?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "mx-auto px-8 py-6 animate-page-enter",
        narrow ? "max-w-[var(--page-narrow)]" : "max-w-[var(--page-max-width)]",
        className,
      )}
    >
      {back}
      {(title || subtitle) && (
        <header className="mb-5">
          {title && (
            <h1 className="text-2xl tracking-tight">{title}</h1>
          )}
          {subtitle && <p className="mt-2 text-sm text-text-muted">{subtitle}</p>}
        </header>
      )}
      {children}
    </div>
  );
}

export function BackLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link
      to={to}
      className="mb-4 inline-flex items-center gap-1 text-sm font-semibold text-text-muted transition-colors duration-fast hover:text-brand"
    >
      {children}
    </Link>
  );
}
