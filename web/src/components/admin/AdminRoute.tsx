import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";

import { useAuth } from "../../auth/useAuth";
import { AdminAccessDeniedPage } from "../../pages/admin/AdminAccessDeniedPage";
import { Skeleton } from "../ui/Skeleton";

export function AdminRoute({ children }: { children: ReactNode }) {
  const { user, loading, isAdmin, iapAccessDenied } = useAuth();

  if (loading) {
    return (
      <div className="mx-auto block max-w-3xl px-8 py-8">
        <Skeleton className="h-4 w-[55%]" />
        <Skeleton className="h-3 w-[85%]" />
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
