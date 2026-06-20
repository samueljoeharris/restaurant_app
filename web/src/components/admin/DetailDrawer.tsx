import type { ReactNode } from "react";

import { cn } from "../../lib/cn";
import { Button } from "../ui/Button";

export function DetailDrawer({
  open,
  title,
  onClose,
  children,
  footer,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}) {
  if (!open) return null;

  return (
    <>
      <button
        type="button"
        className="fixed inset-0 z-40 cursor-default border-0 bg-black/30"
        aria-label="Close drawer"
        onClick={onClose}
      />
      <aside
        className={cn(
          "fixed top-0 right-0 z-50 flex h-full w-[min(100%,28rem)] flex-col",
          "border-l border-border bg-surface shadow-lg",
        )}
      >
        <header className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="m-0 text-lg">{title}</h2>
          <Button type="button" variant="ghost" onClick={onClose}>
            Close
          </Button>
        </header>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer ? (
          <footer className="border-t border-border px-5 py-4">{footer}</footer>
        ) : null}
      </aside>
    </>
  );
}
