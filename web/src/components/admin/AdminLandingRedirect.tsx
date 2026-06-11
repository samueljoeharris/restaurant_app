import { Navigate } from "react-router-dom";

import { useAuth } from "../../auth/AuthContext";
import { AdminAccessDeniedPage } from "../../pages/admin/AdminAccessDeniedPage";
import { Skeleton } from "../ui/Skeleton";

/** Root landing for admin.<env>.littlescout.app — IAP SSO, then console. */
export function AdminLandingRedirect() {
  const { user, loading, isAdmin, iapAccessDenied } = useAuth();

  if (loading) {
    return (
      <div className="auth-page auth-page--admin">
        <main className="page page--narrow">
          <Skeleton className="ui-skeleton--title" />
          <Skeleton className="ui-skeleton--line" />
        </main>
      </div>
    );
  }

  if (iapAccessDenied || (user && !isAdmin)) {
    return <AdminAccessDeniedPage />;
  }

  if (!user) {
    return import.meta.env.DEV ? (
      <Navigate to="/login" replace />
    ) : (
      <AdminAccessDeniedPage
        title="Could not connect operator session"
        message="IAP sign-in succeeded, but the app could not start a Firebase admin session. Reload the page or contact an existing admin."
      />
    );
  }

  return <Navigate to="/admin" replace />;
}
