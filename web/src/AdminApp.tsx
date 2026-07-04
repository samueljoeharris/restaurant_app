import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

import { AuthProvider } from "./auth/AuthContext";
import { AdminLandingRedirect } from "./components/admin/AdminLandingRedirect";
import { AdminLayout } from "./components/admin/AdminLayout";
import { AdminRoute } from "./components/admin/AdminRoute";
import { AdminAccessDeniedPage } from "./pages/admin/AdminAccessDeniedPage";
import { LoginPage } from "./pages/LoginPage";
import { AdminDashboardPage } from "./pages/admin/AdminDashboardPage";
import { AdminModerationPage } from "./pages/admin/AdminModerationPage";
import { AdminObservationsPage } from "./pages/admin/AdminObservationsPage";
import { AdminAccountPage } from "./pages/admin/AdminAccountPage";
import { AdminCatalogRefreshPage } from "./pages/admin/AdminCatalogRefreshPage";
import { AdminRestaurantsPage } from "./pages/admin/AdminRestaurantsPage";
import { AdminUsersPage } from "./pages/admin/AdminUsersPage";

function AdminShell({ children }: { children: React.ReactNode }) {
  return (
    <AdminRoute>
      <AdminLayout>{children}</AdminLayout>
    </AdminRoute>
  );
}

/** Operator intranet — admin console only (deployed as ttf-admin-web). */
export default function AdminApp() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<AdminLandingRedirect />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/access-denied" element={<AdminAccessDeniedPage />} />
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
