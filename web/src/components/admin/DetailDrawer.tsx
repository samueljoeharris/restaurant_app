import { useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";

import { useBodyScrollLock } from "../../hooks/useBodyScrollLock";
import { useDialogFocus } from "../../hooks/useDialogFocus";
import { cn } from "../../lib/cn";
import { Z } from "../../lib/overlayStack";
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
  const drawerRef = useRef<HTMLElement>(null);

  useBodyScrollLock(open);
  useDialogFocus(open, drawerRef, onClose);

  if (!open) return null;

  return createPortal(
    <>
      <button
        type="button"
        className="fixed inset-0 cursor-default border-0 bg-black/30"
        style={{ zIndex: Z.modal - 1 }}
        aria-label="Close drawer"
        onClick={onClose}
      />
      <aside
        ref={drawerRef}
        className={cn(
          "fixed top-0 right-0 flex h-full w-[min(100%,28rem)] flex-col",
          "border-l border-border bg-surface shadow-lg",
        )}
        style={{ zIndex: Z.modal }}
        role="dialog"
        aria-modal="true"
        aria-label={title}
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
    </>,
    document.body,
  );
}
