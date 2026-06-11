import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";

import { useAuth } from "../../auth/AuthContext";
import { AdminAccessDeniedPage } from "../../pages/admin/AdminAccessDeniedPage";
import { Skeleton } from "../ui/Skeleton";

export function AdminRoute({ children }: { children: ReactNode }) {
  const { user, loading, isAdmin, iapAccessDenied } = useAuth();

  if (loading) {
    return (
      <div className="admin-shell admin-shell--loading">
        <Skeleton className="ui-skeleton--title" />
        <Skeleton className="ui-skeleton--line" />
      </div>
    );
  }

  if (iapAccessDenied || (user && !isAdmin)) {
    return <AdminAccessDeniedPage />;
  }

  if (!user) {
    return <Navigate to="/" replace />;
  }

  return children;
}
