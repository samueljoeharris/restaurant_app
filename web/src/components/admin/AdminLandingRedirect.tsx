import { Navigate } from "react-router-dom";

import { useAuth } from "../../auth/AuthContext";
import { AdminAccessDeniedPage } from "../../pages/admin/AdminAccessDeniedPage";
import { Skeleton } from "../ui/Skeleton";

/** Root landing for admin.<env>.littlescout.app — login first, then console. */
export function AdminLandingRedirect() {
  const { user, loading, isAdmin } = useAuth();

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

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (!isAdmin) {
    return <AdminAccessDeniedPage />;
  }

  return <Navigate to="/admin" replace />;
}
