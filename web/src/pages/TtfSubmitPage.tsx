import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import { api } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Page } from "../components/ui/Page";
import { useToast } from "../components/ui/Toast";
import type { RestaurantDetailResponse, TtfSubmission } from "../types";

const ITEM_TYPES: { value: TtfSubmission["item_type"]; label: string; emoji: string }[] = [
  { value: "fries", label: "Fries", emoji: "🍟" },
  { value: "apple_slices", label: "Apple slices", emoji: "🍎" },
  { value: "bread", label: "Bread", emoji: "🍞" },
  { value: "kids_meal", label: "Kids meal", emoji: "🧒" },
  { value: "other", label: "Other", emoji: "🍽️" },
];

const DAYPARTS: TtfSubmission["daypart"][] = [
  "breakfast",
  "lunch",
  "dinner",
  "late",
];

function currentDaypart(): TtfSubmission["daypart"] {
  const hour = new Date().getHours();
  if (hour < 11) return "breakfast";
  if (hour < 15) return "lunch";
  if (hour < 21) return "dinner";
  return "late";
}

function formatTimer(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${min}:${sec.toString().padStart(2, "0")}`;
}

export function TtfSubmitPage() {
  const { id } = useParams<{ id: string }>();
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
  const [timerNow, setTimerNow] = useState(Date.now());

  useEffect(() => {
    if (!id) return;
    api.getRestaurant(id).then(setRestaurant);
  }, [id]);

  useEffect(() => {
    if (timerStart === null || timerStopped !== null) return;
    const interval = window.setInterval(() => setTimerNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, [timerStart, timerStopped]);

  const timerRunning = timerStart !== null && timerStopped === null;
  const timerMs =
    timerStart === null
      ? 0
      : (timerStopped ?? timerNow) - timerStart;
  const timerMinutes = Math.max(1, Math.ceil(timerMs / 60000));

  const canSubmit =
    !busy &&
    (timerStopped !== null || (timerStart === null && elapsed >= 1));

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!id || !idToken || !canSubmit) return;
    setBusy(true);
    setError(null);
    const minutes = timerStart !== null ? timerMinutes : elapsed;
    try {
      await api.submitTtf(
        id,
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
      navigate(`/restaurants/${id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Submit failed");
    } finally {
      setBusy(false);
    }
  }

  function resetTimer() {
    setTimerStart(null);
    setTimerStopped(null);
  }

  if (!restaurant) {
    return (
      <Page narrow title="Submit TTF">
        <p className="muted">Loading…</p>
      </Page>
    );
  }

  return (
    <Page
      narrow
      title="Submit TTF"
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
                <Button type="button" onClick={() => setTimerStart(Date.now())}>
                  Start timer
                </Button>
              )}
              {timerRunning && (
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setTimerStopped(Date.now())}
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

          <fieldset className="stack">
            <legend>What arrived?</legend>
            <div className="item-type-grid">
              {ITEM_TYPES.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  className={[
                    "item-type-btn",
                    itemType === item.value ? "item-type-btn--active" : "",
                  ].join(" ")}
                  onClick={() => setItemType(item.value)}
                >
                  {item.emoji} {item.label}
                </button>
              ))}
            </div>
          </fieldset>

          <label>
            Quality
            <div className="star-row" role="group" aria-label="Item quality">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  className={["star-btn", quality >= star ? "star-btn--on" : ""].join(" ")}
                  onClick={() => setQuality(star)}
                  aria-label={`${star} star${star === 1 ? "" : "s"}`}
                >
                  ★
                </button>
              ))}
            </div>
          </label>

          <label>
            Portion
            <select
              value={portion}
              onChange={(e) => setPortion(e.target.value as TtfSubmission["portion_size"])}
            >
              <option value="kid">Kid</option>
              <option value="regular">Regular</option>
              <option value="shareable">Shareable</option>
            </select>
          </label>

          <label>
            Daypart
            <select
              value={daypart}
              onChange={(e) => setDaypart(e.target.value as TtfSubmission["daypart"])}
            >
              {DAYPARTS.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </label>

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
          <Button type="submit" fullWidth disabled={!canSubmit}>
            {busy ? "Submitting…" : "Submit observation"}
          </Button>
        </form>
      </Card>
    </Page>
  );
}
