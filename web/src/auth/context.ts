import type { MultiFactorResolver, User } from "firebase/auth";
import { createContext } from "react";

import type { TotpEnrollment } from "./mfa";

export interface AuthContextValue {
  user: User | null;
  loading: boolean;
  iapAccessDenied: boolean;
  idToken: string | null;
  role: string | null;
  isAdmin: boolean;
  mfaResolver: MultiFactorResolver | null;
  hasTotpMfa: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  redirectError: string | null;
  clearRedirectError: () => void;
  completeMfa: (code: string) => Promise<void>;
  cancelMfa: () => void;
  beginTotpEnrollment: () => Promise<TotpEnrollment>;
  confirmTotpEnrollment: (
    enrollment: TotpEnrollment,
    code: string,
  ) => Promise<void>;
  removeTotpMfa: () => Promise<void>;
  reauthenticate: (options: {
    password?: string;
    google?: boolean;
  }) => Promise<"ok" | "mfa-required">;
  reauthMfaResolver: MultiFactorResolver | null;
  completeReauthMfa: (code: string) => Promise<void>;
  cancelReauthMfa: () => void;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  refreshClaims: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);
