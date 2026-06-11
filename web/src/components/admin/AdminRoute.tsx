import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";

import { useAuth } from "../../auth/AuthContext";
import { Skeleton } from "../ui/Skeleton";
import { AdminAccessDeniedPage } from "../../pages/admin/AdminAccessDeniedPage";

export function AdminRoute({ children }: { children: ReactNode }) {
  const { user, loading, isAdmin } = useAuth();

  if (loading) {
    return (
      <div className="admin-shell admin-shell--loading">
        <Skeleton className="ui-skeleton--title" />
        <Skeleton className="ui-skeleton--line" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (!isAdmin) {
    return <AdminAccessDeniedPage />;
  }

  return children;
}
