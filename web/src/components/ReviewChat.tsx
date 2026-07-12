import { useCallback, useEffect, useRef, useState, startTransition } from "react";
import { Link, useNavigate } from "react-router-dom";

import { api } from "../api/client";
import { useAuth } from "../auth/useAuth";
import { authErrorMessage } from "../auth/errors";
import { cn } from "../lib/cn";
import { restaurantDetailPath } from "../lib/mapEntryKey";
import { invalidateContributionData, invalidatePlaceEntry } from "../lib/pageDataCache";
import { Button } from "./ui/Button";
import { Card } from "./ui/Card";
import { useToast } from "./ui/useToast";
import {
  draftReadinessLabel,
  draftReadinessTier,
  extractContributionDraft,
  reviewChatAvailable,
  sendReviewChatMessage,
  type ChatMessage,
  type DraftReadinessTier,
} from "../lib/reviewChat";
import type { ContributionDraft, ContributionPreviewResponse, ContributionSchema } from "../types";

type ReviewChatProps = {
  restaurantName: string;
  restaurantId?: string;
  placeId?: string;
  /**
   * "inline" (default) stacks the extracted draft below the chat. "sidebar"
   * (agent-first Log a visit, #100) renders the chat left with the draft in a
   * right rail on md+, collapsing to a "Your draft" disclosure on mobile.
   */
  layout?: "inline" | "sidebar";
};

function formatReviewField(field: unknown): string {
  if (typeof field === "string") return field;
  if (field && typeof field === "object") {
    const obj = field as Record<string, unknown>;
    for (const key of ["field", "name", "key", "path", "metric_key"]) {
      const value = obj[key];
      if (typeof value === "string") return value;
    }
  }
  return String(field);
}

