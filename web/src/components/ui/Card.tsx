import type { ReactNode } from "react";

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
    <section className={["ui-card", accent ? "ui-card--accent" : "", className ?? ""].join(" ")}>
      {(title || subtitle || action) && (
        <header className="ui-card__header">
          <div>
            {title && <h2 className="ui-card__title">{title}</h2>}
            {subtitle && <p className="ui-card__subtitle">{subtitle}</p>}
          </div>
          {action}
        </header>
      )}
      <div className="ui-card__body">{children}</div>
    </section>
  );
}
