import { signInWithCustomToken } from "firebase/auth";

import { auth } from "../firebase";

const HANDOFF_PARAM = "auth_handoff";

/** Read and strip a one-time handoff token from the URL hash (admin → public SSO). */
export function consumeHandoffToken(): string | null {
  const hash = window.location.hash.replace(/^#/, "");
  if (!hash) return null;
  const params = new URLSearchParams(hash);
  const token = params.get(HANDOFF_PARAM);
  if (!token) return null;

  params.delete(HANDOFF_PARAM);
  const remaining = params.toString();
  const next = remaining
    ? `${window.location.pathname}${window.location.search}#${remaining}`
    : `${window.location.pathname}${window.location.search}`;
  window.history.replaceState(null, "", next);
  return token;
}

export async function signInFromHandoffToken(token: string): Promise<void> {
  await signInWithCustomToken(auth, token);
}

export function publicAppHandoffUrl(publicAppUrl: string, customToken: string): string {
  const base = publicAppUrl.replace(/\/$/, "");
  return `${base}/#${HANDOFF_PARAM}=${encodeURIComponent(customToken)}`;
}
