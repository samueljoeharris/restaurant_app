import { useEffect, useState } from "react";

import { authErrorMessage } from "../auth/errors";
import { useAuth } from "../auth/useAuth";
import { ADMIN_APP_URL } from "../buildTarget";
import { AccountStatPill } from "../components/account/AccountStatPill";
import {
  SettingsLinkRow,
  SettingsPanel,
  SettingsToggleRow,
} from "../components/account/SettingsRow";
import { DeleteAccountSettings } from "../components/DeleteAccountSettings";
import { MfaSettings } from "../components/MfaSettings";
import { api } from "../api/client";
import { Button } from "../components/ui/Button";
import { CheckboxField, FormField } from "../components/ui/FormField";
import { Page } from "../components/ui/Page";
import { TagInput } from "../components/ui/TagInput";
import { useToast } from "../components/ui/useToast";
import { useTheme, type ThemeMode } from "../hooks/useTheme";
import { cn } from "../lib/cn";
import {
  ALLERGEN_OPTIONS,
  ATMOSPHERE_OPTIONS,
  DIETARY_RESTRICTION_OPTIONS,
  toggleKey,
  type FamilyProfileOption,
} from "../lib/familyProfile";
import { parseKidsAges, scoutingSubtitle, trailScoutBadge } from "../lib/scoutProfile";
import { userStorage } from "../lib/userStorage";
import type { ExtendedUserProfile, NotificationPreferences } from "../types";

const THEME_OPTIONS: { mode: ThemeMode; label: string }[] = [
  { mode: "system", label: "System" },
  { mode: "light", label: "Light" },
  { mode: "dark", label: "Dark" },
];

const ACTIVITY_ALERTS: { key: keyof Pick<
  NotificationPreferences,
  "alert_new_ttf" | "alert_new_rating" | "alert_new_note" | "alert_every_review"
>; label: string }[] = [
  { key: "alert_new_ttf", label: "a saved spot gets a new speed visit" },
  { key: "alert_new_rating", label: "a saved spot gets a new parent rating" },
  { key: "alert_new_note", label: "a saved spot gets a new note" },
  { key: "alert_every_review", label: "any new review is logged (noisy)" },
];

interface FamilyForm {
  allergies: string[];
  allergyNotes: string;
  dietaryRestrictions: string[];
  cuisineLikes: string[];
  cuisineDislikes: string[];
  atmospherePreferences: string[];
  preferenceNotes: string;
}

const EMPTY_FAMILY_FORM: FamilyForm = {
  allergies: [],
  allergyNotes: "",
  dietaryRestrictions: [],
  cuisineLikes: [],
  cuisineDislikes: [],
  atmospherePreferences: [],
  preferenceNotes: "",
};

/** Build the form state from a profile response (API-normalized values). */
function familyFormFromProfile(p: ExtendedUserProfile): FamilyForm {
  return {
    allergies: p.allergies,
    allergyNotes: p.allergy_notes ?? "",
    dietaryRestrictions: p.dietary_restrictions,
    cuisineLikes: p.cuisine_likes,
    cuisineDislikes: p.cuisine_dislikes,
    atmospherePreferences: p.atmosphere_preferences,
    preferenceNotes: p.preference_notes ?? "",
  };
}

function Eyebrow({ children }: { children: string }) {
  return (
    <p className="mt-1 text-[length:var(--text-label)] font-extrabold uppercase tracking-[var(--text-tracking-label)] text-text-muted">
      {children}
    </p>
  );
}

