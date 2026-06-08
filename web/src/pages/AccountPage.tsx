import { useEffect, useState } from "react";
import type { FormEvent as FormEventType } from "react";

import { useAuth, authErrorMessage } from "../auth/AuthContext";
import type { TotpEnrollment } from "../auth/mfa";
import { api } from "../api/client";

export function AccountPage() {
  const {
    user,
    idToken,
    hasTotpMfa,
    beginTotpEnrollment,
    confirmTotpEnrollment,
    refreshUser,
  } = useAuth();
  const [profile, setProfile] = useState<{
    contribution_count: number;
  } | null>(null);
  const [enrollment, setEnrollment] = useState<TotpEnrollment | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!idToken) return;
    api.getMe(idToken).then(setProfile).catch(() => {});
  }, [idToken]);

  if (!user) return null;

  const providers = user.providerData.map((p) => p.providerId).join(", ");

  async function handleStartMfa() {
    setError(null);
    setMessage(null);
    setBusy(true);
    try {
      const next = await beginTotpEnrollment();
      setEnrollment(next);
    } catch (err) {
      setError(authErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleConfirmMfa(e: FormEventType) {
    e.preventDefault();
    if (!enrollment) return;
    setError(null);
    setBusy(true);
    try {
      await confirmTotpEnrollment(enrollment, code.trim());
      setEnrollment(null);
      setCode("");
      setMessage("Authenticator app linked. MFA is on for this account.");
      await refreshUser();
    } catch (err) {
      setError(authErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="page narrow">
      <h1>Account</h1>
      <section className="card">
        <h2>Profile</h2>
        <p>
          <strong>{user.email ?? user.displayName ?? "Signed in"}</strong>
        </p>
        <p className="muted">Providers: {providers || "password"}</p>
        {profile && (
          <p className="muted">Contributions: {profile.contribution_count}</p>
        )}
      </section>

      <section className="card">
        <h2>Security</h2>
        {hasTotpMfa ? (
          <p className="success">
            Two-factor authentication is enabled (authenticator app).
          </p>
        ) : enrollment ? (
          <form onSubmit={handleConfirmMfa}>
            <p className="muted">
              Scan this QR code with Google Authenticator, 1Password, or Authy.
            </p>
            <img
              className="qr"
              src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(enrollment.qrCodeUrl)}`}
              alt="TOTP QR code"
              width={180}
              height={180}
            />
            <p className="muted small">
              Or enter key manually: <code>{enrollment.secret.secretKey}</code>
            </p>
            <label>
              6-digit code
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                required
              />
            </label>
            {error && <p className="error">{error}</p>}
            <button type="submit" disabled={busy || code.length < 6}>
              {busy ? "…" : "Confirm authenticator"}
            </button>
          </form>
        ) : (
          <>
            <p className="muted">
              Add an authenticator app for an extra sign-in step (recommended
              for accounts with Google or email).
            </p>
            {error && <p className="error">{error}</p>}
            <button
              type="button"
              className="button"
              onClick={handleStartMfa}
              disabled={busy}
            >
              {busy ? "…" : "Set up authenticator"}
            </button>
          </>
        )}
        {message && <p className="success">{message}</p>}
      </section>
    </main>
  );
}
