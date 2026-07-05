import { lazy, Suspense, type ReactNode } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

import { AuthProvider } from "./auth/AuthContext";
import { ScrollToTop } from "./components/ScrollToTop";
import { AdminLandingRedirect } from "./components/admin/AdminLandingRedirect";
import { AdminLayout } from "./components/admin/AdminLayout";
import { AdminRoute } from "./components/admin/AdminRoute";
import { RouteFallback } from "./components/RouteFallback";
import { LoginPage } from "./pages/LoginPage";

// All console pages load on demand; the shell (auth gate + layout) stays eager.
const AdminAccessDeniedPage = lazy(() => import("./pages/admin/AdminAccessDeniedPage").then((m) => ({ default: m.AdminAccessDeniedPage })));
const AdminAccountPage = lazy(() => import("./pages/admin/AdminAccountPage").then((m) => ({ default: m.AdminAccountPage })));
const AdminCatalogRefreshPage = lazy(() => import("./pages/admin/AdminCatalogRefreshPage").then((m) => ({ default: m.AdminCatalogRefreshPage })));
const AdminDashboardPage = lazy(() => import("./pages/admin/AdminDashboardPage").then((m) => ({ default: m.AdminDashboardPage })));
const AdminModerationPage = lazy(() => import("./pages/admin/AdminModerationPage").then((m) => ({ default: m.AdminModerationPage })));
const AdminObservationsPage = lazy(() => import("./pages/admin/AdminObservationsPage").then((m) => ({ default: m.AdminObservationsPage })));
const AdminRestaurantsPage = lazy(() => import("./pages/admin/AdminRestaurantsPage").then((m) => ({ default: m.AdminRestaurantsPage })));
const AdminUsersPage = lazy(() => import("./pages/admin/AdminUsersPage").then((m) => ({ default: m.AdminUsersPage })));

function AdminShell({ children }: { children: ReactNode }) {
  return (
    <AdminRoute>
      <AdminLayout>
        <Suspense fallback={<RouteFallback />}>{children}</Suspense>
      </AdminLayout>
    </AdminRoute>
  );
}

/** Operator intranet — admin console only (deployed as ttf-admin-web). */
export default function AdminApp() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <ScrollToTop />
        <Routes>
          <Route path="/" element={<AdminLandingRedirect />} />
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/access-denied"
            element={
              <Suspense fallback={<RouteFallback />}>
                <AdminAccessDeniedPage />
              </Suspense>
            }
          />
          <Route path="/admin" element={<AdminShell><AdminDashboardPage /></AdminShell>} />
          <Route path="/admin/moderation" element={<AdminShell><AdminModerationPage /></AdminShell>} />
          <Route path="/admin/restaurants" element={<AdminShell><AdminRestaurantsPage /></AdminShell>} />
          <Route path="/admin/users" element={<AdminShell><AdminUsersPage /></AdminShell>} />
          <Route path="/admin/data" element={<AdminShell><AdminObservationsPage /></AdminShell>} />
          <Route path="/admin/observations" element={<Navigate to="/admin/data" replace />} />
          <Route path="/admin/tools/locations" element={<AdminShell><AdminCatalogRefreshPage /></AdminShell>} />
          <Route path="/admin/locations" element={<Navigate to="/admin/tools/locations" replace />} />
          <Route path="/admin/account" element={<AdminShell><AdminAccountPage /></AdminShell>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
