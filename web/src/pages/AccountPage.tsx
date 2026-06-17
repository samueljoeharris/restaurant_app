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

export function AccountPage() {
  const {
    user,
    idToken,
    isAdmin,
    logout,
  } = useAuth();
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
        <p className="muted small">Sign-in: {providers || "password"}</p>
        {(isAdmin || profile?.role === "admin") && (
          <p className="success small">
            Operator access ·{" "}
            <a href={ADMIN_APP_URL} className="linkish">
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
        <p className="muted small">
          <a className="linkish" href="/privacy">
            Privacy Policy
          </a>
        </p>
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
