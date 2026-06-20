import {
  useCallback,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { cn } from "../../lib/cn";
import { ToastContext, type ToastTone } from "./toast-context";

type ToastItem = {
  id: number;
  message: string;
  tone: ToastTone;
};

const toneClasses: Record<ToastTone, string> = {
  default: "bg-text text-text-inverse",
  success: "bg-success text-text-inverse",
  error: "bg-error text-text-inverse",
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const toast = useCallback((message: string, tone: ToastTone = "default") => {
    const id = Date.now() + Math.random();
    setItems((prev) => [...prev, { id, message, tone }]);
    window.setTimeout(() => {
      setItems((prev) => prev.filter((t) => t.id !== id));
    }, 3200);
  }, []);

  const value = useMemo(() => ({ toast }), [toast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className="pointer-events-none fixed bottom-5 left-1/2 z-50 grid w-[min(22rem,calc(100vw-2rem))] -translate-x-1/2 gap-2"
        aria-live="polite"
      >
        {items.map((item) => (
          <div
            key={item.id}
            className={cn(
              "rounded-md px-4 py-3 text-center text-sm font-semibold shadow-lg animate-toast-in",
              toneClasses[item.tone],
            )}
          >
            {item.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
