import type { ReactNode } from "react";
import { Link } from "react-router-dom";

import { cn } from "../../lib/cn";

const rowClass =
  "flex min-h-[52px] items-center gap-3 rounded-[14px] border border-border bg-surface px-3.5 py-3 shadow-sm";

export function SettingsToggleRow({
  label,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div className={rowClass}>
      <span className="min-w-0 flex-1 text-sm font-bold leading-snug">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        className={cn(
          "relative h-6 w-[42px] shrink-0 cursor-pointer rounded-full border-0 p-0 transition-colors duration-fast ease-out",
          "shadow-[inset_0_1px_2px_rgba(0,0,0,0.15)] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-brand/20",
          checked ? "bg-brand" : "bg-border-strong",
          disabled && "cursor-not-allowed opacity-50",
        )}
        onClick={() => onChange(!checked)}
      >
        <span
          className={cn(
            "absolute top-[3px] h-[18px] w-[18px] rounded-full bg-surface shadow-[0_1px_2px_rgba(0,0,0,0.2)] transition-[left] duration-fast ease-out",
            checked ? "left-[21px]" : "left-[3px]",
          )}
        />
      </button>
    </div>
  );
}

export function SettingsLinkRow({
  to,
  href,
  label,
  external,
}: {
  label: string;
  to?: string;
  href?: string;
  external?: boolean;
}) {
  const chevron = <span className="shrink-0 text-lg leading-none text-text-muted/70">›</span>;
  const content = (
    <>
      <span className="min-w-0 flex-1 text-sm font-bold leading-snug">{label}</span>
      {chevron}
    </>
  );

  if (to) {
    return (
      <Link to={to} className={cn(rowClass, "transition-colors duration-fast hover:border-brand/30")}>
        {content}
      </Link>
    );
  }

  return (
    <a
      href={href}
      className={cn(rowClass, "transition-colors duration-fast hover:border-brand/30")}
      {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
    >
      {content}
    </a>
  );
}

export function SettingsPanel({
  title,
  subtitle,
  children,
  className,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("overflow-hidden rounded-[14px] border border-border bg-surface shadow-sm", className)}>
      <header className="border-b border-border/70 px-3.5 py-3">
        <h2 className="text-base">{title}</h2>
        {subtitle && <p className="mt-1 text-sm text-text-muted">{subtitle}</p>}
      </header>
      <div className="grid gap-3 px-3.5 py-3.5">{children}</div>
    </section>
  );
}
