/** True when built as the operator console (admin.<env>.littlescout.app). */
export function isAdminApp(): boolean {
  return import.meta.env.VITE_BUILD_TARGET === "admin";
}

export const PUBLIC_APP_URL =
  import.meta.env.VITE_PUBLIC_APP_URL || "https://app.dev.littlescout.app";
