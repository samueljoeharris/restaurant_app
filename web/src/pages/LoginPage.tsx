import { useState } from "react";
import type { FormEvent } from "react";
import { Navigate } from "react-router-dom";

import { useAuth, authErrorMessage } from "../auth/AuthContext";
import { MfaChallengeForm } from "../components/MfaChallengeForm";
import { Button, ButtonAnchor } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { isAdminApp, PUBLIC_APP_URL } from "../lib/appMode";

export function LoginPage() {
  const adminApp = isAdminApp();
  const { user, isAdmin, mfaResolver, signIn, signUp, signInWithGoogle } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (user) {
    if (adminApp) {
      return <Navigate to={isAdmin ? "/admin" : "/access-denied"} replace />;
    }
    return <Navigate to="/restaurants" replace />;
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
      <div className={`auth-page${adminApp ? " auth-page--admin" : ""}`}>
        <main className="page page--narrow page-enter">
          <div className="auth-hero">
            <div className="auth-hero__mark">🔭</div>
            {adminApp && <p className="auth-hero__badge">Operator console</p>}
            <h1 className="auth-hero__title">Verify it&apos;s you</h1>
          </div>
          <MfaChallengeForm />
        </main>
      </div>
    );
  }

  return (
    <div className={`auth-page${adminApp ? " auth-page--admin" : ""}`}>
      <main className="page page--narrow page-enter">
        <div className="auth-hero">
          <div className="auth-hero__mark">🔭</div>
          {adminApp ? (
            <>
              <p className="auth-hero__badge">Operator console</p>
              <h1 className="auth-hero__title">Little Scout Admin</h1>
              <p className="muted">
                Sign in with your operator account to manage restaurants and
                observations.
              </p>
            </>
          ) : (
            <>
              <h1 className="auth-hero__title">Little Scout</h1>
              <p className="muted">Dedham pilot — rate kid-food speed with other parents.</p>
            </>
          )}
        </div>

        <Card>
          <Button variant="secondary" fullWidth onClick={handleGoogle} disabled={busy}>
            Continue with Google
          </Button>

          <div className="divider">
            <span>or email</span>
          </div>

          <form onSubmit={handleSubmit}>
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
            {error && <p className="error">{error}</p>}
            <Button type="submit" fullWidth disabled={busy}>
              {busy ? "…" : mode === "signin" ? "Sign in" : "Create account"}
            </Button>
            {!adminApp && (
              <button
                type="button"
                className="linkish"
                onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
              >
                {mode === "signin"
                  ? "Need an account? Sign up"
                  : "Have an account? Sign in"}
              </button>
            )}
          </form>

          {adminApp && (
            <ButtonAnchor href={PUBLIC_APP_URL} variant="ghost" fullWidth>
              ← Back to public app
            </ButtonAnchor>
          )}
        </Card>
      </main>
    </div>
  );
}
