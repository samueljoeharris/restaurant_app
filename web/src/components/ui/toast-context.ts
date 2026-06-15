import { createContext } from "react";

export type ToastTone = "default" | "success" | "error";

export type ToastContextValue = {
  toast: (message: string, tone?: ToastTone) => void;
};

export const ToastContext = createContext<ToastContextValue | null>(null);
