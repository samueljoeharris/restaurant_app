import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import { api } from "../api/client";
import { useAuth } from "../auth/useAuth";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { ChoiceChip, ChoiceChipGroup } from "../components/ui/ChoiceChip";
import { Page } from "../components/ui/Page";
import { StarRating } from "../components/ui/StarRating";
import { useToast } from "../components/ui/useToast";
import { EMPTY_CONTRIBUTION_RECENCY } from "../lib/contributionRecency";
import type { RestaurantDetailResponse, TtfSubmission } from "../types";

const ITEM_TYPES: { value: TtfSubmission["item_type"]; label: string; emoji: string }[] = [
  { value: "fries", label: "Fries", emoji: "🍟" },
  { value: "apple_slices", label: "Apple slices", emoji: "🍎" },
  { value: "bread", label: "Bread", emoji: "🍞" },
  { value: "kids_meal", label: "Kids meal", emoji: "🧒" },
  { value: "other", label: "Other", emoji: "🍽️" },
];

const PORTIONS: { value: TtfSubmission["portion_size"]; label: string }[] = [
  { value: "kid", label: "Kid" },
  { value: "regular", label: "Regular" },
  { value: "shareable", label: "Shareable" },
];

const DAYPARTS: { value: TtfSubmission["daypart"]; label: string }[] = [
  { value: "breakfast", label: "Breakfast" },
  { value: "lunch", label: "Lunch" },
  { value: "dinner", label: "Dinner" },
  { value: "late", label: "Late" },
];

function currentDaypart(): TtfSubmission["daypart"] {
  const hour = new Date().getHours();
  if (hour < 11) return "breakfast";
  if (hour < 15) return "lunch";
  if (hour < 21) return "dinner";
  return "late";
}

