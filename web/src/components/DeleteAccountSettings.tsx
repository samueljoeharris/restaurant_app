import { useState } from "react";
import type { FormEvent as FormEventType } from "react";
import { useNavigate } from "react-router-dom";

import { api, ApiError } from "../api/client";
import { useAuth } from "../auth/useAuth";
import { authErrorMessage } from "../auth/errors";
import {
  userHasGoogleProvider,
  userHasPasswordProvider,
} from "../auth/mfa";
import { Button } from "./ui/Button";
import { useToast } from "./ui/useToast";

type DeleteStep = "idle" | "confirm" | "reauth" | "reauth-mfa";

export function DeleteAccountSettings() {
  const {
    user,
    idToken,
    reauthenticate,
    reauthMfaResolver,
    completeReauthMfa,
    cancelReauthMfa,
    refreshUser,
    logout,
  } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [step, setStep] = useState<DeleteStep>("idle");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!user) return null;

  const hasPassword = userHasPasswordProvider(user);
  const hasGoogle = userHasGoogleProvider(user);

  function resetFlow() {
    setStep("idle");
    setPassword("");
    setCode("");
    setError(null);
    cancelReauthMfa();
  }

  async function performDelete(token: string) {
    await api.deleteAccount(token);
    await logout();
    toast("Your account has been deleted.", "success");
    navigate("/", { replace: true });
  }

  async function deleteWithFreshToken() {
    if (!user) throw new Error("Sign in first");
    await refreshUser();
    const token = await user.getIdToken(true);
    try {
      await performDelete(token);
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) {
        setStep("reauth");
        setError("Confirm your identity before deleting your account.");
        return;
      }
      throw err;
    }
  }

  async function handleDeleteAfterReauth() {
    setError(null);
    setBusy(true);
    try {
      await deleteWithFreshToken();
    } catch (err) {
      setError(authErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleReauth(e: FormEventType) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const result = await reauthenticate({ password });
      if (result === "mfa-required") {
        setStep("reauth-mfa");
        return;
      }
      await handleDeleteAfterReauth();
    } catch (err) {
      setError(authErrorMessage(err));
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
        setStep("reauth-mfa");
        return;
      }
      await handleDeleteAfterReauth();
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
      await handleDeleteAfterReauth();
    } catch (err) {
      setError(authErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleConfirmDelete() {
    if (!idToken) return;
    setError(null);
    setBusy(true);
    try {
      await deleteWithFreshToken();
    } catch (err) {
      setError(authErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  if (step === "confirm") {
    return (
      <div className="grid gap-3">
        <p className="text-sm text-text-muted">
          This permanently deletes your Little Scout account and all contributions
          (TTF observations, attribute ratings, and notes). Restaurant listings
          stay, but your data is removed from their aggregates.
        </p>
        {error && <p className="text-sm font-semibold text-error">{error}</p>}
        <div className="flex items-center gap-4">
          <Button
            variant="danger"
            onClick={handleConfirmDelete}
            disabled={busy}
          >
            {busy ? "Deleting…" : "Delete my account"}
          </Button>
          <Button type="button" variant="ghost" onClick={resetFlow} disabled={busy}>
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  if (step === "reauth") {
    return (
      <form className="grid gap-3" onSubmit={handleReauth}>
        <p className="text-sm text-text-muted">
          Confirm it is you before we delete your account.
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
          <p className="text-sm font-semibold text-error">
            Sign out and back in, then try deleting your account again.
          </p>
        )}
        {error && <p className="text-sm font-semibold text-error">{error}</p>}
        {hasPassword && (
          <div className="flex items-center gap-4">
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
            <Button type="button" variant="ghost" onClick={resetFlow} disabled={busy}>
              Cancel
            </Button>
          </div>
        )}
      </form>
    );
  }

  if (step === "reauth-mfa" || reauthMfaResolver) {
    return (
      <form className="grid gap-3" onSubmit={handleReauthMfa}>
        <p className="text-sm text-text-muted">
          Enter the code from your authenticator app to continue.
        </p>
        <label>
          Authentication code
          <input
            inputMode="numeric"
            autoComplete="one-time-code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            required
          />
        </label>
        {error && <p className="text-sm font-semibold text-error">{error}</p>}
        <div className="flex items-center gap-4">
          <Button type="submit" disabled={busy || !code.trim()}>
            {busy ? "…" : "Confirm and delete"}
          </Button>
          <Button type="button" variant="ghost" onClick={resetFlow} disabled={busy}>
            Cancel
          </Button>
        </div>
      </form>
    );
  }

  return (
    <div className="grid gap-3">
      <p className="text-sm text-text-muted">
        Permanently remove your account and all contributions. This cannot be
        undone.
      </p>
      <Button variant="danger" onClick={() => setStep("confirm")}>
        Delete account
      </Button>
    </div>
  );
}
