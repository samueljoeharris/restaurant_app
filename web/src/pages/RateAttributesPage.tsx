import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import { api } from "../api/client";
import { useAuth, authErrorMessage } from "../auth/AuthContext";
import { AttributeInput } from "../components/AttributeInput";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Page } from "../components/ui/Page";
import { useToast } from "../components/ui/Toast";
import type { MetricDefinition } from "../types";

const CATEGORY_LABELS: Record<string, string> = {
  access: "Access",
  atmosphere: "Atmosphere",
  kids_menu: "Kids menu",
  service: "Service",
  safety: "Safety",
};

type Ratings = Record<string, boolean | number | string | undefined>;

export function RateAttributesPage() {
  const { id } = useParams<{ id: string }>();
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
    if (!id) return;
    Promise.all([api.listMetrics(), api.getRestaurant(id)])
      .then(([metricList, detail]) => {
        setMetrics(metricList);
        setRestaurantName(detail.restaurant.name);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Load failed"))
      .finally(() => setLoading(false));
  }, [id]);

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

  async function handleSubmit() {
    if (!id || !idToken || changedKeys.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      for (const metric of changedKeys) {
        const value = ratings[metric.key];
        if (value === undefined) continue;
        await api.submitAttribute(id, metric.key, value, idToken);
      }
      toast(
        `Saved ${changedKeys.length} rating${changedKeys.length === 1 ? "" : "s"} — check Parent ratings on the restaurant page.`,
        "success",
      );
      navigate(`/restaurants/${id}`);
    } catch (err) {
      setError(authErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <Page narrow title="Rate visit">
        <p className="muted">Loading…</p>
      </Page>
    );
  }

  return (
    <Page
      narrow
      title="Rate visit"
      subtitle={restaurantName}
      back={
        <Link to={`/restaurants/${id}`} className="back-link">
          ← Back
        </Link>
      }
    >
      <Card subtitle="Tap an option for each attribute — selected items highlight in orange.">
        {[...grouped.entries()].map(([category, items]) => (
          <section key={category} className="rate-section">
            <h2>{CATEGORY_LABELS[category] ?? category}</h2>
            {items.map((metric) => {
              const isSet = ratings[metric.key] !== undefined;
              return (
                <div
                  key={metric.key}
                  className={["rate-field", isSet ? "rate-field--set" : ""].join(" ")}
                >
                  <span className="rate-field__label">{metric.label}</span>
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
        <div className="rate-save-bar">
          {changedKeys.length === 0 ? (
            <p className="field-hint">Select at least one attribute to save.</p>
          ) : (
            <p className="field-hint">
              {changedKeys.length} attribute{changedKeys.length === 1 ? "" : "s"} ready to save.
            </p>
          )}
          {error && <p className="error">{error}</p>}
          <Button fullWidth disabled={busy || changedKeys.length === 0} onClick={handleSubmit}>
            {busy ? "Saving…" : saveLabel}
          </Button>
        </div>
      </Card>
    </Page>
  );
}
