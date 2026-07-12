import { useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";

import { api } from "../api/client";
import { useAuth } from "../auth/useAuth";
import { AttributeInput } from "../components/AttributeInput";
import { BackLink } from "../components/ui/BackLink";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { ChoiceChip, ChoiceChipGroup } from "../components/ui/ChoiceChip";
import { FormField } from "../components/ui/FormField";
import { Page } from "../components/ui/Page";
import { StarRating } from "../components/ui/StarRating";
import { useToast } from "../components/ui/useToast";
import { cn } from "../lib/cn";
import { EMPTY_CONTRIBUTION_RECENCY } from "../lib/contributionRecency";
import type { TtfLogAgainPrefill } from "../lib/logItAgain";
import { restaurantDetailPath } from "../lib/mapEntryKey";
import { METRIC_CATEGORY_LABELS } from "../lib/metricCategories";
import { invalidateContributionData, invalidatePlaceEntry } from "../lib/pageDataCache";
import { TTF_DAYPARTS, TTF_ITEM_TYPES, TTF_PORTIONS } from "../lib/ttfFormOptions";
import { TTF_TIER_COLORS, type TtfTier } from "../lib/ttfTier";
import { userStorage } from "../lib/userStorage";
import type { MetricDefinition, RestaurantDetailResponse, TtfSubmission } from "../types";

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

function elapsedTier(minutes: number): TtfTier {
  if (minutes <= 8) return "fast";
  if (minutes <= 15) return "ok";
  return "slow";
}

type Ratings = Record<string, boolean | number | string | undefined>;

/** Default kids-in-party: last logged visit, else profile kids count (#84). */
function defaultPartySizeKids(): number {
  const last = userStorage.getLastVisitDefaults()?.partySizeKids;
  if (last && last >= 1) return Math.min(last, 12);
  const kidsAges = userStorage.getProfileCache()?.kidsAges?.length ?? 0;
  return kidsAges >= 1 ? Math.min(kidsAges, 12) : 1;
}

/** Collapsed-by-default optional section of the visit form (#84). */
function CollapsibleSection({
  title,
  summary,
  open,
  onToggle,
  children,
}: {
  title: string;
  summary?: string | null;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <section
      className={cn(
        "rounded-md border bg-bg transition-[border-color] duration-fast",
        summary ? "border-brand/35" : "border-border",
      )}
    >
      <button
        type="button"
        className="flex min-h-11 w-full cursor-pointer items-center justify-between gap-2 px-4 py-2.5 text-left"
        aria-expanded={open}
        onClick={onToggle}
      >
        <span className="text-sm font-semibold">
          {title}
          {summary && (
            <span className="ml-2 font-medium text-brand">{summary}</span>
          )}
        </span>
        <span aria-hidden className="text-text-muted">
          {open ? "▴" : "▾"}
        </span>
      </button>
      {open && <div className="grid gap-3 border-t border-border p-4">{children}</div>}
    </section>
  );
}

export function TtfSubmitPage() {
  const { id, placeId } = useParams<{ id?: string; placeId?: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { idToken } = useAuth();
  const { toast } = useToast();
  // "Log it again" (#87): everything but the timer and note carries over
  // from a prior visit at this restaurant.
  const prefill = (location.state as { prefill?: TtfLogAgainPrefill } | null)?.prefill;
  const [restaurant, setRestaurant] = useState<RestaurantDetailResponse | null>(null);
  const [elapsed, setElapsed] = useState(12);
  const [itemType, setItemType] = useState<TtfSubmission["item_type"]>(prefill?.itemType ?? "fries");
  const [quality, setQuality] = useState(4);
  const [portion, setPortion] = useState<TtfSubmission["portion_size"]>(prefill?.portionSize ?? "kid");
  const [daypart, setDaypart] = useState<TtfSubmission["daypart"]>(currentDaypart());
  const [kids, setKids] = useState(() => prefill?.partySizeKids ?? defaultPartySizeKids());
  const [context, setContext] = useState(prefill?.waitContext ?? "");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [timerStart, setTimerStart] = useState<number | null>(null);
  const [timerStopped, setTimerStopped] = useState<number | null>(null);
  const [timerNow, setTimerNow] = useState(() => Date.now());

  // Optional visit extras (#84): collapsible attribute ratings + note.
  // Prior ratings prefill open (#87); the note always starts empty.
  const [showRatings, setShowRatings] = useState(
    () => Object.keys(prefill?.ratings ?? {}).length > 0,
  );
  const [showNote, setShowNote] = useState(false);
  const [metrics, setMetrics] = useState<MetricDefinition[] | null>(null);
  const [ratings, setRatings] = useState<Ratings>(() => ({ ...prefill?.ratings }));
  const [note, setNote] = useState("");
  // Parts already saved by a previous partially-failed submit, so a retry
  // never double-posts (each part hits its own existing moderated route).
  const savedParts = useRef({
    restaurantId: null as string | null,
    ttf: false,
    attrs: new Set<string>(),
    note: false,
  });

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

  // Lazy-load metric definitions the first time the ratings section opens.
  useEffect(() => {
    if (!showRatings || metrics !== null) return;
    api.listMetrics().then(setMetrics).catch(() => setMetrics([]));
  }, [showRatings, metrics]);

  const groupedMetrics = useMemo(() => {
    const map = new Map<string, MetricDefinition[]>();
    for (const metric of metrics ?? []) {
      const list = map.get(metric.category) ?? [];
      list.push(metric);
      map.set(metric.category, list);
    }
    return map;
  }, [metrics]);

  const changedRatings = (metrics ?? []).filter((m) => ratings[m.key] !== undefined);
  const noteText = note.trim();

  const timerRunning = timerStart !== null && timerStopped === null;
  const timerMs =
    timerStart === null
      ? 0
      : Math.max(0, (timerStopped ?? timerNow) - timerStart);
  const timerMinutes = Math.max(1, Math.ceil(timerMs / 60000));
  const displayMinutes = timerStart !== null ? timerMinutes : elapsed;
  const timerTier = elapsedTier(displayMinutes);
  const timerColor = TTF_TIER_COLORS[timerTier];

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
    const saved = savedParts.current;
    try {
      let restaurantId = id ?? saved.restaurantId;
      if (!restaurantId && placeId) {
        const materialized = await api.materializePlace(placeId, idToken);
        restaurantId = materialized.restaurant.id;
        invalidatePlaceEntry(placeId);
      }
      if (!restaurantId) throw new Error("Restaurant not found");
      saved.restaurantId = restaurantId;

      // Sequential calls to the existing routes so each content type keeps
      // its own moderation gate; savedParts makes a retry finish the rest.
      if (!saved.ttf) {
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
        saved.ttf = true;
        userStorage.setLastVisitDefaults({ partySizeKids: kids });
      }
      for (const metric of changedRatings) {
        const value = ratings[metric.key];
        if (value === undefined || saved.attrs.has(metric.key)) continue;
        await api.submitAttribute(restaurantId, metric.key, value, idToken);
        saved.attrs.add(metric.key);
      }
      let notePending = false;
      if (noteText && !saved.note) {
        const created = await api.submitNote(restaurantId, noteText, idToken);
        saved.note = true;
        notePending = Boolean(created.pending_review);
      }

      invalidateContributionData(restaurantId);
      const parts = ["Visit logged"];
      if (saved.attrs.size > 0) {
        parts.push(`${saved.attrs.size} rating${saved.attrs.size === 1 ? "" : "s"}`);
      }
      if (saved.note) parts.push(notePending ? "note (pending review)" : "note");
      toast(`${parts.join(" + ")} — thanks!`, "success");
      navigate(restaurantDetailPath({ id: restaurantId }), { viewTransition: true });
    } catch (err) {
      const done: string[] = [];
      if (saved.ttf) done.push("timing");
      if (saved.attrs.size > 0) {
        done.push(`${saved.attrs.size} rating${saved.attrs.size === 1 ? "" : "s"}`);
      }
      const message = err instanceof Error ? err.message : "Submit failed";
      setError(
        done.length > 0
          ? `${message} — ${done.join(" and ")} saved; submit again to finish the rest.`
          : message,
      );
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
        <p className="text-text-muted">Loading…</p>
      </Page>
    );
  }

  return (
    <Page
      narrow
      title="Submit observation"
      subtitle={restaurant.restaurant.name}
      back={
        <BackLink
          to={restaurantDetailPath({
            id: id ?? restaurant.restaurant.id,
            google_place_id: placeId ?? restaurant.restaurant.google_place_id,
          })}
        >
          ← Back
        </BackLink>
      }
    >
      <Card className="pb-0 md:pb-[var(--spacing-6)]">
        <form className="grid gap-3" onSubmit={handleSubmit}>
          {prefill && (
            <p className="m-0 rounded-md bg-brand-soft px-3 py-2 text-xs text-text-muted">
              Prefilled from your last visit here — the timer and note always start fresh.
            </p>
          )}
          <div
            className="grid gap-3 rounded-md bg-brand-soft p-4 text-center motion-reduce:transition-none"
            style={{
              boxShadow: timerStart !== null
                ? `inset 0 0 0 2px color-mix(in srgb, ${timerColor} 35%, transparent)`
                : undefined,
            }}
          >
            <p className="text-sm text-text-muted">Time from order to kid food on the table</p>
            <div
              className="font-display text-5xl font-bold leading-none md:text-4xl"
              style={{ color: timerStart !== null ? timerColor : undefined }}
              aria-live="polite"
            >
              {timerStart === null ? "0:00" : formatTimer(timerMs)}
            </div>
            {timerStart !== null && (
              <p className="m-0 text-xs font-semibold" style={{ color: timerColor }}>
                {timerTier === "fast" && "Still in the fast zone"}
                {timerTier === "ok" && "OK territory"}
                {timerTier === "slow" && "Hang in there — you're earning this data point"}
              </p>
            )}
            <div className="flex flex-wrap justify-center gap-2">
              {timerStart === null && (
                <Button type="button" className="min-h-11" onClick={startTimer}>
                  Start timer
                </Button>
              )}
              {timerRunning && (
                <Button
                  type="button"
                  variant="secondary"
                  className="min-h-11"
                  onClick={stopTimer}
                >
                  Stop ({timerMinutes} min)
                </Button>
              )}
              {timerStart !== null && (
                <Button type="button" variant="ghost" className="min-h-11" onClick={resetTimer}>
                  Reset
                </Button>
              )}
            </div>
          </div>

          {!timerRunning && timerStart === null && (
            <FormField label="Or enter elapsed minutes">
              <input
                type="number"
                min={1}
                max={180}
                value={elapsed}
                onChange={(e) => setElapsed(Number(e.target.value))}
              />
            </FormField>
          )}

          <fieldset className="field-group grid gap-2">
            <legend className="text-sm font-semibold">What arrived?</legend>
            <ChoiceChipGroup columns={2}>
              {TTF_ITEM_TYPES.map((item) => (
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

          <div className="grid gap-2">
            <span className="text-sm font-semibold">Quality</span>
            <StarRating value={quality} onChange={setQuality} label="Item quality" />
          </div>

          <fieldset className="field-group grid gap-2">
            <legend className="text-sm font-semibold">Portion</legend>
            <ChoiceChipGroup columns={3}>
              {TTF_PORTIONS.map((opt) => (
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

          <fieldset className="field-group grid gap-2">
            <legend className="text-sm font-semibold">Daypart</legend>
            <ChoiceChipGroup columns={2}>
              {TTF_DAYPARTS.map((opt) => (
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

          <FormField label="Kids in party">
            <input
              type="number"
              min={1}
              max={12}
              value={kids}
              onChange={(e) => setKids(Number(e.target.value))}
            />
          </FormField>

          <FormField label="Context (optional)">
            <textarea
              value={context}
              onChange={(e) => setContext(e.target.value)}
              rows={2}
              placeholder="Busy Saturday lunch, high chair requested…"
            />
          </FormField>

          <CollapsibleSection
            title="Rate attributes"
            summary={
              changedRatings.length > 0
                ? `${changedRatings.length} selected`
                : null
            }
            open={showRatings}
            onToggle={() => setShowRatings((v) => !v)}
          >
            {metrics === null ? (
              <p className="m-0 text-sm text-text-muted">Loading attributes…</p>
            ) : metrics.length === 0 ? (
              <p className="m-0 text-sm text-text-muted">No attributes available.</p>
            ) : (
              [...groupedMetrics.entries()].map(([category, items]) => (
                <section key={category} className="grid gap-2">
                  <h3 className="m-0 text-xs font-semibold uppercase tracking-wide text-text-muted">
                    {METRIC_CATEGORY_LABELS[category] ?? category}
                  </h3>
                  {items.map((metric) => (
                    <div key={metric.key} className="grid gap-1.5">
                      <span className="text-sm font-semibold">{metric.label}</span>
                      <AttributeInput
                        metric={metric}
                        value={ratings[metric.key]}
                        onChange={(value) =>
                          setRatings((prev) => ({ ...prev, [metric.key]: value }))
                        }
                      />
                    </div>
                  ))}
                </section>
              ))
            )}
          </CollapsibleSection>

          <CollapsibleSection
            title="Add a note"
            summary={noteText ? "1 note" : null}
            open={showNote}
            onToggle={() => setShowNote((v) => !v)}
          >
            <label className="m-0">
              <span className="sr-only">Note</span>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={3}
                maxLength={2000}
                placeholder="Anything other parents should know about this visit…"
              />
            </label>
          </CollapsibleSection>

          {error && <p className="text-sm font-semibold text-error">{error}</p>}
          {submitHint && <p className="m-0 text-xs text-warning">{submitHint}</p>}
          <div className="sticky bottom-0 -mx-5 border-t border-border bg-surface px-5 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom,0px))] md:static md:mx-0 md:border-0 md:bg-transparent md:p-0">
            <Button type="submit" fullWidth className="min-h-11" disabled={!canSubmit}>
              {busy
                ? "Submitting…"
                : changedRatings.length > 0 || noteText
                  ? "Log visit"
                  : "Submit observation"}
            </Button>
          </div>
        </form>
      </Card>
    </Page>
  );
}
