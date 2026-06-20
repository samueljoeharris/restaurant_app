import { Navigate } from "react-router-dom";

import { useAuth } from "../../auth/useAuth";
import { AdminAccessDeniedPage } from "../../pages/admin/AdminAccessDeniedPage";
import { Skeleton } from "../ui/Skeleton";

/** Root landing for admin.<env>.littlescout.app — IAP SSO, then console. */
export function AdminLandingRedirect() {
  const { user, loading, isAdmin, iapAccessDenied } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen min-w-[var(--desktop-min-width)] flex-col justify-center px-8 py-8">
        <main className="mx-auto w-full max-w-[var(--page-narrow)]">
          <Skeleton className="h-4 w-[55%]" />
          <Skeleton className="mt-3 h-3 w-[85%]" />
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
        title="Access denied"
        message="We couldn't sign you in to the operator console."
      />
    );
  }

  return <Navigate to="/admin" replace />;
}
