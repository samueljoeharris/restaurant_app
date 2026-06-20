import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

import { AuthProvider } from "./auth/AuthContext";
import { AdminSiteRedirect } from "./components/AdminSiteRedirect";
import { Layout } from "./components/Layout";
import { AccountPage } from "./pages/AccountPage";
import { ActivityToast } from "./components/ActivityToast";
import { ExploreMapPage } from "./pages/ExploreMapPage";
import { LoginPage } from "./pages/LoginPage";
import { MyContributionsPage } from "./pages/MyContributionsPage";
import { ModerationPolicyPage } from "./pages/ModerationPolicyPage";
import { PrivacyPage } from "./pages/PrivacyPage";
import { SavedPage } from "./pages/SavedPage";
import { PlaceRestaurantDetailPage } from "./pages/PlaceRestaurantDetailPage";
import { RestaurantDetailPage } from "./pages/RestaurantDetailPage";
import { RateAttributesPage } from "./pages/RateAttributesPage";
import { ReviewChatPage } from "./pages/ReviewChatPage";
import { TtfContributionEditPage } from "./pages/TtfContributionEditPage";
import { TtfSubmitPage } from "./pages/TtfSubmitPage";

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/privacy" element={<PrivacyPage />} />
          <Route path="/moderation-policy" element={<ModerationPolicyPage />} />
          <Route path="/" element={<Navigate to="/map" replace />} />
          <Route
            path="/saved"
            element={
              <Layout>
                <SavedPage />
              </Layout>
            }
          />
          <Route
            path="/restaurants"
            element={
              <Layout>
                <ExploreMapPage />
              </Layout>
            }
          />
          <Route
            path="/restaurants/place/:placeId/review"
            element={
              <Layout>
                <ReviewChatPage />
              </Layout>
            }
          />
          <Route
            path="/restaurants/place/:placeId/rate"
            element={
              <Layout>
                <RateAttributesPage />
              </Layout>
            }
          />
          <Route
            path="/restaurants/place/:placeId/submit"
            element={
              <Layout>
                <TtfSubmitPage />
              </Layout>
            }
          />
          <Route
            path="/restaurants/place/:placeId"
            element={
              <Layout>
                <PlaceRestaurantDetailPage />
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
                <ExploreMapPage />
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
            path="/account/contributions"
            element={
              <Layout>
                <MyContributionsPage />
              </Layout>
            }
          />
          <Route
            path="/account/contributions/ttf/:observationId/edit"
            element={
              <Layout>
                <TtfContributionEditPage />
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
            path="/restaurants/:id/review"
            element={
              <Layout>
                <ReviewChatPage />
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
          <Route path="*" element={<Navigate to="/map" replace />} />
        </Routes>
        <ActivityToast />
      </BrowserRouter>
    </AuthProvider>
  );
}