function CheckboxGroup({
  legend,
  options,
  selected,
  onToggle,
}: {
  legend: string;
  options: FamilyProfileOption[];
  selected: string[];
  onToggle: (key: string) => void;
}) {
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

export function AccountPage() {
  const { user, idToken, isAdmin, logout } = useAuth();
  const { mode, setMode } = useTheme();
  const [profile, setProfile] = useState<ExtendedUserProfile | null>(null);
  const [prefs, setPrefs] = useState<NotificationPreferences | null>(null);
  const [kidsInput, setKidsInput] = useState("");
  const [family, setFamily] = useState<FamilyForm>(EMPTY_FAMILY_FORM);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (!idToken) return;
    api
      .getProfile(idToken)
      .then((p) => {
        setProfile(p);
        setPrefs(p.notification_preferences);
        setKidsInput(p.kids_ages.join(", "));
        setFamily(familyFormFromProfile(p));
        userStorage.setProfileCache({
          kidsAges: p.kids_ages,
          homeLabel: p.home_label,
          onboardingCompleted: p.onboarding_completed,
          inboxReadThrough: p.inbox_read_through,
        });
        userStorage.setPrefsCache({
          cadence: p.notification_preferences.cadence,
          quietHoursStart: p.notification_preferences.quiet_hours_start,
          quietHoursEnd: p.notification_preferences.quiet_hours_end,
          alertNewTtf: p.notification_preferences.alert_new_ttf,
          alertNewRating: p.notification_preferences.alert_new_rating,
          alertNewNote: p.notification_preferences.alert_new_note,
          alertEveryReview: p.notification_preferences.alert_every_review,
          pushEnabled: p.notification_preferences.push_enabled,
        });
      })
      .catch(() => {});
  }, [idToken]);

  async function saveFamilyProfile() {
    if (!idToken) return;
    setSaving(true);
    setSaveError(null);
    const { ages: kidsAges, error: kidsError } = parseKidsAges(kidsInput);
    if (kidsError) {
      setSaveError(kidsError);
      setSaving(false);
      return;
    }
    try {
      const updated = await api.patchProfile(idToken, {
        kids_ages: kidsAges,
        allergies: family.allergies,
        allergy_notes: family.allergyNotes.trim(),
        dietary_restrictions: family.dietaryRestrictions,
        cuisine_likes: family.cuisineLikes,
        cuisine_dislikes: family.cuisineDislikes,
        atmosphere_preferences: family.atmospherePreferences,
        preference_notes: family.preferenceNotes.trim(),
        complete_onboarding: true,
      });
      setProfile(updated);
      setKidsInput(updated.kids_ages.join(", "));
      setFamily(familyFormFromProfile(updated));
      toast("Family profile saved.", "success");
    } catch (err) {
      setSaveError(authErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function savePrefs(patch: Partial<NotificationPreferences>) {
    if (!idToken || !prefs) return;
    const updated = await api.patchNotificationPreferences(idToken, patch);
    setPrefs(updated);
  }

  if (!user) return null;

  const displayName = user.displayName ?? profile?.display_name ?? user.email ?? "Signed in";
  const kidsAges = profile?.kids_ages ?? [];
  const contributions = profile?.contribution_count ?? 0;
  const savedCount = profile?.watch_count ?? 0;
  const badge = trailScoutBadge(contributions);

  return (
    <Page narrow className="grid max-w-[var(--page-narrow)] gap-3.5 pb-6">
      <header className="flex items-center gap-3.5">
        <div
          className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border-2 border-brand/30 bg-brand-soft text-2xl"
          aria-hidden
        >
          🙂
        </div>
        <div className="min-w-0">
          <h1 className="truncate text-[1.1875rem] leading-tight">{displayName}</h1>
          <p className="mt-0.5 text-xs font-semibold text-text-muted">{scoutingSubtitle(kidsAges)}</p>
          {(isAdmin || profile?.role === "admin") && (
            <p className="mt-1 text-xs font-semibold text-success">
              Operator ·{" "}
              <a href={ADMIN_APP_URL} className="text-brand hover:underline">
                Open console
              </a>
            </p>
          )}
        </div>
      </header>

      <div className="flex gap-2.5">
        <AccountStatPill value={contributions} label="visits logged" tone="brand" />
        <AccountStatPill value={savedCount} label="saved spots" tone="accent" />
        <AccountStatPill value={badge.glyph} label={badge.label} tone="pop" />
      </div>

      <Eyebrow>Settings</Eyebrow>

      {prefs && (
        <SettingsPanel
          title="Notifications"
          subtitle="Choose what updates you get and how often"
        >
          <div className="grid gap-5">
            <section className="grid gap-2">
              <h3 className="text-sm font-bold text-text">Activity alerts</h3>
              <p className="text-xs text-text-muted">Let me know when…</p>
              {ACTIVITY_ALERTS.map(({ key, label }) => (
                <SettingsToggleRow
                  key={key}
                  label={label}
                  checked={prefs[key]}
                  onChange={(checked) => void savePrefs({ [key]: checked })}
                />
              ))}
            </section>

            <section className="grid gap-2">
              <h3 className="text-sm font-bold text-text">Delivery</h3>
              <SettingsToggleRow
                label="Push notifications"
                checked={prefs.push_enabled}
                onChange={(checked) => void savePrefs({ push_enabled: checked })}
              />
              <FormField label="Digest cadence" hint="How often we bundle email updates">
                <select
                  value={prefs.cadence}
                  onChange={(e) =>
                    void savePrefs({
                      cadence: e.target.value as NotificationPreferences["cadence"],
                    })
                  }
                >
                  <option value="weekly">Weekly digest</option>
                  <option value="daily">Daily digest</option>
                  <option value="realtime_bundle">Realtime (bundled)</option>
                </select>
              </FormField>
            </section>

            <section className="grid gap-2">
              <h3 className="text-sm font-bold text-text">Quiet hours</h3>
              <p className="text-xs text-text-muted">Pause push notifications during this window.</p>
              <div className="grid grid-cols-2 gap-3">
                <FormField label="Start">
                  <input
                    type="time"
                    value={prefs.quiet_hours_start}
                    onChange={(e) =>
                      void savePrefs({ quiet_hours_start: e.target.value })
                    }
                  />
                </FormField>
                <FormField label="End">
                  <input
                    type="time"
                    value={prefs.quiet_hours_end}
                    onChange={(e) =>
                      void savePrefs({ quiet_hours_end: e.target.value })
                    }
                  />
                </FormField>
              </div>
            </section>
          </div>
        </SettingsPanel>
      )}

      <SettingsLinkRow to="/account/contributions" label="My contributions" />
      <SettingsLinkRow href="/privacy" label="Privacy & data" />

      <SettingsPanel
        title="Family profile"
        subtitle="Personalizes tips and discovery — private to your account"
      >
        <FormField label="Kids' ages (comma-separated)">
          <input
            value={kidsInput}
            onChange={(e) => setKidsInput(e.target.value)}
            placeholder="e.g. 2, 5, 2.5"
          />
        </FormField>

        <CheckboxGroup
          legend="Allergies"
          options={ALLERGEN_OPTIONS}
          selected={family.allergies}
          onToggle={(key) =>
            setFamily((f) => ({ ...f, allergies: toggleKey(f.allergies, key) }))
          }
        />
        <FormField
          label="Other allergies"
          hint="Anything not covered above, e.g. kiwi, strawberries"
        >
          <input
            value={family.allergyNotes}
            onChange={(e) => setFamily((f) => ({ ...f, allergyNotes: e.target.value }))}
            maxLength={500}
            placeholder="e.g. kiwi"
          />
        </FormField>

        <CheckboxGroup
          legend="Dietary restrictions"
          options={DIETARY_RESTRICTION_OPTIONS}
          selected={family.dietaryRestrictions}
          onToggle={(key) =>
            setFamily((f) => ({
              ...f,
              dietaryRestrictions: toggleKey(f.dietaryRestrictions, key),
            }))
          }
        />

        <FormField label="Cuisines we love" hint="Press Enter or comma to add">
          <TagInput
            value={family.cuisineLikes}
            onChange={(cuisineLikes) => setFamily((f) => ({ ...f, cuisineLikes }))}
            placeholder="e.g. pizza, sushi"
          />
        </FormField>
        <FormField label="Cuisines to skip">
          <TagInput
            value={family.cuisineDislikes}
            onChange={(cuisineDislikes) => setFamily((f) => ({ ...f, cuisineDislikes }))}
            placeholder="e.g. seafood"
          />
        </FormField>

        <CheckboxGroup
          legend="Seating & atmosphere"
          options={ATMOSPHERE_OPTIONS}
          selected={family.atmospherePreferences}
          onToggle={(key) =>
            setFamily((f) => ({
              ...f,
              atmospherePreferences: toggleKey(f.atmospherePreferences, key),
            }))
          }
        />
        <FormField label="Anything else">
          <input
            value={family.preferenceNotes}
            onChange={(e) => setFamily((f) => ({ ...f, preferenceNotes: e.target.value }))}
            maxLength={500}
            placeholder="e.g. crayons and paper win every time"
          />
        </FormField>

        {saveError && <p className="text-sm font-semibold text-error">{saveError}</p>}
        <Button disabled={saving} onClick={() => void saveFamilyProfile()}>
          {saving ? "Saving…" : "Save family profile"}
        </Button>
      </SettingsPanel>

      <SettingsPanel title="Appearance" subtitle="Choose how Little Scout looks">
        <div
          className="inline-flex rounded-md border border-border bg-bg p-1"
          role="group"
          aria-label="Theme"
        >
          {THEME_OPTIONS.map(({ mode: option, label }) => (
            <button
              key={option}
              type="button"
              className={cn(
                "rounded-md px-3 py-1.5 text-sm font-semibold transition-colors duration-fast",
                mode === option
                  ? "bg-surface text-text shadow-sm"
                  : "bg-transparent text-text-muted hover:text-text",
              )}
              aria-pressed={mode === option}
              onClick={() => setMode(option)}
            >
              {label}
            </button>
          ))}
        </div>
      </SettingsPanel>

      <SettingsPanel title="Security" subtitle="Protect your account">
        <MfaSettings />
      </SettingsPanel>

      <SettingsPanel title="Delete account" subtitle="Permanent and cannot be undone">
        <DeleteAccountSettings />
      </SettingsPanel>

      <div className="grid gap-2 pt-1">
        <Button variant="ghost" onClick={() => logout()}>
          Sign out
        </Button>
        <p className="text-center text-xs text-text-muted">
          {user.email ?? "Signed in"}
          {user.providerData.length > 0 && (
            <> · {user.providerData.map((p) => p.providerId).join(", ")}</>
          )}
        </p>
      </div>
    </Page>
  );
}
