import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import { api } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import type { RestaurantDetailResponse, TtfSubmission } from "../types";

const ITEM_TYPES: TtfSubmission["item_type"][] = [
  "fries",
  "apple_slices",
  "bread",
  "kids_meal",
  "other",
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

export function TtfSubmitPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { idToken } = useAuth();
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
  const [timerElapsed, setTimerElapsed] = useState(0);

  useEffect(() => {
    if (!id) return;
    api.getRestaurant(id).then(setRestaurant);
  }, [id]);

  useEffect(() => {
    if (timerStart === null) return;
    const tick = () => setTimerElapsed(Math.floor((Date.now() - timerStart) / 60000));
    tick();
    const id = window.setInterval(tick, 5000);
    return () => window.clearInterval(id);
  }, [timerStart]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!id || !idToken) return;
    setBusy(true);
    setError(null);
    const minutes = timerStart !== null ? Math.max(1, timerElapsed) : elapsed;
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
      navigate(`/restaurants/${id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Submit failed");
    } finally {
      setBusy(false);
    }
  }

  if (!restaurant) {
    return (
      <main className="page narrow">
        <p className="muted">Loading…</p>
      </main>
    );
  }

  return (
    <main className="page narrow">
      <Link to={`/restaurants/${id}`} className="back">
        ← {restaurant.restaurant.name}
      </Link>
      <h1>Submit TTF</h1>
      <form className="card" onSubmit={handleSubmit}>
        <div className="timer-row">
          <button
            type="button"
            className="button secondary"
            onClick={() => setTimerStart(Date.now())}
          >
            Start timer
          </button>
          {timerStart !== null && (
            <span>
              Timer: <strong>{Math.max(1, timerElapsed)}</strong> min
            </span>
          )}
        </div>
        <label>
          Elapsed minutes (if not using timer)
          <input
            type="number"
            min={1}
            max={180}
            value={elapsed}
            onChange={(e) => setElapsed(Number(e.target.value))}
            disabled={timerStart !== null}
          />
        </label>
        <label>
          Item
          <select value={itemType} onChange={(e) => setItemType(e.target.value as TtfSubmission["item_type"])}>
            {ITEM_TYPES.map((t) => (
              <option key={t} value={t}>
                {t.replace("_", " ")}
              </option>
            ))}
          </select>
        </label>
        <label>
          Quality (1–5)
          <input
            type="range"
            min={1}
            max={5}
            value={quality}
            onChange={(e) => setQuality(Number(e.target.value))}
          />
          <span>{quality}</span>
        </label>
        <label>
          Portion
          <select value={portion} onChange={(e) => setPortion(e.target.value as TtfSubmission["portion_size"])}>
            <option value="kid">Kid</option>
            <option value="regular">Regular</option>
            <option value="shareable">Shareable</option>
          </select>
        </label>
        <label>
          Daypart
          <select value={daypart} onChange={(e) => setDaypart(e.target.value as TtfSubmission["daypart"])}>
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
          <textarea value={context} onChange={(e) => setContext(e.target.value)} rows={2} />
        </label>
        {error && <p className="error">{error}</p>}
        <button type="submit" className="button" disabled={busy}>
          {busy ? "Submitting…" : "Submit"}
        </button>
      </form>
    </main>
  );
}
