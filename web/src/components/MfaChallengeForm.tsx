import { useState } from "react";
import type { FormEvent } from "react";

import { useAuth, authErrorMessage } from "../auth/AuthContext";

export function MfaChallengeForm() {
  const { completeMfa, cancelMfa } = useAuth();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await completeMfa(code.trim());
    } catch (err) {
      setError(authErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="card mfa-card" onSubmit={handleSubmit}>
      <h2>Two-factor authentication</h2>
      <p className="muted">
        Open your authenticator app and enter the 6-digit code.
      </p>
      <label>
        Code
        <input
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]{6}"
          maxLength={6}
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
          required
        />
      </label>
      {error && <p className="error">{error}</p>}
      <div className="row">
        <button type="submit" disabled={busy || code.length < 6}>
          {busy ? "…" : "Verify"}
        </button>
        <button type="button" className="linkish" onClick={() => cancelMfa()}>
          Cancel
        </button>
      </div>
    </form>
  );
}
