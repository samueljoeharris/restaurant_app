import type { FirebaseError } from "firebase/app";

const MESSAGES: Record<string, string> = {
  "auth/email-already-in-use": "That email is already registered. Try signing in.",
  "auth/invalid-email": "Enter a valid email address.",
  "auth/invalid-credential": "Incorrect email or password.",
  "auth/user-disabled": "This account has been disabled.",
  "auth/user-not-found": "No account found for that email.",
  "auth/wrong-password": "Incorrect password.",
  "auth/weak-password": "Use a password with at least 6 characters.",
  "auth/popup-closed-by-user": "Sign-in popup was closed before completing.",
  "auth/popup-blocked": "Allow popups for this site to sign in with Google.",
  "auth/account-exists-with-different-credential":
    "An account already exists with the same email using a different sign-in method.",
  "auth/multi-factor-auth-required": "Enter your authenticator code to finish signing in.",
  "auth/invalid-verification-code": "That code did not work. Try again.",
  "auth/unverified-email": "Verify your email before signing in.",
};

export function authErrorMessage(err: unknown): string {
  if (err && typeof err === "object" && "code" in err) {
    const code = (err as FirebaseError).code;
    if (code && MESSAGES[code]) return MESSAGES[code];
    if ("message" in err && typeof err.message === "string") return err.message;
  }
  if (err instanceof Error) return err.message;
  return "Something went wrong. Try again.";
}
