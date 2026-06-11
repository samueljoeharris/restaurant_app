import { Link } from "react-router-dom";

import { useAuth } from "../../auth/AuthContext";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";

/** Signed in via Firebase but JWT lacks role=admin (IAP alone is not enough). */
export function AdminAccessDeniedPage() {
  const { user, logout } = useAuth();

  return (
    <div className="auth-page">
      <main className="page page--narrow page-enter">
        <div className="auth-hero">
          <div className="auth-hero__mark">🔭</div>
          <h1 className="auth-hero__title">Admin access required</h1>
          <p className="muted">
            You passed the site login wall, but this Google account does not have operator
            access yet.
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
            <code>python api/scripts/set_admin_claim.py --email YOUR_EMAIL</code>, then sign
            out and back in here.
          </p>
          <Button variant="secondary" fullWidth onClick={() => logout()}>
            Sign out
          </Button>
          <p className="muted" style={{ marginTop: "1rem" }}>
            <Link to="/login">Try a different account</Link>
          </p>
        </Card>
      </main>
    </div>
  );
}
