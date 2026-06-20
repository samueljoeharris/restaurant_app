import { Link } from "react-router-dom";

import { useAuth } from "../../auth/useAuth";
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
    <div className="flex min-h-screen min-w-[var(--desktop-min-width)] flex-col justify-center px-8 py-8">
      <main className="mx-auto w-full max-w-[var(--page-narrow)] animate-page-enter">
        <div className="mb-6 text-center">
          <div className="mb-3 text-5xl">🔭</div>
          <p className="mb-2 inline-block rounded-full bg-accent-soft px-2 py-1 text-xs font-semibold uppercase tracking-widest text-accent">
            Operator console
          </p>
          <h1 className="text-2xl tracking-tight">{title}</h1>
          <p className="mt-2 text-text-muted">{message}</p>
        </div>

        <Card>
          {user?.email && (
            <p>
              Signed in as <strong>{user.email}</strong>
            </p>
          )}
          <div className="grid gap-3">
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
              <Link to="/login" className="text-sm font-semibold text-brand">
                Local dev sign-in
              </Link>
            )}
          </div>
        </Card>
      </main>
    </div>
  );
}
