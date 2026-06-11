import { Link } from "react-router-dom";

import { useAuth } from "../../auth/AuthContext";
import { PUBLIC_APP_URL } from "../../buildTarget";
import { Button, ButtonAnchor } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";

/** Signed in via Firebase but JWT lacks role=admin (IAP alone is not enough). */
export function AdminAccessDeniedPage() {
  const { user, logout } = useAuth();

  return (
    <div className="auth-page auth-page--admin">
      <main className="page page--narrow page-enter">
        <div className="auth-hero">
          <div className="auth-hero__mark">🔭</div>
          <p className="auth-hero__badge">Operator console</p>
          <h1 className="auth-hero__title">Admin access required</h1>
          <p className="muted">
            You passed the site login wall, but this Google account does not have
            operator access yet.
          </p>
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
            sign out and back in here.
          </p>
          <div className="auth-actions">
            <ButtonAnchor href={PUBLIC_APP_URL} fullWidth>
              Go to public app
            </ButtonAnchor>
            <Button variant="secondary" fullWidth onClick={() => logout()}>
              Sign out
            </Button>
            <Link to="/login" className="linkish">
              Try a different account
            </Link>
          </div>
        </Card>
      </main>
    </div>
  );
}
