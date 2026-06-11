import { useEffect, useState } from "react";

import { Link } from "react-router-dom";

import { useAuth } from "../auth/AuthContext";
import { MfaSettings } from "../components/MfaSettings";
import { api } from "../api/client";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Page } from "../components/ui/Page";
import { Stat, StatGrid } from "../components/ui/Stat";

export function AccountPage() {
  const {
    user,
    idToken,
    isAdmin,
    refreshClaims,
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
        {(isAdmin || profile?.role === "admin") ? (
          <p className="success small">
            Admin access · <Link to="/admin">Open dashboard</Link>
          </p>
        ) : (
          <p className="muted small">
            Just granted admin?{" "}
            <button
              type="button"
              className="link-button"
              onClick={() => refreshClaims().catch(() => {})}
            >
              Refresh permissions
            </button>
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
        <Button variant="ghost" onClick={() => logout()}>
          Sign out
        </Button>
      </Card>

      <Card title="Security" subtitle="Protect your account">
        <MfaSettings />
      </Card>
    </Page>
  );
}
