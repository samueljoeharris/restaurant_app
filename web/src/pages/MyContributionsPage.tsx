import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { api } from "../api/client";
import { useAuth } from "../auth/useAuth";
import { AttributeInput } from "../components/AttributeInput";
import { BackLink } from "../components/ui/BackLink";
import { Badge } from "../components/ui/Badge";
import { Button, ButtonLink } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { EmptyState } from "../components/ui/EmptyState";
import { Page } from "../components/ui/Page";
import { useToast } from "../components/ui/useToast";
import { useCachedResource } from "../hooks/useCachedResource";
import { restaurantDetailPath } from "../lib/mapEntryKey";
import { invalidateContributionData } from "../lib/pageDataCache";
import type {
  MetricDefinition,
  UserAttributeContribution,
  UserContribution,
  UserNoteContribution,
} from "../types";

type KindFilter = "all" | "ttf" | "attribute" | "note";

const FILTERS: { value: KindFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "ttf", label: "Speed" },
  { value: "attribute", label: "Ratings" },
  { value: "note", label: "Notes" },
];

const KIND_LABELS: Record<UserContribution["kind"], string> = {
  ttf: "Speed",
  attribute: "Rating",
  note: "Note",
};

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatItemType(value: string): string {
  return value.replace(/_/g, " ");
}

function formatAttributeValue(value: boolean | number | string): string {
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "number") return String(value);
  return value.replace(/_/g, " ");
}

function contributionSummary(item: UserContribution): string {
  if (item.kind === "ttf") {
    return `${item.elapsed_minutes} min · ${formatItemType(item.item_type)} · ${item.item_quality}/5`;
  }
  if (item.kind === "attribute") {
    return `${item.metric_label}: ${formatAttributeValue(item.value)}`;
  }
  const preview = item.text.length > 120 ? `${item.text.slice(0, 120)}…` : item.text;
  return preview;
}

