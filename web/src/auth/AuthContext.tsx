import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  getRedirectResult,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  signOut,
} from "firebase/auth";
import type { MultiFactorResolver, User } from "firebase/auth";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { ReactNode } from "react";

import { auth } from "../firebase";
import { isAdminSite } from "../buildTarget";
import { syncProfileIdentity } from "../lib/pageDataCache";
import { AuthContext, type AuthContextValue } from "./context";
import { consumeHandoffToken, signInFromHandoffToken } from "./handoff";
import { bootstrapFirebaseFromIapSession } from "./iapSession";
import { authErrorMessage } from "./errors";
import {
  completeTotpSignIn,
  finishTotpEnrollment,
  getTotpResolver,
  isMfaResolverError,
  reauthenticateUser,
  startTotpEnrollment,
  totpHint,
  unenrollTotp,
  userHasTotpMfa,
} from "./mfa";

const GOOGLE_REDIRECT_PENDING_KEY = "ttf:googleRedirectPending";
function shouldUseGooglePopup(): boolean {
  return import.meta.env.VITE_GOOGLE_AUTH_USE_POPUP === "true";
}

function googleSignInConfigHint(): string {
  const domain =
    import.meta.env.VITE_FIREBASE_AUTH_DOMAIN?.trim() || window.location.hostname;
  return `https://${domain}/__/auth/handler`;
}