function formatTimer(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${min}:${sec.toString().padStart(2, "0")}`;
}

export function TtfSubmitPage() {
  const { id, placeId } = useParams<{ id?: string; placeId?: string }>();
  const navigate = useNavigate();
  const { idToken } = useAuth();
  const { toast } = useToast();
  const [restaurant, setRestaurant] = useState<RestaurantDetailResponse | null>(null);
  const [elapsed, setElapsed] = useState(12);
  const [itemType, setItemType] = useState<TtfSubmission["item_type"]>("fries");
  const [quality, setQuality] = useState(4);
  const [portion, setPortion] = useState<TtfSubmission["portion_size"]>("kid");
  const [daypart, setDaypart] = useState<TtfSubmission["daypart"]>(currentDaypart());
  const [kids, setKids] = useState(1);
  const [context, setContext] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [timerStart, setTimerStart] = useState<number | null>(null);
  const [timerStopped, setTimerStopped] = useState<number | null>(null);
  const [timerNow, setTimerNow] = useState(() => Date.now());

  useEffect(() => {
    if (id) { api.getRestaurant(id).then(setRestaurant); return; }
    if (!placeId || !idToken) return;
    api.getPlaceEntry(placeId, idToken).then((entry) => {
      setRestaurant({
        restaurant: {
          id: entry.id ?? "", name: entry.name, address: entry.address,
          lat: entry.lat, lng: entry.lng, cuisine_tags: entry.cuisine_tags,
          pilot_city: entry.pilot_city, google_place_id: entry.google_place_id ?? placeId,
          google_maps_url: null, created_at: "", updated_at: "",
        },
        ttf: entry.ttf,
        contribution_recency: EMPTY_CONTRIBUTION_RECENCY,
      });
    });
  }, [id, placeId, idToken]);

  useEffect(() => {
    if (timerStart === null || timerStopped !== null) return;
    const interval = window.setInterval(() => setTimerNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, [timerStart, timerStopped]);

  const timerRunning = timerStart !== null && timerStopped === null;
  const timerMs =
    timerStart === null
      ? 0
      : Math.max(0, (timerStopped ?? timerNow) - timerStart);
  const timerMinutes = Math.max(1, Math.ceil(timerMs / 60000));

  function startTimer() {
    const now = Date.now();
    setTimerStart(now);
    setTimerNow(now);
    setTimerStopped(null);
  }

  function stopTimer() {
    const now = Date.now();
    setTimerStopped(now);
    setTimerNow(now);
  }

  const canSubmit =
    !busy &&
    (timerStopped !== null || (timerStart === null && elapsed >= 1));

  const submitHint = timerRunning
    ? "Stop the timer before submitting."
    : !canSubmit && timerStart !== null
      ? "Timer was reset — start again or enter minutes manually."
      : null;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if ((!id && !placeId) || !idToken || !canSubmit) return;
    setBusy(true);
    setError(null);
    const minutes = timerStart !== null ? timerMinutes : elapsed;
    try {
      let restaurantId = id ?? null;
      if (!restaurantId && placeId) {
        const materialized = await api.materializePlace(placeId, idToken);
        restaurantId = materialized.restaurant.id;
      }
      if (!restaurantId) throw new Error("Restaurant not found");
      await api.submitTtf(
        restaurantId,
        {
          elapsed_minutes: minutes,
          item_type: itemType,
          item_quality: quality,
          portion_size: portion,
          daypart,
          party_size_kids: kids,
          wait_context: context.trim() || undefined,
        },
        idToken,
      );
      toast("Observation saved — thanks!", "success");
      navigate(`/restaurants/${restaurantId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Submit failed");
    } finally {
      setBusy(false);
    }
  }

  function resetTimer() {
    setTimerStart(null);
    setTimerStopped(null);
    setTimerNow(Date.now());
  }

  if (!restaurant) {
    return (
      <Page narrow title="Submit observation">
        <p className="muted">Loading…</p>
      </Page>
    );
  }

  return (
    <Page
      narrow
      title="Submit observation"
      subtitle={restaurant.restaurant.name}
      back={
        <Link to={`/restaurants/${id}`} className="back-link">
          ← Back
        </Link>
      }
    >
      <Card>
        <form className="stack" onSubmit={handleSubmit}>
          <div className="timer-card">
            <p className="muted small">Time from order to kid food on the table</p>
            <div className="timer-display">
              {timerStart === null ? "0:00" : formatTimer(timerMs)}
            </div>
            <div className="timer-actions">
              {timerStart === null && (
                <Button type="button" onClick={startTimer}>
                  Start timer
                </Button>
              )}
              {timerRunning && (
                <Button
                  type="button"
                  variant="secondary"
                  onClick={stopTimer}
                >
                  Stop ({timerMinutes} min)
                </Button>
              )}
              {timerStart !== null && (
                <Button type="button" variant="ghost" onClick={resetTimer}>
                  Reset
                </Button>
              )}
            </div>
          </div>

          {!timerRunning && timerStart === null && (
            <label>
              Or enter elapsed minutes
              <input
                type="number"
                min={1}
                max={180}
                value={elapsed}
                onChange={(e) => setElapsed(Number(e.target.value))}
              />
            </label>
          )}

          <fieldset className="field-group">
            <legend>What arrived?</legend>
            <ChoiceChipGroup columns={2}>
              {ITEM_TYPES.map((item) => (
                <ChoiceChip
                  key={item.value}
                  selected={itemType === item.value}
                  onClick={() => setItemType(item.value)}
                >
                  {item.emoji} {item.label}
                </ChoiceChip>
              ))}
            </ChoiceChipGroup>
          </fieldset>

          <div className="field-group">
            <span className="field-group__label">Quality</span>
            <StarRating value={quality} onChange={setQuality} label="Item quality" />
          </div>

          <fieldset className="field-group">
            <legend>Portion</legend>
            <ChoiceChipGroup columns={3}>
              {PORTIONS.map((opt) => (
                <ChoiceChip
                  key={opt.value}
                  selected={portion === opt.value}
                  onClick={() => setPortion(opt.value)}
                >
                  {opt.label}
                </ChoiceChip>
              ))}
            </ChoiceChipGroup>
          </fieldset>

          <fieldset className="field-group">
            <legend>Daypart</legend>
            <ChoiceChipGroup columns={2}>
              {DAYPARTS.map((opt) => (
                <ChoiceChip
                  key={opt.value}
                  selected={daypart === opt.value}
                  onClick={() => setDaypart(opt.value)}
                >
                  {opt.label}
                </ChoiceChip>
              ))}
            </ChoiceChipGroup>
          </fieldset>

          <label>
            Kids in party
            <input
              type="number"
              min={1}
              max={12}
              value={kids}
              onChange={(e) => setKids(Number(e.target.value))}
            />
          </label>

          <label>
            Context (optional)
            <textarea
              value={context}
              onChange={(e) => setContext(e.target.value)}
              rows={2}
              placeholder="Busy Saturday lunch, high chair requested…"
            />
          </label>

          {error && <p className="error">{error}</p>}
          {submitHint && <p className="field-hint field-hint--warn">{submitHint}</p>}
          <Button type="submit" fullWidth disabled={!canSubmit}>
            {busy ? "Submitting…" : "Submit observation"}
          </Button>
        </form>
      </Card>
    </Page>
  );
}
