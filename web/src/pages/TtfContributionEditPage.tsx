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
import type { TtfSubmission, UserTtfContribution } from "../types";

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

const backLinkClass =
  "mb-4 inline-flex items-center gap-1 text-sm font-semibold text-text-muted transition-colors duration-fast hover:text-brand";

export function TtfContributionEditPage() {
  const { observationId } = useParams<{ observationId: string }>();
  const navigate = useNavigate();
  const { idToken } = useAuth();
  const { toast } = useToast();
  const [observation, setObservation] = useState<UserTtfContribution | null>(null);
  const [elapsed, setElapsed] = useState(12);
  const [itemType, setItemType] = useState<TtfSubmission["item_type"]>("fries");
  const [quality, setQuality] = useState(4);
  const [portion, setPortion] = useState<TtfSubmission["portion_size"]>("kid");
  const [daypart, setDaypart] = useState<TtfSubmission["daypart"]>("lunch");
  const [kids, setKids] = useState(1);
  const [context, setContext] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!observationId || !idToken) return;
    api
      .getMyTtf(observationId, idToken)
      .then((row) => {
        setObservation(row);
        setElapsed(row.elapsed_minutes);
        setItemType(row.item_type);
        setQuality(row.item_quality);
        setPortion(row.portion_size);
        setDaypart(row.daypart);
        setKids(row.party_size_kids);
        setContext(row.wait_context ?? "");
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Load failed"))
      .finally(() => setLoading(false));
  }, [observationId, idToken]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!observationId || !idToken || elapsed < 1) return;
    setBusy(true);
    setError(null);
    try {
      await api.updateMyTtf(
        observationId,
        {
          elapsed_minutes: elapsed,
          item_type: itemType,
          item_quality: quality,
          portion_size: portion,
          daypart,
          party_size_kids: kids,
          wait_context: context.trim() || undefined,
        },
        idToken,
      );
      toast("Observation updated", "success");
      navigate("/account/contributions");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <Page narrow title="Edit observation">
        <p className="text-text-muted">Loading…</p>
      </Page>
    );
  }

  if (error && !observation) {
    return (
      <Page
        narrow
        title="Edit observation"
        back={
          <Link to="/account/contributions" className={backLinkClass}>
            ← Your contributions
          </Link>
        }
      >
        <p className="text-sm font-semibold text-error">{error}</p>
      </Page>
    );
  }

  if (!observation) return null;

  return (
    <Page
      narrow
      title="Edit observation"
      subtitle={observation.restaurant_name}
      back={
        <Link to="/account/contributions" className={backLinkClass}>
          ← Your contributions
        </Link>
      }
    >
      <Card>
        <form className="grid gap-3" onSubmit={handleSubmit}>
          <label>
            Elapsed minutes
            <input
              type="number"
              min={1}
              max={180}
              value={elapsed}
              onChange={(e) => setElapsed(Number(e.target.value))}
            />
          </label>

          <fieldset className="field-group grid gap-2">
            <legend className="text-sm font-semibold">What arrived?</legend>
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

          <div className="grid gap-2">
            <span className="text-sm font-semibold">Quality</span>
            <StarRating value={quality} onChange={setQuality} label="Item quality" />
          </div>

          <fieldset className="field-group grid gap-2">
            <legend className="text-sm font-semibold">Portion</legend>
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

          <fieldset className="field-group grid gap-2">
            <legend className="text-sm font-semibold">Daypart</legend>
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

          {error && <p className="text-sm font-semibold text-error">{error}</p>}
          <Button type="submit" fullWidth disabled={busy || elapsed < 1}>
            {busy ? "Saving…" : "Save changes"}
          </Button>
        </form>
      </Card>
    </Page>
  );
}
