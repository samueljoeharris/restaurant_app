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

const THEME_OPTIONS: { mode: ThemeMode; label: string }[] = [
  { mode: "system", label: "System" },
  { mode: "light", label: "Light" },
  { mode: "dark", label: "Dark" },
];

export function AccountPage() {
  const {
    user,
    idToken,
    isAdmin,
    logout,
  } = useAuth();
  const { mode, setMode } = useTheme();
  const [profile, setProfile] = useState<{
    contribution_count: number;
    role?: string | null;
  } | null>(null);

  useEffect(() => {
    if (!idToken) return;
    api.getMe(idToken).then(setProfile).catch(() => {});
  }, [idToken]);

  if (!user) return null;

  const providers = user.providerData.map((p) => p.providerId).join(", ");

  return (
    <Page title="You" subtitle={user.email ?? "Your Little Scout account"}>
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
            <Stat
              label="Contributions"
              value={profile.contribution_count}
              highlight
            />
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