export function MyContributionsPage() {
  const { idToken } = useAuth();
  const { toast } = useToast();
  const [filter, setFilter] = useState<KindFilter>("all");
  const [metrics, setMetrics] = useState<MetricDefinition[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editNoteText, setEditNoteText] = useState("");
  const [editAttributeValue, setEditAttributeValue] = useState<boolean | number | string | undefined>();
  const [busyId, setBusyId] = useState<string | null>(null);

  const { data, loading, error, refresh } = useCachedResource<{
    items: UserContribution[];
    total: number;
  }>(
    idToken ? `contributions:${filter}` : null,
    async () => {
      const kind = filter === "all" ? undefined : filter;
      const res = await api.listMyContributions(idToken!, { kind, limit: 100 });
      return { items: res.items, total: res.total };
    },
  );
  const items = data?.items ?? [];
  const total = data?.total ?? 0;

  useEffect(() => {
    if (!idToken) return;
    let cancelled = false;
    api
      .listMetrics()
      .then((metricList) => {
        if (!cancelled) setMetrics(metricList);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [idToken]);

  async function reload(restaurantId: string) {
    // Edits touch every filter view plus the restaurant's cached detail
    // aggregates, so drop them all before refetching.
    invalidateContributionData(restaurantId);
    await refresh();
  }

  const metricsByKey = useMemo(
    () => new Map(metrics.map((m) => [m.key, m])),
    [metrics],
  );

  function startEditNote(item: UserNoteContribution) {
    setEditingId(item.id);
    setEditNoteText(item.text);
    setEditAttributeValue(undefined);
  }

  function startEditAttribute(item: UserAttributeContribution) {
    setEditingId(item.id);
    setEditAttributeValue(item.value);
    setEditNoteText("");
  }

  function cancelEdit() {
    setEditingId(null);
    setEditNoteText("");
    setEditAttributeValue(undefined);
  }

  async function saveNote(item: UserNoteContribution) {
    if (!idToken || !editNoteText.trim()) return;
    setBusyId(item.id);
    try {
      await api.updateMyNote(item.id, editNoteText.trim(), idToken, item.tags);
      toast("Note updated", "success");
      cancelEdit();
      await reload(item.restaurant_id);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Update failed", "error");
    } finally {
      setBusyId(null);
    }
  }

  async function saveAttribute(item: UserAttributeContribution) {
    if (!idToken || editAttributeValue === undefined) return;
    setBusyId(item.id);
    try {
      await api.updateMyAttribute(item.id, editAttributeValue, idToken);
      toast("Rating updated", "success");
      cancelEdit();
      await reload(item.restaurant_id);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Update failed", "error");
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(item: UserContribution) {
    if (!idToken) return;
    const label = KIND_LABELS[item.kind].toLowerCase();
    if (!window.confirm(`Delete this ${label}? This cannot be undone.`)) return;
    setBusyId(item.id);
    try {
      if (item.kind === "ttf") await api.deleteMyTtf(item.id, idToken);
      else if (item.kind === "attribute") await api.deleteMyAttribute(item.id, idToken);
      else await api.deleteMyNote(item.id, idToken);
      toast(`${KIND_LABELS[item.kind]} deleted`, "success");
      if (editingId === item.id) cancelEdit();
      await reload(item.restaurant_id);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Delete failed", "error");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Page
      title="Your contributions"
      subtitle="View, edit, or remove your speed observations, ratings, and notes."
      back={
        <BackLink to="/account">
          ← Account
        </BackLink>
      }
    >
      <div className="mb-4 flex flex-wrap gap-2">
        {FILTERS.map((opt) => (
          <Button
            key={opt.value}
            type="button"
            size="sm"
            variant={filter === opt.value ? "primary" : "secondary"}
            onClick={() => setFilter(opt.value)}
          >
            {opt.label}
          </Button>
        ))}
      </div>

      {loading && <p className="text-text-muted">Loading…</p>}
      {error && <p className="text-sm font-semibold text-error">{error}</p>}

      {!loading && !error && items.length === 0 && (
        <EmptyState
          emoji="📝"
          title="Nothing here yet"
          description="Your speed observations, parent ratings, and notes will show up here."
          actionLabel="Explore restaurants"
          actionTo="/map"
        />
      )}

      {!loading && !error && items.length > 0 && (
        <p className="text-sm text-text-muted">
          {total} contribution{total === 1 ? "" : "s"}
          {filter !== "all" ? ` · filtered` : ""}
        </p>
      )}

      <ul className="m-0 grid list-none gap-3 p-0">
        {items.map((item) => {
          const isEditing = editingId === item.id;
          const isBusy = busyId === item.id;

          return (
            <li key={`${item.kind}-${item.id}`}>
              <Card>
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="mb-2 flex items-center gap-2">
                      <Badge variant="neutral">{KIND_LABELS[item.kind]}</Badge>
                      <time className="text-sm text-text-muted">{fmtDate(item.submitted_at)}</time>
                    </div>
                    <Link
                      to={restaurantDetailPath({ id: item.restaurant_id })}
                      className="mb-1 inline-block font-semibold text-brand"
                    >
                      {item.restaurant_name}
                    </Link>
                    {!isEditing && (
                      <p className="m-0 text-sm text-text-muted">{contributionSummary(item)}</p>
                    )}
                  </div>

                  <div className="flex shrink-0 gap-2">
                    {item.kind === "ttf" && !isEditing && (
                      <ButtonLink
                        to={`/account/contributions/ttf/${item.id}/edit`}
                        size="sm"
                        variant="secondary"
                      >
                        Edit
                      </ButtonLink>
                    )}
                    {item.kind === "attribute" && !isEditing && (
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        onClick={() => startEditAttribute(item)}
                      >
                        Edit
                      </Button>
                    )}
                    {item.kind === "note" && !isEditing && (
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        onClick={() => startEditNote(item)}
                      >
                        Edit
                      </Button>
                    )}
                    {!isEditing && (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        disabled={isBusy}
                        onClick={() => handleDelete(item)}
                      >
                        Delete
                      </Button>
                    )}
                  </div>
                </div>

                {isEditing && item.kind === "note" && (
                  <form
                    className="mt-4 grid gap-3 border-t border-border pt-4"
                    onSubmit={(e) => {
                      e.preventDefault();
                      saveNote(item);
                    }}
                  >
                    <label>
                      Edit note
                      <textarea
                        value={editNoteText}
                        onChange={(e) => setEditNoteText(e.target.value)}
                        rows={4}
                        maxLength={2000}
                        required
                      />
                    </label>
                    <div className="grid gap-2">
                      <Button type="submit" disabled={isBusy || !editNoteText.trim()}>
                        {isBusy ? "Saving…" : "Save"}
                      </Button>
                      <Button type="button" variant="ghost" onClick={cancelEdit}>
                        Cancel
                      </Button>
                    </div>
                  </form>
                )}

                {isEditing && item.kind === "attribute" && (
                  <div className="mt-4 grid gap-3 border-t border-border pt-4">
                    <p className="text-sm">
                      <strong>{item.metric_label}</strong>
                    </p>
                    {metricsByKey.get(item.metric_key) ? (
                      <AttributeInput
                        metric={metricsByKey.get(item.metric_key)!}
                        value={editAttributeValue}
                        onChange={setEditAttributeValue}
                      />
                    ) : (
                      <p className="text-sm text-text-muted">This metric is no longer available.</p>
                    )}
                    <div className="grid gap-2">
                      <Button
                        type="button"
                        disabled={isBusy || editAttributeValue === undefined}
                        onClick={() => saveAttribute(item)}
                      >
                        {isBusy ? "Saving…" : "Save"}
                      </Button>
                      <Button type="button" variant="ghost" onClick={cancelEdit}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}
              </Card>
            </li>
          );
        })}
      </ul>
    </Page>
  );
}
