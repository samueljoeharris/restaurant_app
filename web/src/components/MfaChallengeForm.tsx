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
      <form className="grid gap-3" onSubmit={handleSubmit}>
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
        {error && <p className="text-sm font-semibold text-error">{error}</p>}
        <div className="flex items-center gap-4">
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
