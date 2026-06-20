import { useCallback, useEffect, useState } from "react";

export type ThemeMode = "system" | "light" | "dark";

const STORAGE_KEY = "ls-theme";

function getSystemDark(): boolean {
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function resolveDark(mode: ThemeMode): boolean {
  if (mode === "dark") return true;
  if (mode === "light") return false;
  return getSystemDark();
}

function applyTheme(mode: ThemeMode) {
  document.documentElement.classList.toggle("dark", resolveDark(mode));
}

export function initThemeFromStorage() {
  const stored = localStorage.getItem(STORAGE_KEY) as ThemeMode | null;
  const mode: ThemeMode =
    stored === "light" || stored === "dark" || stored === "system" ? stored : "system";
  applyTheme(mode);
  return mode;
}

export function useTheme() {
  const [mode, setModeState] = useState<ThemeMode>(() => {
    if (typeof window === "undefined") return "system";
    const stored = localStorage.getItem(STORAGE_KEY) as ThemeMode | null;
    return stored === "light" || stored === "dark" || stored === "system" ? stored : "system";
  });

  const setMode = useCallback((next: ThemeMode) => {
    if (next === "system") {
      localStorage.removeItem(STORAGE_KEY);
    } else {
      localStorage.setItem(STORAGE_KEY, next);
    }
    setModeState(next);
    applyTheme(next);
  }, []);

  useEffect(() => {
    applyTheme(mode);
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      if (mode === "system") applyTheme("system");
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [mode]);

  const resolved: "light" | "dark" = resolveDark(mode) ? "dark" : "light";

  return { mode, setMode, resolved };
}
