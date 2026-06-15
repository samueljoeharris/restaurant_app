import { useState } from "react";
import type { FormEvent } from "react";

import { useAuth } from "../auth/useAuth";
import { authErrorMessage } from "../auth/errors";
import { Button } from "./ui/Button";
import { Card } from "./ui/Card";

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
    <Card title="Two-factor authentication" subtitle="Enter your 6-digit code">
      <form className="stack" onSubmit={handleSubmit}>
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
          <Button type="submit" disabled={busy || code.length < 6}>
            {busy ? "…" : "Verify"}
          </Button>
          <Button type="button" variant="ghost" onClick={() => cancelMfa()}>
            Cancel
          </Button>
        </div>
      </form>
    </Card>
  );
}
