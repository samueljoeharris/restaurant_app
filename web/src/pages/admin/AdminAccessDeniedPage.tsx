import { Link } from "react-router-dom";

import { useAuth } from "../../auth/AuthContext";
import { PUBLIC_APP_URL } from "../../lib/appMode";
import { Button, ButtonAnchor } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";

export function AdminAccessDeniedPage() {
  const { user, logout } = useAuth();

  return (
    <div className="auth-page auth-page--admin">
      <main className="page page--narrow page-enter">
        <div className="auth-hero">
          <div className="auth-hero__mark">🔭</div>
          <p className="auth-hero__badge">Operator console</p>
          <h1 className="auth-hero__title">Access denied</h1>
          <p className="muted">
            {user?.email
              ? `${user.email} is signed in but does not have operator access.`
              : "This account does not have operator access."}
          </p>
        </div>

        <Card>
          <p className="muted">
            Little Scout Admin is limited to operator accounts. Use the public app
            to browse restaurants and submit observations.
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
