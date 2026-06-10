import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
} from "firebase/auth";
import type { MultiFactorResolver, User } from "firebase/auth";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { ReactNode } from "react";

import { auth } from "../firebase";
import { authErrorMessage } from "./errors";
import {
  completeTotpSignIn,
  finishTotpEnrollment,
  getTotpResolver,
  startTotpEnrollment,
  totpHint,
  userHasTotpMfa,
} from "./mfa";
import type { TotpEnrollment } from "./mfa";

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  idToken: string | null;
  role: string | null;
  isAdmin: boolean;
  mfaResolver: MultiFactorResolver | null;
  hasTotpMfa: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  completeMfa: (code: string) => Promise<void>;
  cancelMfa: () => void;
  beginTotpEnrollment: () => Promise<TotpEnrollment>;
  confirmTotpEnrollment: (
    enrollment: TotpEnrollment,
    code: string,
  ) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  refreshClaims: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

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
  const [loading, setLoading] = useState(true);
  const [mfaResolver, setMfaResolver] = useState<MultiFactorResolver | null>(
    null,
  );

  const syncUser = useCallback(async (next: User | null, forceRefresh = false) => {
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
    return onAuthStateChanged(auth, async (next) => {
      await syncUser(next);
      setLoading(false);
    });
  }, [syncUser]);

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
        await runSignIn(async () => {
          const provider = new GoogleAuthProvider();
          provider.setCustomParameters({ prompt: "select_account" });
          try {
            await signInWithPopup(auth, provider);
          } catch (err) {
            await afterCredential(err);
          }
        });
      },
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
    [user, loading, idToken, role, mfaResolver, syncUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

export { authErrorMessage };
