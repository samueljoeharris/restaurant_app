import { useAuth } from "../../auth/useAuth";
import { MfaSettings } from "../../components/MfaSettings";
import { Card } from "../../components/ui/Card";
import { Page } from "../../components/ui/Page";

export function AdminAccountPage() {
  const { user } = useAuth();

  if (!user) return null;

  return (
    <Page
      title="Account security"
      subtitle={user.email ?? "Manage sign-in and MFA"}
    >
      <Card title="Two-factor authentication" subtitle="Authenticator app (TOTP)">
        <MfaSettings />
      </Card>
    </Page>
  );
}
