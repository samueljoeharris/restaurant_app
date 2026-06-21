import { useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { Navigate } from "react-router-dom";

import { useAuth } from "../auth/useAuth";
import { authErrorMessage } from "../auth/errors";
import { defaultAuthedPath, isAdminSite, PUBLIC_APP_URL } from "../buildTarget";
import { MfaChallengeForm } from "../components/MfaChallengeForm";
import { ScoutLogo } from "../components/ScoutLogo";
import { ScoutMascot } from "../components/ScoutMascot";
import { Button, ButtonAnchor } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Skeleton } from "../components/ui/Skeleton";
import { cn } from "../lib/cn";

function AuthShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen min-w-0 flex-col justify-center bg-bg p-4 md:min-w-[var(--desktop-min-width)] md:p-8">
      <main
        className={cn(
          "mx-auto w-full max-w-[var(--page-narrow)] px-4 py-6 animate-page-enter md:px-8",
        )}
      >
        {children}
      </main>
    </div>
  );
}

function AuthHero({ children }: { children: ReactNode }) {
  return <div className="mb-6 text-center">{children}</div>;
}

function AuthHeroTitle({
  admin,
  children,
}: {
  admin?: boolean;
  children: ReactNode;
}) {
  return (
    <h1
      className={cn(
        "tracking-tighter",
        admin ? "text-2xl" : "text-[2.125rem]",
      )}
    >
      {children}
    </h1>
  );
}

export function LoginPage() {
  const {
    user,
    loading,
    isAdmin,
    iapAccessDenied,
    mfaResolver,
    redirectError,
    clearRedirectError,
    signIn,
    signUp,
    signInWithGoogle,
  } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const admin = isAdminSite;

  if (loading) {
    return (
      <AuthShell>
        <AuthHero>
          <div className="mb-3 flex justify-center">
            <ScoutLogo size={56} />
          </div>
          <Skeleton className="mx-auto h-4 w-[55%]" />
          <Skeleton className="mx-auto mt-2 h-3 w-[85%]" />
        </AuthHero>
      </AuthShell>
    );
  }

  if (user) {
    if (isAdminSite) {
      return <Navigate to={isAdmin ? "/admin" : "/access-denied"} replace />;
    }
    return <Navigate to={defaultAuthedPath} replace />;
  }

  if (isAdminSite && !import.meta.env.DEV) {
    return <Navigate to="/" replace />;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (mode === "signin") {
        await signIn(email, password);
      } else {
        await signUp(email, password);
      }
    } catch (err) {
      setError(authErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleGoogle() {
    setError(null);
    clearRedirectError();
    setBusy(true);
    try {
      await signInWithGoogle();
    } catch (err) {
      setError(authErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  if (mfaResolver) {
    return (
      <AuthShell>
        <AuthHero>
          <div className="mb-3 flex justify-center">
            <ScoutLogo size={56} />
          </div>
          {isAdminSite && (
            <p className="mb-2 inline-block rounded-full bg-accent-soft px-2 py-1 text-xs font-semibold uppercase tracking-widest text-accent">
              Operator console
            </p>
          )}
          <AuthHeroTitle admin={admin}>Verify it&apos;s you</AuthHeroTitle>
        </AuthHero>
        <MfaChallengeForm />
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      <AuthHero>
        {!isAdminSite ? (
          <div className="mb-3 flex justify-center">
            <ScoutMascot className="h-36 w-36 object-contain sm:h-40 sm:w-40" size={160} />
          </div>
        ) : (
          <div className="mb-3 flex justify-center">
            <ScoutLogo size={56} />
          </div>
        )}
        {isAdminSite ? (
          <>
            <p className="mb-2 inline-block rounded-full bg-accent-soft px-2 py-1 text-xs font-semibold uppercase tracking-widest text-accent">
              Operator console
            </p>
            <AuthHeroTitle admin={admin}>Local dev sign-in</AuthHeroTitle>
            <p className="text-text-muted">
              Production admin uses IAP SSO automatically. Use email/password here only when
              running the admin build locally without IAP.
            </p>
          </>
        ) : (
          <>
            <AuthHeroTitle admin={admin}>Little Scout</AuthHeroTitle>
            <p className="text-text-muted">Rate kid-food speed with other parents.</p>
          </>
        )}
      </AuthHero>

      <Card>
        {!isAdminSite && (
          <>
            <Button variant="secondary" fullWidth onClick={handleGoogle} disabled={busy}>
              Continue with Google
            </Button>

            <div className="flex items-center gap-3 text-sm text-text-muted">
              <span className="h-px flex-1 bg-border" aria-hidden />
              <span>or email</span>
              <span className="h-px flex-1 bg-border" aria-hidden />
            </div>
          </>
        )}

        <form className="grid gap-4" onSubmit={handleSubmit}>
          <label>
            Email
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </label>
          <label>
            Password
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              autoComplete={
                mode === "signin" ? "current-password" : "new-password"
              }
            />
          </label>
          {(error || redirectError) && (
            <p className="text-sm font-semibold text-error">{error ?? redirectError}</p>
          )}
          <Button type="submit" fullWidth disabled={busy}>
            {busy ? "…" : mode === "signin" ? "Sign in" : "Create account"}
          </Button>
          {!isAdminSite && (
            <button
              type="button"
              className="cursor-pointer border-0 bg-transparent p-0 text-left font-[inherit] text-sm font-semibold text-brand"
              onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
            >
              {mode === "signin"
                ? "Need an account? Sign up"
                : "Have an account? Sign in"}
            </button>
          )}
        </form>

        {isAdminSite && (
          <>
            {iapAccessDenied && (
              <p className="text-sm text-text-muted">
                You don&apos;t have permission to use the operator console.
              </p>
            )}
            <ButtonAnchor href={PUBLIC_APP_URL} variant="ghost" fullWidth>
              ← Back to public app
            </ButtonAnchor>
          </>
        )}
      </Card>
      <p className="mt-4 text-center text-sm text-text-muted">
        <a className="font-semibold text-brand" href="/privacy">
          Privacy Policy
        </a>
      </p>
    </AuthShell>
  );
}
