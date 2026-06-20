import { useCallback, useEffect, useRef, useState, startTransition } from "react";
import { Link, useNavigate } from "react-router-dom";

import { api } from "../api/client";
import { useAuth } from "../auth/useAuth";
import { authErrorMessage } from "../auth/errors";
import { cn } from "../lib/cn";
import { Button } from "./ui/Button";
import { Card } from "./ui/Card";
import { useToast } from "./ui/useToast";
import {
  extractContributionDraft,
  reviewChatAvailable,
  sendReviewChatMessage,
  type ChatMessage,
} from "../lib/reviewChat";
import type { ContributionDraft, ContributionPreviewResponse, ContributionSchema } from "../types";

type ReviewChatProps = {
  restaurantName: string;
  restaurantId?: string;
  placeId?: string;
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

export function ReviewChat({ restaurantId, placeId, restaurantName }: ReviewChatProps) {
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
  const [preview, setPreview] = useState<ContributionPreviewResponse | null>(null);
  const [extractSummary, setExtractSummary] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

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

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || busy || !idToken || !schema) return;

    const nextMessages: ChatMessage[] = [...messages, { role: "user", text }];
    setInput("");
    setBusy(true);
    setError(null);
    setPreview(null);
    setExtractSummary(null);
    setMessages(nextMessages);
    try {
      const reply = await sendReviewChatMessage(restaurantName, nextMessages, idToken);
      setMessages((prev) => [...prev, { role: "assistant", text: reply }]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Chat failed.");
    } finally {
      setBusy(false);
    }
  }, [input, busy, idToken, schema, messages, restaurantName]);

  async function handlePreview() {
    if (!schema || !idToken || messages.length < 2 || (!restaurantId && !placeId)) return;
    setBusy(true);
    setError(null);
    try {
      const extracted = await extractContributionDraft(messages, idToken);
      setExtractSummary(extracted.summary);
      const result = placeId
        ? await api.previewPlaceContributions(placeId, extracted.draft, idToken)
        : await api.previewContributions(restaurantId!, extracted.draft, idToken);
      setPreview(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Preview failed.");
    } finally {
      setBusy(false);
    }
  }

  async function handleSubmit() {
    if (!preview?.ready_to_submit || !idToken || (!restaurantId && !placeId)) return;
    setBusy(true);
    setError(null);
    try {
      if (placeId) {
        const result = await api.submitPlaceContributions(placeId, preview.draft, idToken);
        const entry = await api.getPlaceEntry(placeId, idToken);
        toast(
          result.pending_review
            ? "Review submitted for moderation — thanks for helping other families!"
            : "Review saved — thanks for helping other families!",
          "success",
        );
        if (entry.id) {
          navigate(`/restaurants/${entry.id}`);
        }
        return;
      }
      const result = await api.submitContributions(restaurantId!, preview.draft, idToken);
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

  return (
    <Card title="Review assistant" subtitle="Describe your visit — we'll fill in the right fields">
      <div className="flex flex-col gap-3">
        <div
          className="flex max-h-80 flex-col gap-2 overflow-y-auto rounded-md bg-surface-muted p-2"
          ref={scrollRef}
        >
          {messages.map((message, index) => (
            <div
              key={`${message.role}-${index}`}
              className={cn(
                "max-w-[92%] rounded-md px-3 py-2 text-sm leading-normal whitespace-pre-wrap",
                message.role === "assistant"
                  ? "self-start border border-border bg-surface"
                  : "self-end border border-brand/25 bg-brand-soft",
              )}
            >
              {message.text}
            </div>
          ))}
          {busy && !preview && (
            <div className="max-w-[92%] self-start rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-muted">
              Thinking…
            </div>
          )}
        </div>

        {extractSummary && (
          <div className="rounded-md bg-surface-muted p-3 text-sm">
            <p>{extractSummary}</p>
          </div>
        )}

        {preview && (
          <div className="rounded-md bg-surface-muted p-3 text-sm">
            <p className="mb-2 font-semibold">
              {preview.ready_to_submit ? "Ready to submit" : "Needs a bit more detail"}
            </p>
            {preview.missing_required.length > 0 && (
              <ul className="mb-2 pl-4">
                {preview.missing_required.map((field, index) => {
                  const label = formatReviewField(field);
                  return <li key={`${label}-${index}`}>{label}</li>;
                })}
              </ul>
            )}
            {preview.errors.length > 0 && (
              <ul className="mb-2 pl-4 text-error">
                {preview.errors.map((err, index) => {
                  const label = formatReviewField(err);
                  return <li key={`${label}-${index}`}>{label}</li>;
                })}
              </ul>
            )}
            <DraftSummary draft={preview.draft} />
            {preview.ready_to_submit && (
              <Button type="button" onClick={handleSubmit} disabled={busy} fullWidth>
                {busy ? "Submitting…" : "Submit review"}
              </Button>
            )}
          </div>
        )}

        {error && <p className="text-sm font-semibold text-error">{error}</p>}

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
            <Button type="button" variant="secondary" onClick={handlePreview} disabled={busy || messages.length < 2}>
              Preview submission
            </Button>
            <Button type="button" onClick={() => void sendMessage()} disabled={busy || !input.trim() || !schema}>
              Send
            </Button>
          </div>
        </div>
      </div>
    </Card>
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
