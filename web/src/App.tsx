import { lazy, Suspense, type ReactNode } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

import { AuthProvider } from "./auth/AuthContext";
import { AdminSiteRedirect } from "./components/AdminSiteRedirect";
import { Layout } from "./components/Layout";
import { RouteFallback } from "./components/RouteFallback";
import { ScrollToTop } from "./components/ScrollToTop";
import { ActivityToast } from "./components/ActivityToast";
import { ExploreMapPage } from "./pages/ExploreMapPage";
import { LoginPage } from "./pages/LoginPage";

// Explore and Login stay eager (landing + auth redirect target); everything
// else loads on demand so /map doesn't pay for the whole app.
const AccountPage = lazy(() => import("./pages/AccountPage").then((m) => ({ default: m.AccountPage })));
const MyContributionsPage = lazy(() => import("./pages/MyContributionsPage").then((m) => ({ default: m.MyContributionsPage })));
const ModerationPolicyPage = lazy(() => import("./pages/ModerationPolicyPage").then((m) => ({ default: m.ModerationPolicyPage })));
const PrivacyPage = lazy(() => import("./pages/PrivacyPage").then((m) => ({ default: m.PrivacyPage })));
const SavedPage = lazy(() => import("./pages/SavedPage").then((m) => ({ default: m.SavedPage })));
const PlaceRestaurantDetailPage = lazy(() => import("./pages/PlaceRestaurantDetailPage").then((m) => ({ default: m.PlaceRestaurantDetailPage })));
const RestaurantDetailPage = lazy(() => import("./pages/RestaurantDetailPage").then((m) => ({ default: m.RestaurantDetailPage })));
const RateAttributesPage = lazy(() => import("./pages/RateAttributesPage").then((m) => ({ default: m.RateAttributesPage })));
const ReviewChatPage = lazy(() => import("./pages/ReviewChatPage").then((m) => ({ default: m.ReviewChatPage })));
const TtfContributionEditPage = lazy(() => import("./pages/TtfContributionEditPage").then((m) => ({ default: m.TtfContributionEditPage })));
const TtfSubmitPage = lazy(() => import("./pages/TtfSubmitPage").then((m) => ({ default: m.TtfSubmitPage })));

// Per-page boundary so Layout (sidebar/nav) stays mounted while a chunk loads.
function suspend(node: ReactNode) {
  return <Suspense fallback={<RouteFallback />}>{node}</Suspense>;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <ScrollToTop />
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/privacy" element={suspend(<PrivacyPage />)} />
          <Route path="/moderation-policy" element={suspend(<ModerationPolicyPage />)} />
          <Route path="/" element={<Navigate to="/map" replace />} />
          <Route
            path="/saved"
            element={
              <Layout>{suspend(<SavedPage />)}</Layout>
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
              <Layout>{suspend(<ReviewChatPage />)}</Layout>
            }
          />
          <Route
            path="/restaurants/place/:placeId/rate"
            element={
              <Layout>{suspend(<RateAttributesPage />)}</Layout>
            }
          />
          <Route
            path="/restaurants/place/:placeId/submit"
            element={
              <Layout>{suspend(<TtfSubmitPage />)}</Layout>
            }
          />
          <Route
            path="/restaurants/place/:placeId"
            element={
              <Layout>{suspend(<PlaceRestaurantDetailPage />)}</Layout>
            }
          />
          <Route
            path="/restaurants/:id"
            element={
              <Layout>{suspend(<RestaurantDetailPage />)}</Layout>
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
              <Layout>{suspend(<AccountPage />)}</Layout>
            }
          />
          <Route
            path="/account/contributions"
            element={
              <Layout>{suspend(<MyContributionsPage />)}</Layout>
            }
          />
          <Route
            path="/account/contributions/ttf/:observationId/edit"
            element={
              <Layout>{suspend(<TtfContributionEditPage />)}</Layout>
            }
          />
          <Route
            path="/restaurants/:id/rate"
            element={
              <Layout>{suspend(<RateAttributesPage />)}</Layout>
            }
          />
          <Route
            path="/restaurants/:id/review"
            element={
              <Layout>{suspend(<ReviewChatPage />)}</Layout>
            }
          />
          <Route
            path="/restaurants/:id/submit"
            element={
              <Layout>{suspend(<TtfSubmitPage />)}</Layout>
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
