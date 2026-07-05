import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import { api } from "../api/client";
import { useAuth } from "../auth/useAuth";
import { authErrorMessage } from "../auth/errors";
import { AttributeInput } from "../components/AttributeInput";
import { BackLink } from "../components/ui/BackLink";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Page } from "../components/ui/Page";
import { useToast } from "../components/ui/useToast";
import { cn } from "../lib/cn";
import { restaurantDetailPath } from "../lib/mapEntryKey";
import { METRIC_CATEGORY_LABELS } from "../lib/metricCategories";
import { invalidateContributionData, invalidatePlaceEntry } from "../lib/pageDataCache";
import type { MetricDefinition } from "../types";

type Ratings = Record<string, boolean | number | string | undefined>;

export function RateAttributesPage() {
  const { id, placeId } = useParams<{ id?: string; placeId?: string }>();
  const navigate = useNavigate();
  const { idToken } = useAuth();
  const { toast } = useToast();
  const [metrics, setMetrics] = useState<MetricDefinition[]>([]);
  const [restaurantName, setRestaurantName] = useState("");
  const [ratings, setRatings] = useState<Ratings>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) {
      Promise.all([api.listMetrics(), api.getRestaurant(id)])
        .then(([metricList, detail]) => {
          setMetrics(metricList);
          setRestaurantName(detail.restaurant.name);
        })
        .catch((err) => setError(err instanceof Error ? err.message : "Load failed"))
        .finally(() => setLoading(false));
      return;
    }
    if (!placeId || !idToken) return;
    Promise.all([api.listMetrics(), api.getPlaceEntry(placeId, idToken)])
      .then(([metricList, entry]) => {
        setMetrics(metricList);
        setRestaurantName(entry.name);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Load failed"))
      .finally(() => setLoading(false));
  }, [id, placeId, idToken]);

  const grouped = useMemo(() => {
    const map = new Map<string, MetricDefinition[]>();
    for (const metric of metrics) {
      const list = map.get(metric.category) ?? [];
      list.push(metric);
      map.set(metric.category, list);
    }
    return map;
  }, [metrics]);

  const changedKeys = metrics.filter((m) => ratings[m.key] !== undefined);
  const saveLabel =
    changedKeys.length === 0
      ? "Save ratings"
      : `Save ${changedKeys.length} rating${changedKeys.length === 1 ? "" : "s"}`;

  const backTo = restaurantDetailPath({ id: id ?? null, google_place_id: placeId ?? null });
  const needsAuth = Boolean(placeId && !id && !idToken);

  async function handleSubmit() {
    if ((!id && !placeId) || !idToken || changedKeys.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      let restaurantId = id ?? null;
      if (!restaurantId && placeId) {
        const materialized = await api.materializePlace(placeId, idToken);
        restaurantId = materialized.restaurant.id;
        invalidatePlaceEntry(placeId);
      }
      if (!restaurantId) throw new Error("Restaurant not found");
      for (const metric of changedKeys) {
        const value = ratings[metric.key];
        if (value === undefined) continue;
        await api.submitAttribute(restaurantId, metric.key, value, idToken);
      }
      invalidateContributionData(restaurantId);
      toast(
        `Saved ${changedKeys.length} rating${changedKeys.length === 1 ? "" : "s"} — check Parent ratings on the restaurant page.`,
        "success",
      );
      navigate(restaurantDetailPath({ id: restaurantId }), { viewTransition: true });
    } catch (err) {
      setError(authErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  if (needsAuth) {
    return (
      <Page narrow title="Rate visit">
        <p className="text-text-muted">
          <Link to="/login">Sign in</Link> to rate this place.
        </p>
      </Page>
    );
  }

  if (loading) {
    return (
      <Page narrow title="Rate visit">
        <p className="text-text-muted">Loading…</p>
      </Page>
    );
  }

  return (
    <Page
      narrow
      title="Rate visit"
      subtitle={restaurantName}
      back={
        <BackLink to={backTo}>
          ← Back
        </BackLink>
      }
    >
      <Card subtitle="Tap an option for each attribute — selected items highlight in orange.">
        {[...grouped.entries()].map(([category, items]) => (
          <section key={category} className="mb-4 grid gap-3">
            <h2 className="mt-2 text-sm font-semibold capitalize text-text-muted first:mt-0">
              {METRIC_CATEGORY_LABELS[category] ?? category}
            </h2>
            {items.map((metric) => {
              const isSet = ratings[metric.key] !== undefined;
              return (
                <div
                  key={metric.key}
                  className={cn(
                    "grid gap-2 rounded-md border bg-bg p-3 transition-[border-color,background] duration-fast",
                    isSet ? "border-brand/35 bg-brand-soft" : "border-border",
                  )}
                >
                  <span className="text-sm font-semibold">{metric.label}</span>
                  <AttributeInput
                    metric={metric}
                    value={ratings[metric.key]}
                    onChange={(value) =>
                      setRatings((prev) => ({ ...prev, [metric.key]: value }))
                    }
                  />
                </div>
              );
            })}
          </section>
        ))}
        <div className="mt-4 grid gap-2 border-t border-border pt-4">
          {changedKeys.length === 0 ? (
            <p className="m-0 text-xs text-text-muted">Select at least one attribute to save.</p>
          ) : (
            <p className="m-0 text-xs text-text-muted">
              {changedKeys.length} attribute{changedKeys.length === 1 ? "" : "s"} ready to save.
            </p>
          )}
          {error && <p className="text-sm font-semibold text-error">{error}</p>}
          <Button fullWidth disabled={busy || changedKeys.length === 0} onClick={handleSubmit}>
            {busy ? "Saving…" : saveLabel}
          </Button>
        </div>
      </Card>
    </Page>
  );
}
