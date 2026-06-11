import { Link } from "react-router-dom";

import { useAuth } from "../../auth/AuthContext";
import { PUBLIC_APP_URL } from "../../buildTarget";
import { Button, ButtonAnchor } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";

type AdminAccessDeniedPageProps = {
  title?: string;
  message?: string;
};

/** IAP allowlist passed but Firebase JWT lacks role=admin (or SSO failed). */
export function AdminAccessDeniedPage({
  title = "Admin access required",
  message = "Your Google account passed the IAP login wall, but it does not have operator access in Firebase yet.",
}: AdminAccessDeniedPageProps) {
  const { user, logout } = useAuth();

  return (
    <div className="auth-page auth-page--admin">
      <main className="page page--narrow page-enter">
        <div className="auth-hero">
          <div className="auth-hero__mark">🔭</div>
          <p className="auth-hero__badge">Operator console</p>
          <h1 className="auth-hero__title">{title}</h1>
          <p className="muted">{message}</p>
        </div>

        <Card>
          {user?.email && (
            <p>
              Signed in as <strong>{user.email}</strong>
            </p>
          )}
          <p className="muted">
            An existing admin must run{" "}
            <code>python api/scripts/set_admin_claim.py --email YOUR_EMAIL</code>, then
            reload this page.
          </p>
          <div className="auth-actions">
            <ButtonAnchor href={PUBLIC_APP_URL} fullWidth>
              Go to public app
            </ButtonAnchor>
            {user ? (
              <Button variant="secondary" fullWidth onClick={() => logout()}>
                Sign out
              </Button>
            ) : (
              <Button variant="secondary" fullWidth onClick={() => window.location.reload()}>
                Reload page
              </Button>
            )}
            {import.meta.env.DEV && (
              <Link to="/login" className="linkish">
                Local dev sign-in
              </Link>
            )}
          </div>
        </Card>
      </main>
    </div>
  );
}