async function afterCredential(authError: unknown): Promise<void> {
  const resolver = getTotpResolver(auth, authError);
  if (resolver) {
    throw { mfaResolver: resolver };
  }
  throw authError;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [idToken, setIdToken] = useState<string | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [iapBootstrapDone, setIapBootstrapDone] = useState(!isAdminSite);
  const [iapAccessDenied, setIapAccessDenied] = useState(false);
  const [mfaResolver, setMfaResolver] = useState<MultiFactorResolver | null>(
    null,
  );
  const [reauthMfaResolver, setReauthMfaResolver] =
    useState<MultiFactorResolver | null>(null);
  const [redirectError, setRedirectError] = useState<string | null>(null);
  const redirectCheckedRef = useRef(false);
  const [redirectReady, setRedirectReady] = useState(isAdminSite);
  const [authListenerReady, setAuthListenerReady] = useState(false);

  const syncUser = useCallback(async (next: User | null, forceRefresh = false) => {
    // Shared profile:me cache (#136): drop it the moment the signed-in
    // identity changes (logout or a different uid), regardless of which page
    // is mounted. Token refresh keeps the same uid and is a no-op here.
    syncProfileIdentity(next?.uid ?? null);
    setUser(next);
    if (next) {
      const tokenResult = await next.getIdTokenResult(forceRefresh);
      setIdToken(tokenResult.token);
      const claimRole = tokenResult.claims.role;
      setRole(typeof claimRole === "string" ? claimRole : null);
    } else {
      setIdToken(null);
      setRole(null);
    }
  }, []);

  useEffect(() => {
    if (isAdminSite) return;

    let cancelled = false;
    let unsubscribe = () => {};

    (async () => {
      if (!auth.currentUser) {
        // One-time admin → public SSO handoff token in the URL hash.
        const handoffToken = consumeHandoffToken();
        if (handoffToken) {
          try {
            await signInFromHandoffToken(handoffToken);
          } catch (err) {
            console.error("Auth handoff from admin failed", err);
          }
        }
      }
      if (cancelled) return;

      if (!redirectCheckedRef.current) {
        redirectCheckedRef.current = true;
        try {
          const result = await getRedirectResult(auth);
          if (cancelled) return;
          if (result?.user) {
            sessionStorage.removeItem(GOOGLE_REDIRECT_PENDING_KEY);
            setRedirectError(null);
            await syncUser(result.user);
          } else if (sessionStorage.getItem(GOOGLE_REDIRECT_PENDING_KEY)) {
            sessionStorage.removeItem(GOOGLE_REDIRECT_PENDING_KEY);
            setRedirectError(
              "Google sign-in did not complete after redirect. Click Continue with Google again.",
            );
          }
        } catch (err) {
          if (cancelled) return;
          const resolver = getTotpResolver(auth, err);
          if (resolver) {
            setRedirectError(null);
            setMfaResolver(resolver);
          } else {
            console.error("Firebase redirect sign-in failed", err);
            setRedirectError(authErrorMessage(err));
          }
        }
      }

      if (cancelled) return;
      setRedirectReady(true);

      unsubscribe = onAuthStateChanged(auth, async (next) => {
        if (cancelled) return;
        await syncUser(next);
        setAuthListenerReady(true);
      });
    })();

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [syncUser]);

  useEffect(() => {
    if (!isAdminSite) return;

    let cancelled = false;

    (async () => {
      if (auth.currentUser) {
        // Reuse persisted session (local dev) — refresh so new custom claims apply.
        await syncUser(auth.currentUser, true);
        if (!cancelled) setIapBootstrapDone(true);
        return;
      }

      const result = await bootstrapFirebaseFromIapSession();
      if (cancelled) return;

      if (result.ok === false && result.reason === "denied") {
        setIapAccessDenied(true);
      }
      setIapBootstrapDone(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [syncUser]);

  useEffect(() => {
    if (!isAdminSite) return;
    return onAuthStateChanged(auth, async (next) => {
      await syncUser(next, isAdminSite);
      setAuthListenerReady(true);
    });
  }, [syncUser]);

  const loading = !(redirectReady && authListenerReady && iapBootstrapDone);

  const runSignIn = async (fn: () => Promise<void>) => {
    setMfaResolver(null);
    try {
      await fn();
    } catch (err) {
      if (err && typeof err === "object" && "mfaResolver" in err) {
        setMfaResolver((err as { mfaResolver: MultiFactorResolver }).mfaResolver);
        return;
      }
      throw err;
    }
  };

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      iapAccessDenied,
      idToken,
      role,
      isAdmin: role === "admin",
      mfaResolver,
      hasTotpMfa: user ? userHasTotpMfa(user) : false,
      signIn: async (email, password) => {
        await runSignIn(async () => {
          try {
            await signInWithEmailAndPassword(auth, email, password);
          } catch (err) {
            await afterCredential(err);
          }
        });
      },
      signUp: async (email, password) => {
        await runSignIn(async () => {
          try {
            await createUserWithEmailAndPassword(auth, email, password);
          } catch (err) {
            await afterCredential(err);
          }
        });
      },
      signInWithGoogle: async () => {
        if (isAdminSite) {
          throw new Error("Google sign-in is disabled on the admin site. Use IAP SSO.");
        }
        setRedirectError(null);
        await runSignIn(async () => {
          const provider = new GoogleAuthProvider();
          provider.setCustomParameters({ prompt: "select_account" });
          try {
            if (shouldUseGooglePopup()) {
              const cred = await signInWithPopup(auth, provider);
              await syncUser(cred.user);
              return;
            }
            sessionStorage.setItem(GOOGLE_REDIRECT_PENDING_KEY, "1");
            await signInWithRedirect(auth, provider);
          } catch (err) {
            sessionStorage.removeItem(GOOGLE_REDIRECT_PENDING_KEY);
            if (err && typeof err === "object" && "code" in err) {
              const code = (err as { code: string }).code;
              const message =
                err instanceof Error
                  ? err.message
                  : "message" in err && typeof err.message === "string"
                    ? err.message
                    : "";
              if (
                code === "auth/invalid-credential" &&
                message.includes("client secret is invalid")
              ) {
                throw err;
              }
              if (
                code === "auth/invalid-credential" ||
                code === "auth/internal-error"
              ) {
                throw new Error(
                  `Google sign-in failed. In GCP Credentials → OAuth Web client, add authorized redirect URI: ${googleSignInConfigHint()}`,
                  { cause: err },
                );
              }
            }
            await afterCredential(err);
          }
        });
      },
      redirectError,
      clearRedirectError: () => setRedirectError(null),
      completeMfa: async (code) => {
        if (!mfaResolver) throw new Error("No MFA challenge in progress");
        const hint = totpHint(mfaResolver);
        if (!hint) throw new Error("No supported MFA method found");
        await completeTotpSignIn(mfaResolver, hint, code);
        setMfaResolver(null);
      },
      cancelMfa: () => setMfaResolver(null),
      beginTotpEnrollment: async () => {
        if (!auth.currentUser) throw new Error("Sign in first");
        return startTotpEnrollment(auth.currentUser);
      },
      confirmTotpEnrollment: async (enrollment, code) => {
        if (!auth.currentUser) throw new Error("Sign in first");
        await finishTotpEnrollment(auth.currentUser, enrollment.secret, code);
        await auth.currentUser.reload();
        await syncUser(auth.currentUser);
      },
      removeTotpMfa: async () => {
        if (!auth.currentUser) throw new Error("Sign in first");
        await unenrollTotp(auth.currentUser);
        await auth.currentUser.reload();
        await syncUser(auth.currentUser);
      },
      reauthenticate: async (options) => {
        if (!auth.currentUser) throw new Error("Sign in first");
        setReauthMfaResolver(null);
        try {
          await reauthenticateUser(auth, auth.currentUser, options);
          return "ok";
        } catch (err) {
          if (isMfaResolverError(err)) {
            setReauthMfaResolver(err.mfaResolver);
            return "mfa-required";
          }
          throw err;
        }
      },
      reauthMfaResolver,
      completeReauthMfa: async (code) => {
        if (!reauthMfaResolver) throw new Error("No re-auth MFA challenge");
        const hint = totpHint(reauthMfaResolver);
        if (!hint) throw new Error("No supported MFA method found");
        await completeTotpSignIn(reauthMfaResolver, hint, code);
        setReauthMfaResolver(null);
      },
      cancelReauthMfa: () => setReauthMfaResolver(null),
      logout: () => signOut(auth),
      refreshUser: async () => {
        if (auth.currentUser) {
          await auth.currentUser.reload();
          await syncUser(auth.currentUser, true);
        }
      },
      refreshClaims: async () => {
        if (auth.currentUser) {
          await syncUser(auth.currentUser, true);
        }
      },
    }),
    [
      user,
      loading,
      iapAccessDenied,
      idToken,
      role,
      mfaResolver,
      reauthMfaResolver,
      redirectError,
      syncUser,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
