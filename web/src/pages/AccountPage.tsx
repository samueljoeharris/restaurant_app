import { useEffect, useState } from "react";

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
import { FormField } from "../components/ui/FormField";
import { Page } from "../components/ui/Page";
import { useTheme, type ThemeMode } from "../hooks/useTheme";
import { cn } from "../lib/cn";
import { scoutingSubtitle, trailScoutBadge } from "../lib/scoutProfile";
import { userStorage } from "../lib/userStorage";
import type { ExtendedUserProfile, NotificationPreferences } from "../types";

const THEME_OPTIONS: { mode: ThemeMode; label: string }[] = [
  { mode: "system", label: "System" },
  { mode: "light", label: "Light" },
  { mode: "dark", label: "Dark" },
];

const ALERT_TOGGLES: { key: keyof Pick<
  NotificationPreferences,
  "alert_new_ttf" | "alert_new_rating" | "alert_new_note" | "alert_every_review" | "push_enabled"
>; label: string }[] = [
  { key: "alert_new_ttf", label: "New speed visits" },
  { key: "alert_new_rating", label: "New parent ratings" },
  { key: "alert_new_note", label: "New notes" },
  { key: "alert_every_review", label: "Every new review (noisy)" },
  { key: "push_enabled", label: "Push notifications" },
];

function Eyebrow({ children }: { children: string }) {
  return (
    <p className="mt-1 text-[length:var(--text-label)] font-extrabold uppercase tracking-[var(--text-tracking-label)] text-text-muted">
      {children}
    </p>
  );
}

export function AccountPage() {
  const { user, idToken, isAdmin, logout } = useAuth();
  const { mode, setMode } = useTheme();
  const [profile, setProfile] = useState<ExtendedUserProfile | null>(null);
  const [prefs, setPrefs] = useState<NotificationPreferences | null>(null);
  const [kidsInput, setKidsInput] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!idToken) return;
    api
      .getProfile(idToken)
      .then((p) => {
        setProfile(p);
        setPrefs(p.notification_preferences);
        setKidsInput(p.kids_ages.join(", "));
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
    const kidsAges = kidsInput
      .split(/[,\s]+/)
      .map((s) => parseInt(s.trim(), 10))
      .filter((n) => !Number.isNaN(n));
    const updated = await api.patchProfile(idToken, { kids_ages: kidsAges, complete_onboarding: true });
    setProfile(updated);
    setSaving(false);
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
  const weeklyDigestOn = prefs?.cadence === "weekly";

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
        <>
          <SettingsToggleRow
            label="Weekly digest"
            checked={weeklyDigestOn}
            onChange={(on) =>
              void savePrefs({ cadence: on ? "weekly" : "realtime_bundle" })
            }
          />
          {ALERT_TOGGLES.map(({ key, label }) => (
            <SettingsToggleRow
              key={key}
              label={label}
              checked={prefs[key]}
              onChange={(checked) => void savePrefs({ [key]: checked })}
            />
          ))}
          <SettingsPanel title="Alert cadence" subtitle="How often we bundle updates">
            <FormField label="Delivery">
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
          </SettingsPanel>
        </>
      )}

      <SettingsLinkRow to="/account/contributions" label="My contributions" />
      <SettingsLinkRow href="/privacy" label="Privacy & data" />

      <SettingsPanel title="Family profile" subtitle="Kids' ages personalize speed tips">
        <FormField label="Kids' ages (comma-separated)">
          <input
            value={kidsInput}
            onChange={(e) => setKidsInput(e.target.value)}
            placeholder="e.g. 2, 5"
          />
        </FormField>
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
