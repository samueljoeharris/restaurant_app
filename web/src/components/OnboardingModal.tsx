import { useRef, useState, type FormEvent } from "react";
import { createPortal } from "react-dom";

import { api } from "../api/client";
import { useBodyScrollLock } from "../hooks/useBodyScrollLock";
import { useDialogFocus } from "../hooks/useDialogFocus";
import { useRegisterBlockingModal } from "../hooks/useModalPresence";
import { invalidateProfile } from "../lib/pageDataCache";
import {
  ALLERGEN_OPTIONS,
  DIETARY_RESTRICTION_OPTIONS,
  toggleKey,
  type FamilyProfileOption,
} from "../lib/familyProfile";
import { parseKidsAges } from "../lib/scoutProfile";
import { profileToCache, userStorage } from "../lib/userStorage";
import { Z } from "../lib/overlayStack";
import { Button } from "./ui/Button";
import { Card } from "./ui/Card";
import { CheckboxField, FormField } from "./ui/FormField";
import { ScoutMascot } from "./ScoutMascot";

interface OnboardingModalProps {
  open: boolean;
  onComplete: () => void;
  idToken: string;
}

interface CheckboxGroupProps {
  legend: string;
  options: FamilyProfileOption[];
  selected: string[];
  onToggle: (key: string) => void;
}

function CheckboxGroup({ legend, options, selected, onToggle }: CheckboxGroupProps) {
  return (
    <fieldset className="field-group grid gap-2">
      <legend className="mb-2 text-sm font-semibold">{legend}</legend>
      <div className="grid grid-cols-2 gap-x-3 gap-y-2">
        {options.map(({ key, label }) => (
          <CheckboxField
            key={key}
            label={label}
            checked={selected.includes(key)}
            onChange={() => onToggle(key)}
          />
        ))}
      </div>
    </fieldset>
  );
}

export function OnboardingModal({ open, onComplete, idToken }: OnboardingModalProps) {
  const [agesInput, setAgesInput] = useState("");
  const [allergies, setAllergies] = useState<string[]>([]);
  const [allergyNotes, setAllergyNotes] = useState("");
  const [dietaryRestrictions, setDietaryRestrictions] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  useBodyScrollLock(open);
  useDialogFocus(open, dialogRef, handleSkip);
  useRegisterBlockingModal(open);

  if (!open) return null;

  async function saveProfile(opts: {
    kidsAges?: number[];
    allergies?: string[];
    allergyNotes?: string;
    dietaryRestrictions?: string[];
    completeOnboarding: boolean;
  }) {
    setBusy(true);
    setError(null);
    try {
      const body: Parameters<typeof api.patchProfile>[1] = {
        complete_onboarding: opts.completeOnboarding,
      };
      if (opts.kidsAges !== undefined) body.kids_ages = opts.kidsAges;
      if (opts.allergies !== undefined) body.allergies = opts.allergies;
      if (opts.allergyNotes !== undefined) {
        body.allergy_notes = opts.allergyNotes.trim() || null;
      }
      if (opts.dietaryRestrictions !== undefined) {
        body.dietary_restrictions = opts.dietaryRestrictions;
      }
      const updated = await api.patchProfile(idToken, body);
      invalidateProfile();
      userStorage.setProfileCache(profileToCache(updated));
      onComplete();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save profile");
    } finally {
      setBusy(false);
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const { ages: kidsAges, error: parseError } = parseKidsAges(agesInput);
    if (parseError) {
      setError(parseError);
      return;
    }
    await saveProfile({
      kidsAges,
      allergies,
      allergyNotes,
      dietaryRestrictions,
      completeOnboarding: true,
    });
  }

  async function handleSkip() {
    if (busy) return;
    await saveProfile({ completeOnboarding: true });
  }

  return createPortal(
    <div
      ref={dialogRef}
      className="fixed inset-0 grid place-items-center overflow-y-auto bg-black/40 p-4"
      style={{ zIndex: Z.modal }}
      role="dialog"
      aria-modal="true"
      aria-label="What should we avoid?"
    >
      <Card title="What should we avoid?" subtitle="Add your kids' ages, allergies, and dietary restrictions so we can tailor tips.">
        <div className="mb-4 flex justify-center">
          <ScoutMascot className="h-28 w-28 object-contain" size={112} />
        </div>
        <form className="grid gap-4" onSubmit={handleSubmit}>
          <FormField label="Kids' ages (comma-separated)">
            <input
              type="text"
              value={agesInput}
              onChange={(e) => setAgesInput(e.target.value)}
              placeholder="e.g. 2, 5, 2.5"
            />
          </FormField>

          <CheckboxGroup
            legend="Allergies"
            options={ALLERGEN_OPTIONS}
            selected={allergies}
            onToggle={(key) => setAllergies((prev) => toggleKey(prev, key))}
          />

          <FormField label="Other allergies" hint="Anything not covered above, e.g. kiwi">
            <input
              type="text"
              value={allergyNotes}
              onChange={(e) => setAllergyNotes(e.target.value)}
              maxLength={500}
              placeholder="e.g. kiwi"
            />
          </FormField>

          <CheckboxGroup
            legend="Dietary restrictions"
            options={DIETARY_RESTRICTION_OPTIONS}
            selected={dietaryRestrictions}
            onToggle={(key) => setDietaryRestrictions((prev) => toggleKey(prev, key))}
          />

          {error && <p className="text-sm font-semibold text-error">{error}</p>}
          <Button type="submit" disabled={busy} fullWidth>
            {busy ? "Saving…" : "Continue"}
          </Button>
          <Button type="button" variant="ghost" onClick={handleSkip} disabled={busy} fullWidth>
            Skip for now
          </Button>
        </form>
      </Card>
    </div>,
    document.body,
  );
}
