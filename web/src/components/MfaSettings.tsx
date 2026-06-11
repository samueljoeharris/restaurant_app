import { useState } from "react";
import type { FormEvent as FormEventType } from "react";

import { useAuth, authErrorMessage } from "../auth/AuthContext";
import type { TotpEnrollment } from "../auth/mfa";
import {
  isRequiresRecentLogin,
  userHasGoogleProvider,
  userHasPasswordProvider,
} from "../auth/mfa";
import { Button } from "./ui/Button";
import { useToast } from "./ui/Toast";

type UnenrollStep = "idle" | "confirm" | "reauth" | "reauth-mfa";

export function MfaSettings() {
  const {
    user,
    hasTotpMfa,
    beginTotpEnrollment,
    confirmTotpEnrollment,
    removeTotpMfa,
    reauthenticate,
    reauthMfaResolver,
    completeReauthMfa,
    cancelReauthMfa,
    refreshUser,
  } = useAuth();
  const { toast } = useToast();

  const [enrollment, setEnrollment] = useState<TotpEnrollment | null>(null);
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [unenrollStep, setUnenrollStep] = useState<UnenrollStep>("idle");

  if (!user) return null;

  const hasPassword = userHasPasswordProvider(user);
  const hasGoogle = userHasGoogleProvider(user);

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

  async function finishUnenroll() {
    await removeTotpMfa();
    setUnenrollStep("idle");
    setPassword("");
    setCode("");
    cancelReauthMfa();
    toast("Authenticator removed — MFA is off.", "success");
    await refreshUser();
  }

  async function handleRemoveMfa() {
    setError(null);
    setBusy(true);
    try {
      await finishUnenroll();
    } catch (err) {
      if (isRequiresRecentLogin(err)) {
        setUnenrollStep("reauth");
      } else {
        setError(authErrorMessage(err));
        setUnenrollStep("idle");
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleReauth(e: FormEventType) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const result = await reauthenticate({
        password: hasPassword ? password : undefined,
        google: !hasPassword && hasGoogle,
      });
      if (result === "mfa-required") {
        setUnenrollStep("reauth-mfa");
        return;
      }
      await finishUnenroll();
    } catch (err) {
      if (isRequiresRecentLogin(err)) {
        setError(
          "Confirm your identity again, then we can remove the authenticator.",
        );
      } else {
        setError(authErrorMessage(err));
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleReauthWithGoogle() {
    setError(null);
    setBusy(true);
    try {
      const result = await reauthenticate({ google: true });
      if (result === "mfa-required") {
        setUnenrollStep("reauth-mfa");
        return;
      }
      await finishUnenroll();
    } catch (err) {
      setError(authErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleReauthMfa(e: FormEventType) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await completeReauthMfa(code.trim());
      await finishUnenroll();
    } catch (err) {
      setError(authErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  function cancelUnenroll() {
    setUnenrollStep("idle");
    setPassword("");
    setCode("");
    setError(null);
    cancelReauthMfa();
  }

  if (hasTotpMfa) {
    if (unenrollStep === "confirm") {
      return (
        <div className="stack">
          <p className="muted small">
            You will sign in with only your password or Google account. Anyone
            with that access can use your account without a code.
          </p>
          {error && <p className="error">{error}</p>}
          <div className="row">
            <Button onClick={handleRemoveMfa} disabled={busy}>
              {busy ? "…" : "Remove authenticator"}
            </Button>
            <Button type="button" variant="ghost" onClick={cancelUnenroll}>
              Keep MFA on
            </Button>
          </div>
        </div>
      );
    }

    if (unenrollStep === "reauth") {
      return (
        <form className="stack" onSubmit={handleReauth}>
          <p className="muted small">
            Confirm it is you before we remove two-factor authentication.
          </p>
          {hasPassword ? (
            <label>
              Current password
              <input
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </label>
          ) : hasGoogle ? (
            <Button type="button" onClick={handleReauthWithGoogle} disabled={busy}>
              {busy ? "…" : "Confirm with Google"}
            </Button>
          ) : (
            <p className="error">
              Sign out and back in, then try removing MFA again.
            </p>
          )}
          {error && <p className="error">{error}</p>}
          {hasPassword && (
            <div className="row">
              <Button type="submit" disabled={busy || !password}>
                {busy ? "…" : "Confirm identity"}
              </Button>
              {hasGoogle && (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={handleReauthWithGoogle}
                  disabled={busy}
                >
                  Use Google instead
                </Button>
              )}
              <Button type="button" variant="ghost" onClick={cancelUnenroll}>
                Cancel
              </Button>
            </div>
          )}
          {!hasPassword && hasGoogle && (
            <Button type="button" variant="ghost" onClick={cancelUnenroll}>
              Cancel
            </Button>
          )}
        </form>
      );
    }

    if (unenrollStep === "reauth-mfa" || reauthMfaResolver) {
      return (
        <form className="stack" onSubmit={handleReauthMfa}>
          <p className="muted small">
            Enter your authenticator code to confirm your identity.
          </p>
          <label>
            6-digit code
            <input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              required
            />
          </label>
          {error && <p className="error">{error}</p>}
          <div className="row">
            <Button type="submit" disabled={busy || code.length < 6}>
              {busy ? "…" : "Verify and remove MFA"}
            </Button>
            <Button type="button" variant="ghost" onClick={cancelUnenroll}>
              Cancel
            </Button>
          </div>
        </form>
      );
    }

    return (
      <div className="stack">
        <p className="success">Two-factor authentication is on.</p>
        <p className="muted small">
          Authenticator app (TOTP) is linked to this account.
        </p>
        {error && <p className="error">{error}</p>}
        <Button
          variant="ghost"
          onClick={() => {
            setError(null);
            setUnenrollStep("confirm");
          }}
        >
          Remove authenticator
        </Button>
      </div>
    );
  }

  if (enrollment) {
    return (
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
        <div className="row">
          <Button type="submit" disabled={busy || code.length < 6}>
            {busy ? "…" : "Confirm authenticator"}
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              setEnrollment(null);
              setCode("");
              setError(null);
            }}
          >
            Cancel
          </Button>
        </div>
      </form>
    );
  }

  return (
    <>
      <p className="muted small">
        Add an authenticator app for an extra sign-in step.
      </p>
      {error && <p className="error">{error}</p>}
      <Button onClick={handleStartMfa} disabled={busy}>
        {busy ? "…" : "Set up authenticator"}
      </Button>
    </>
  );
}
