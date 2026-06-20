import { type FormEvent, useState } from "react";

import { api } from "../api/client";
import { Button } from "./ui/Button";
import { Card } from "./ui/Card";
import { userStorage } from "../lib/userStorage";

interface OnboardingModalProps {
  open: boolean;
  onComplete: () => void;
  idToken: string;
}

export function OnboardingModal({ open, onComplete, idToken }: OnboardingModalProps) {
  const draft = userStorage.getOnboardingDraft();
  const [agesInput, setAgesInput] = useState(
    draft?.kidsAges?.join(", ") ?? "",
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const kidsAges = agesInput
      .split(/[,\s]+/)
      .map((s) => parseInt(s.trim(), 10))
      .filter((n) => !Number.isNaN(n));
    try {
      await api.patchProfile(idToken, {
        kids_ages: kidsAges,
        complete_onboarding: true,
      });
      userStorage.setProfileCache({
        kidsAges,
        homeLabel: null,
        onboardingCompleted: true,
        inboxReadThrough: null,
      });
      userStorage.clearOnboardingDraft();
      onComplete();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save profile");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
      <Card title="Tell us about your kids" subtitle="We'll personalize speed tips for your family">
        <form className="grid gap-4" onSubmit={handleSubmit}>
          <label className="grid gap-2 text-sm">
            Kids&apos; ages (comma-separated)
            <input
              type="text"
              value={agesInput}
              onChange={(e) => setAgesInput(e.target.value)}
              placeholder="e.g. 2, 5"
              required
            />
          </label>
          {error && <p className="text-sm font-semibold text-error">{error}</p>}
          <Button type="submit" disabled={busy} fullWidth>
            {busy ? "Saving…" : "Continue"}
          </Button>
        </form>
      </Card>
    </div>
  );
}
