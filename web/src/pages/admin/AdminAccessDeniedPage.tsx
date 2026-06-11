import { Link } from "react-router-dom";

import { useAuth } from "../../auth/AuthContext";
import { PUBLIC_APP_URL } from "../../buildTarget";
import { Button, ButtonAnchor } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";

type AdminAccessDeniedPageProps = {
  title?: string;
  message?: string;
};

/** Signed-in user lacks operator access, or IAP SSO could not start a session. */
export function AdminAccessDeniedPage({
  title = "Access denied",
  message = "You don't have permission to use the operator console.",
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
