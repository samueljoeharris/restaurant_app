import { useEffect, useState } from "react";
import type { FormEvent as FormEventType } from "react";

import { Link } from "react-router-dom";

import { useAuth, authErrorMessage } from "../auth/AuthContext";
import type { TotpEnrollment } from "../auth/mfa";
import { api } from "../api/client";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Page } from "../components/ui/Page";
import { Stat, StatGrid } from "../components/ui/Stat";
import { useToast } from "../components/ui/Toast";

export function AccountPage() {
  const {
    user,
    idToken,
    isAdmin,
    hasTotpMfa,
    refreshClaims,
    beginTotpEnrollment,
    confirmTotpEnrollment,
    refreshUser,
    logout,
  } = useAuth();
  const { toast } = useToast();
  const [profile, setProfile] = useState<{
    contribution_count: number;
    role?: string | null;
  } | null>(null);
  const [enrollment, setEnrollment] = useState<TotpEnrollment | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!idToken) return;
    api.getMe(idToken).then(setProfile).catch(() => {});
  }, [idToken]);

  if (!user) return null;

  const providers = user.providerData.map((p) => p.providerId).join(", ");

  async function handleStartMfa() {
    setError(null);
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
      toast("Authenticator linked — MFA is on.", "success");
      await refreshUser();
    } catch (err) {
      setError(authErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Page title="You" subtitle={user.email ?? "Your Little Scout account"}>
      <Card title="Profile">
        <p>
          <strong>{user.displayName ?? user.email ?? "Signed in"}</strong>
        </p>
        <p className="muted small">Sign-in: {providers || "password"}</p>
        {(isAdmin || profile?.role === "admin") ? (
          <p className="success small">
            Admin access · <Link to="/admin">Open dashboard</Link>
          </p>
        ) : (
          <p className="muted small">
            Just granted admin?{" "}
            <button
              type="button"
              className="link-button"
              onClick={() => refreshClaims().catch(() => {})}
            >
              Refresh permissions
            </button>
          </p>
        )}
        {profile && (
          <StatGrid>
            <Stat
              label="Contributions"
              value={profile.contribution_count}
              highlight
            />
          </StatGrid>
        )}
        <Button variant="ghost" onClick={() => logout()}>
          Sign out
        </Button>
      </Card>

      <Card title="Security" subtitle="Protect your account">
        {hasTotpMfa ? (
          <p className="success">Two-factor authentication is on.</p>
        ) : enrollment ? (
          <form className="stack" onSubmit={handleConfirmMfa}>
            <p className="muted small">
              Scan with Google Authenticator, 1Password, or Authy.
            </p>
            <img
              className="qr"
              src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(enrollment.qrCodeUrl)}`}
              alt="TOTP QR code"
              width={180}
              height={180}
            />
            <p className="muted small">
              Manual key: <code>{enrollment.secret.secretKey}</code>
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
            <Button type="submit" disabled={busy || code.length < 6}>
              {busy ? "…" : "Confirm authenticator"}
            </Button>
          </form>
        ) : (
          <>
            <p className="muted small">
              Add an authenticator app for an extra sign-in step.
            </p>
            {error && <p className="error">{error}</p>}
            <Button onClick={handleStartMfa} disabled={busy}>
              {busy ? "…" : "Set up authenticator"}
            </Button>
          </>
        )}
      </Card>
    </Page>
  );
}
