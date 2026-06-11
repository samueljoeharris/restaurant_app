import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

import { AuthProvider } from "./auth/AuthContext";
import { AdminSiteRedirect } from "./components/AdminSiteRedirect";
import { Layout } from "./components/Layout";
import { AccountPage } from "./pages/AccountPage";
import { LoginPage } from "./pages/LoginPage";
import { RestaurantDetailPage } from "./pages/RestaurantDetailPage";
import { RestaurantListPage } from "./pages/RestaurantListPage";
import { MapPage } from "./pages/MapPage";
import { RateAttributesPage } from "./pages/RateAttributesPage";
import { TtfSubmitPage } from "./pages/TtfSubmitPage";

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/restaurants"
            element={
              <Layout>
                <RestaurantListPage />
              </Layout>
            }
          />
          <Route
            path="/restaurants/:id"
            element={
              <Layout>
                <RestaurantDetailPage />
              </Layout>
            }
          />
          <Route
            path="/map"
            element={
              <Layout>
                <MapPage />
              </Layout>
            }
          />
          <Route
            path="/account"
            element={
              <Layout>
                <AccountPage />
              </Layout>
            }
          />
          <Route
            path="/restaurants/:id/rate"
            element={
              <Layout>
                <RateAttributesPage />
              </Layout>
            }
          />
          <Route
            path="/restaurants/:id/submit"
            element={
              <Layout>
                <TtfSubmitPage />
              </Layout>
            }
          />
          <Route path="/admin/*" element={<AdminSiteRedirect />} />
          <Route path="/" element={<Navigate to="/restaurants" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
