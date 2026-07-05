import { type FormEvent, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { api } from "../api/client";
import { useBodyScrollLock } from "../hooks/useBodyScrollLock";
import { useDialogFocus } from "../hooks/useDialogFocus";
import { useRegisterBlockingModal } from "../hooks/useModalPresence";
import { Z } from "../lib/overlayStack";
import { userStorage } from "../lib/userStorage";
import { Button } from "./ui/Button";
import { Card } from "./ui/Card";
import { FormField } from "./ui/FormField";
import { ScoutMascot } from "./ScoutMascot";

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
  const dialogRef = useRef<HTMLDivElement>(null);

  useBodyScrollLock(open);
  // Onboarding is a required step (no dismiss path), so trap focus but omit Escape.
  useDialogFocus(open, dialogRef);
  // Keep lower-priority surfaces (ActivityToast) quiet while onboarding is up.
  useRegisterBlockingModal(open);

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

  return createPortal(
    <div
      ref={dialogRef}
      className="fixed inset-0 grid place-items-center overflow-y-auto bg-black/40 p-4"
      style={{ zIndex: Z.modal }}
      role="dialog"
      aria-modal="true"
      aria-label="Tell us about your kids"
    >
      <Card title="Tell us about your kids" subtitle="We'll personalize speed tips for your family">
        <div className="mb-4 flex justify-center">
          <ScoutMascot className="h-28 w-28 object-contain" size={112} />
        </div>
        <form className="grid gap-4" onSubmit={handleSubmit}>
          <FormField label="Kids' ages (comma-separated)">
            <input
              type="text"
              value={agesInput}
              onChange={(e) => setAgesInput(e.target.value)}
              placeholder="e.g. 2, 5"
              required
            />
          </FormField>
          {error && <p className="text-sm font-semibold text-error">{error}</p>}
          <Button type="submit" disabled={busy} fullWidth>
            {busy ? "Saving…" : "Continue"}
          </Button>
        </form>
      </Card>
    </div>,
    document.body,
  );
}