export function ReviewChat({ restaurantId, placeId, restaurantName, layout = "inline" }: ReviewChatProps) {
  const navigate = useNavigate();
  const { idToken } = useAuth();
  const { toast } = useToast();
  const [schema, setSchema] = useState<ContributionSchema | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      text: "Want to tell me about your visit in your own words? I'll turn it into kid food speed, parent ratings, and notes for other families.",
    },
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [preview, setPreview] = useState<ContributionPreviewResponse | null>(null);
  const [extractSummary, setExtractSummary] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  // Live extraction (#122) runs after every assistant turn. These refs make sure
  // rapid turns don't fire overlapping requests: while one is in flight, the next
  // turn's messages are stashed and re-run trailing-edge once it settles, and a
  // sequence number guards against a stale response clobbering a newer draft.
  const extractInFlightRef = useRef(false);
  const extractSeqRef = useRef(0);
  const pendingExtractRef = useRef<ChatMessage[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    api
      .getContributionSchema()
      .then((data) => {
        if (!cancelled) setSchema(data);
      })
      .catch((err) => {
        if (!cancelled) {
          startTransition(() => {
            setError(err instanceof Error ? err.message : "Could not load review schema.");
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, preview]);

  // Runs extraction + preview for a completed assistant turn. Serialized via
  // extractInFlightRef so overlapping turns never fire concurrent requests: a
  // turn that arrives mid-flight is stashed in pendingExtractRef and picked up
  // by the loop below (trailing-edge, with the latest messages) once the
  // in-flight call settles — no recursive self-call, so React Compiler can
  // still memoize this callback.
  const runExtraction = useCallback(
    async (msgs: ChatMessage[]) => {
      if (!schema || !idToken || msgs.length < 2 || (!restaurantId && !placeId)) return;
      if (extractInFlightRef.current) {
        pendingExtractRef.current = msgs;
        return;
      }
      extractInFlightRef.current = true;
      setExtracting(true);
      let next: ChatMessage[] | null = msgs;
      try {
        while (next) {
          const current = next;
          next = null;
          const seq = ++extractSeqRef.current;
          try {
            const extracted = await extractContributionDraft(current, idToken);
            const result = placeId
              ? await api.previewPlaceContributions(placeId, extracted.draft, idToken)
              : await api.previewContributions(restaurantId!, extracted.draft, idToken);
            if (seq === extractSeqRef.current) {
              setExtractSummary(extracted.summary);
              setPreview(result);
            }
          } catch (err) {
            if (seq === extractSeqRef.current) {
              setError(err instanceof Error ? err.message : "Draft extraction failed.");
            }
          }
          if (pendingExtractRef.current) {
            next = pendingExtractRef.current;
            pendingExtractRef.current = null;
          }
        }
      } finally {
        extractInFlightRef.current = false;
        setExtracting(false);
      }
    },
    [schema, idToken, restaurantId, placeId],
  );

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || busy || !idToken || !schema) return;

    const nextMessages: ChatMessage[] = [...messages, { role: "user", text }];
    setInput("");
    setBusy(true);
    setError(null);
    setMessages(nextMessages);
    try {
      const reply = await sendReviewChatMessage(restaurantName, nextMessages, idToken);
      const updatedMessages: ChatMessage[] = [...nextMessages, { role: "assistant", text: reply }];
      setMessages(updatedMessages);
      // Live extraction (#122): runs automatically after every assistant turn
      // instead of waiting for a manual "Preview submission" tap. Runs in the
      // background (its own `extracting` flag) so the composer stays usable.
      void runExtraction(updatedMessages);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Chat failed.");
    } finally {
      setBusy(false);
    }
  }, [input, busy, idToken, schema, messages, restaurantName, runExtraction]);

  async function handleSubmit() {
    if (!preview?.ready_to_submit || !idToken || (!restaurantId && !placeId)) return;
    setBusy(true);
    setError(null);
    try {
      if (placeId) {
        const result = await api.submitPlaceContributions(placeId, preview.draft, idToken);
        invalidatePlaceEntry(placeId);
        const entry = await api.getPlaceEntry(placeId, idToken);
        invalidateContributionData(entry.id);
        toast(
          result.pending_review
            ? "Review submitted for moderation — thanks for helping other families!"
            : "Review saved — thanks for helping other families!",
          "success",
        );
        if (entry.id) {
          navigate(restaurantDetailPath(entry), { viewTransition: true });
        }
        return;
      }
      const result = await api.submitContributions(restaurantId!, preview.draft, idToken);
      invalidateContributionData(restaurantId);
      toast(
        result.pending_review
          ? "Review submitted for moderation — thanks for helping other families!"
          : "Review saved — thanks for helping other families!",
        "success",
      );
      setPreview(null);
      setExtractSummary(null);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          text: "All set — your review is live on this restaurant. Anything else from your visit?",
        },
      ]);
    } catch (err) {
      setError(authErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  if (!reviewChatAvailable()) {
    return (
      <Card title="Review assistant" subtitle="Freeform review → structured ratings">
        <p className="text-sm text-text-muted">
          Set <code>VITE_ENABLE_REVIEW_CHAT=true</code> in <code>web/.env.local</code> to enable
          the review assistant.
        </p>
      </Card>
    );
  }

  if (!idToken) {
    return (
      <Card title="Review assistant" subtitle="Freeform review → structured ratings">
        <p className="text-sm text-text-muted">
          <Link to="/login">Sign in</Link> to chat through your visit and submit ratings.
        </p>
      </Card>
    );
  }

  const messageList = (
    <div
      className="flex max-h-80 min-h-[min(50dvh,20rem)] flex-col gap-2 overflow-y-auto overscroll-contain rounded-md bg-surface-muted p-2 md:min-h-0"
      ref={scrollRef}
    >
      {messages.map((message, index) => (
        <div
          key={`${message.role}-${index}`}
          className={cn(
            "max-w-[92%] rounded-tl-md rounded-tr-md px-3 py-2 text-sm leading-normal whitespace-pre-wrap",
            message.role === "assistant"
              ? "self-start rounded-br-md rounded-bl-[4px] border border-border bg-surface"
              : "self-end rounded-bl-md rounded-br-[4px] border border-brand/25 bg-brand-soft",
          )}
        >
          {message.text}
        </div>
      ))}
      {busy && (
        <div className="max-w-[92%] self-start rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-muted">
          Thinking…
        </div>
      )}
    </div>
  );

  const composer = (
    <div>
      <textarea
        className="w-full resize-y"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        rows={3}
        placeholder="We waited about 10 minutes for apple slices… stroller was easy…"
        disabled={busy || !schema}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            void sendMessage();
          }
        }}
      />
      <div className="mt-2 flex justify-end gap-2">
        <Button type="button" onClick={() => void sendMessage()} disabled={busy || !input.trim() || !schema}>
          Send
        </Button>
      </div>
    </div>
  );

  const errorLine = error ? <p className="text-sm font-semibold text-error">{error}</p> : null;

  // Extracted draft — rendered inline below the chat, or in the sidebar rail.
  // Live extraction (#122) fills this in automatically as the conversation
  // progresses; the card's tone/header track draftReadinessTier so it visibly
  // moves through empty -> amber ("N to add") -> green ("Ready").
  const tier = draftReadinessTier(preview);
  const headerLabel = draftReadinessLabel(preview);
  const tierClassName: Record<DraftReadinessTier, string> = {
    empty: "border-border bg-surface",
    pending: "border-warning/30 bg-warning-soft",
    ready: "border-success/30 bg-success-soft",
  };

  const draftPanel = (
    <div className={cn("flex flex-col gap-3 rounded-md border p-3 text-sm", tierClassName[tier])}>
      <div className="flex items-center justify-between gap-2">
        <p className="font-semibold">{headerLabel}</p>
        {extracting && <span className="text-xs font-medium text-text-muted">Updating…</span>}
      </div>
      {preview ? (
        <>
          {extractSummary && <p className="rounded-md bg-surface/60 p-3">{extractSummary}</p>}
          <DraftSummary draft={preview.draft} />
          {preview.missing_required.length > 0 && (
            <div className="mb-2">
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-warning">Still needed</p>
              <ul className="pl-4 text-warning">
                {preview.missing_required.map((field, index) => {
                  const label = formatReviewField(field);
                  return <li key={`${label}-${index}`}>{label}</li>;
                })}
              </ul>
            </div>
          )}
          {preview.errors.length > 0 && (
            <div className="mb-2">
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-error">Fix these</p>
              <ul className="pl-4 text-error">
                {preview.errors.map((err, index) => {
                  const label = formatReviewField(err);
                  return <li key={`${label}-${index}`}>{label}</li>;
                })}
              </ul>
            </div>
          )}
          {preview.ready_to_submit && (
            <Button type="button" onClick={handleSubmit} disabled={busy} fullWidth>
              {busy ? "Submitting…" : "Submit review"}
            </Button>
          )}
        </>
      ) : (
        <p className="text-text-muted">Fields appear here as you chat — no need to tap anything.</p>
      )}
    </div>
  );

  if (layout === "inline") {
    return (
      <Card title="Review assistant" subtitle="Describe your visit — we'll fill in the right fields">
        <div className="flex flex-col gap-3">
          {messageList}
          {draftPanel}
          {errorLine}
          {composer}
        </div>
      </Card>
    );
  }

  const badgeToneClassName: Record<DraftReadinessTier, string> = {
    empty: "text-text-muted",
    pending: "text-warning",
    ready: "text-success",
  };

  return (
    <div className="grid items-start gap-4 md:grid-cols-[1fr_20rem]">
      <Card title="Tell me about your visit" subtitle="I'll turn it into the right fields as we chat">
        <div className="flex flex-col gap-3">
          {messageList}
          {errorLine}
          {composer}
        </div>
      </Card>

      {/* Desktop rail (md+) — draftPanel is itself the card, so its readiness tone/border is the rail. */}
      <aside className="hidden md:sticky md:top-4 md:block">{draftPanel}</aside>

      {/* Mobile disclosure — stacks under the chat, opens once a draft exists */}
      <details className="rounded-lg border border-border bg-surface md:hidden" open={Boolean(preview)}>
        <summary className="min-h-11 cursor-pointer px-4 py-2.5 text-sm font-semibold">
          Your draft
          {preview && (
            <span className={cn("ml-2 font-medium", badgeToneClassName[tier])}>{headerLabel}</span>
          )}
        </summary>
        <div className="border-t border-border p-4">{draftPanel}</div>
      </details>
    </div>
  );
}

function DraftSummary({ draft }: { draft: ContributionDraft }) {
  const parts: string[] = [];
  if (draft.ttf) {
    parts.push(
      `TTF: ${draft.ttf.elapsed_minutes ?? "?"} min, ${draft.ttf.item_type ?? "?"}, quality ${draft.ttf.item_quality ?? "?"}`,
    );
  }
  if (draft.attributes && draft.attributes.length > 0) {
    parts.push(`${draft.attributes.length} attribute rating${draft.attributes.length === 1 ? "" : "s"}`);
  }
  if (draft.note?.text) {
    parts.push(`Note: "${draft.note.text.slice(0, 80)}${draft.note.text.length > 80 ? "…" : ""}"`);
  }
  if (parts.length === 0) return <p className="text-sm text-text-muted">Nothing extracted yet.</p>;
  return (
    <ul className="mb-2 pl-4">
      {parts.map((part) => (
        <li key={part}>{part}</li>
      ))}
    </ul>
  );
}
