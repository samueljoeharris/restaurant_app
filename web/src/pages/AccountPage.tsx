import { useEffect, useState } from "react";

import { useAuth } from "../auth/useAuth";
import { ADMIN_APP_URL } from "../buildTarget";
import { DeleteAccountSettings } from "../components/DeleteAccountSettings";
import { MfaSettings } from "../components/MfaSettings";
import { api } from "../api/client";
import { Button, ButtonLink } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Page } from "../components/ui/Page";
import { Stat, StatGrid } from "../components/ui/Stat";
import { useTheme, type ThemeMode } from "../hooks/useTheme";
import { cn } from "../lib/cn";
import { userStorage } from "../lib/userStorage";
import type { ExtendedUserProfile, NotificationPreferences } from "../types";

const THEME_OPTIONS: { mode: ThemeMode; label: string }[] = [
  { mode: "system", label: "System" },
  { mode: "light", label: "Light" },
  { mode: "dark", label: "Dark" },
];

export function AccountPage() {
  const { user, idToken, isAdmin, logout } = useAuth();
  const { mode, setMode } = useTheme();
  const [profile, setProfile] = useState<ExtendedUserProfile | null>(null);
  const [prefs, setPrefs] = useState<NotificationPreferences | null>(null);
  const [kidsInput, setKidsInput] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!idToken) return;
    api.getProfile(idToken).then((p) => {
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
    }).catch(() => {});
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

  const providers = user.providerData.map((p) => p.providerId).join(", ");

  return (
    <Page title="Settings" subtitle={user.email ?? "Your Little Scout account"}>
      <Card title="Family profile" subtitle="Kids' ages personalize speed tips">
        <label className="grid gap-2 text-sm">
          Kids&apos; ages (comma-separated)
          <input
            value={kidsInput}
            onChange={(e) => setKidsInput(e.target.value)}
            placeholder="e.g. 2, 5"
          />
        </label>
        <Button className="mt-3" disabled={saving} onClick={() => void saveFamilyProfile()}>
          {saving ? "Saving…" : "Save family profile"}
        </Button>
      </Card>

      <Card title="Updates & alerts" subtitle="Default is a gentle weekly digest">
        {prefs && (
          <div className="grid gap-3 text-sm">
            <label className="flex items-center justify-between gap-3">
              <span>New speed visits</span>
              <input
                type="checkbox"
                checked={prefs.alert_new_ttf}
                onChange={(e) => void savePrefs({ alert_new_ttf: e.target.checked })}
              />
            </label>
            <label className="flex items-center justify-between gap-3">
              <span>New parent ratings</span>
              <input
                type="checkbox"
                checked={prefs.alert_new_rating}
                onChange={(e) => void savePrefs({ alert_new_rating: e.target.checked })}
              />
            </label>
            <label className="flex items-center justify-between gap-3">
              <span>New notes</span>
              <input
                type="checkbox"
                checked={prefs.alert_new_note}
                onChange={(e) => void savePrefs({ alert_new_note: e.target.checked })}
              />
            </label>
            <label className="flex items-center justify-between gap-3">
              <span>Every new review (noisy)</span>
              <input
                type="checkbox"
                checked={prefs.alert_every_review}
                onChange={(e) => void savePrefs({ alert_every_review: e.target.checked })}
              />
            </label>
            <label className="flex items-center justify-between gap-3">
              <span>Push notifications</span>
              <input
                type="checkbox"
                checked={prefs.push_enabled}
                onChange={(e) => void savePrefs({ push_enabled: e.target.checked })}
              />
            </label>
            <label className="grid gap-1">
              Cadence
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
            </label>
          </div>
        )}
      </Card>

      <Card title="Profile">
        <p>
          <strong>{user.displayName ?? user.email ?? "Signed in"}</strong>
        </p>
        <p className="text-sm text-text-muted">Sign-in: {providers || "password"}</p>
        {(isAdmin || profile?.role === "admin") && (
          <p className="text-sm text-success">
            Operator access ·{" "}
            <a href={ADMIN_APP_URL} className="font-semibold text-brand">
              Open operator console
            </a>
          </p>
        )}
        {profile && (
          <StatGrid>
            <Stat label="Contributions" value={profile.contribution_count} highlight />
            <Stat label="Saved" value={profile.watch_count ?? 0} />
            <Stat label="Unread" value={profile.unread_activity_count ?? 0} />
          </StatGrid>
        )}
        <ButtonLink to="/account/contributions" variant="secondary" fullWidth>
          View your contributions
        </ButtonLink>
        <Button variant="ghost" onClick={() => logout()}>
          Sign out
        </Button>
        <p className="text-sm text-text-muted">
          <a className="font-semibold text-brand" href="/privacy">
            Privacy Policy
          </a>
        </p>
      </Card>

      <Card title="Appearance" subtitle="Choose how Little Scout looks">
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
      </Card>

      <Card title="Security" subtitle="Protect your account">
        <MfaSettings />
      </Card>

      <Card title="Delete account" subtitle="Permanent and cannot be undone">
        <DeleteAccountSettings />
      </Card>
    </Page>
  );
}
