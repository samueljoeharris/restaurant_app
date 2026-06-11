/** Exchange IAP session (same-origin) for a Firebase custom token on admin.dev. */

export type IapSessionResult =
  | { ok: true }
  | { ok: false; reason: "denied" | "unavailable" };

export async function bootstrapFirebaseFromIapSession(): Promise<IapSessionResult> {
  try {
    const response = await fetch("/auth/firebase-session", {
      credentials: "same-origin",
    });

    if (response.status === 403) {
      return { ok: false, reason: "denied" };
    }

    if (!response.ok) {
      return { ok: false, reason: "unavailable" };
    }

    const data = (await response.json()) as { custom_token?: string };
    if (!data.custom_token) {
      return { ok: false, reason: "unavailable" };
    }

    const { signInWithCustomToken } = await import("firebase/auth");
    const { auth } = await import("../firebase");
    await signInWithCustomToken(auth, data.custom_token);
    return { ok: true };
  } catch {
    return { ok: false, reason: "unavailable" };
  }
}
