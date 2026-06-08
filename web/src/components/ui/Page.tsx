import type { ReactNode } from "react";

export function Page({
  title,
  subtitle,
  children,
  narrow,
  back,
  className,
}: {
  title?: string;
  subtitle?: string;
  children: ReactNode;
  narrow?: boolean;
  back?: ReactNode;
  className?: string;
}) {
  return (
    <main
      className={[
        "page",
        "page-enter",
        narrow ? "page--narrow" : "",
        className ?? "",
      ].join(" ")}
    >
      {back}
      {(title || subtitle) && (
        <header className="page__header">
          {title && <h1 className="page__title">{title}</h1>}
          {subtitle && <p className="page__subtitle">{subtitle}</p>}
        </header>
      )}
      {children}
    </main>
  );
}
