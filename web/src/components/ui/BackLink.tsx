import { Link, type LinkProps } from "react-router-dom";

import { cn } from "../../lib/cn";

export function BackLink({ className, children, ...props }: LinkProps) {
  return (
    <Link
      className={cn(
        "mb-4 inline-flex items-center gap-1 text-sm font-semibold text-text-muted transition-colors duration-fast hover:text-brand",
        className,
      )}
      {...props}
    >
      {children}
    </Link>
  );
}
