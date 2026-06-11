import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

import { AuthProvider } from "./auth/AuthContext";
import { AdminLandingRedirect } from "./components/admin/AdminLandingRedirect";
import { AdminLayout } from "./components/admin/AdminLayout";
import { AdminRoute } from "./components/admin/AdminRoute";
import { AdminAccessDeniedPage } from "./pages/admin/AdminAccessDeniedPage";
import { LoginPage } from "./pages/LoginPage";
import { AdminDashboardPage } from "./pages/admin/AdminDashboardPage";
import { AdminObservationsPage } from "./pages/admin/AdminObservationsPage";
import { AdminAccountPage } from "./pages/admin/AdminAccountPage";
import { AdminRestaurantsPage } from "./pages/admin/AdminRestaurantsPage";
import { AdminUsersPage } from "./pages/admin/AdminUsersPage";

/** Operator intranet — admin console only (deployed as ttf-admin-web). */
export default function AdminApp() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<AdminLandingRedirect />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/access-denied" element={<AdminAccessDeniedPage />} />
          <Route
            path="/admin"
            element={
              <AdminRoute>
                <AdminLayout>
                  <AdminDashboardPage />
                </AdminLayout>
              </AdminRoute>
            }
          />
          <Route
            path="/admin/restaurants"
            element={
              <AdminRoute>
                <AdminLayout>
                  <AdminRestaurantsPage />
                </AdminLayout>
              </AdminRoute>
            }
          />
          <Route
            path="/admin/users"
            element={
              <AdminRoute>
                <AdminLayout>
                  <AdminUsersPage />
                </AdminLayout>
              </AdminRoute>
            }
          />
          <Route
            path="/admin/observations"
            element={
              <AdminRoute>
                <AdminLayout>
                  <AdminObservationsPage />
                </AdminLayout>
              </AdminRoute>
            }
          />
          <Route
            path="/admin/account"
            element={
              <AdminRoute>
                <AdminLayout>
                  <AdminAccountPage />
                </AdminLayout>
              </AdminRoute>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
