import { useCallback, useEffect, useRef, useState, startTransition } from "react";
import { Link } from "react-router-dom";

import { api } from "../api/client";
import { useAuth } from "../auth/useAuth";
import { authErrorMessage } from "../auth/errors";
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
  restaurantId: string;
  restaurantName: string;
};

export function ReviewChat({ restaurantId, restaurantName }: ReviewChatProps) {
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
    if (!schema || !idToken || messages.length < 2) return;
    setBusy(true);
    setError(null);
    try {
      const extracted = await extractContributionDraft(messages, idToken);
      setExtractSummary(extracted.summary);
      const result = await api.previewContributions(restaurantId, extracted.draft, idToken);
      setPreview(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Preview failed.");
    } finally {
      setBusy(false);
    }
  }

  async function handleSubmit() {
    if (!preview?.ready_to_submit || !idToken) return;
    setBusy(true);
    setError(null);
    try {
      await api.submitContributions(restaurantId, preview.draft, idToken);
      toast("Review saved — thanks for helping other families!", "success");
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
        <p className="muted small">
          Set <code>VITE_ENABLE_REVIEW_CHAT=true</code> in <code>web/.env.local</code> to enable
          the review assistant.
        </p>
      </Card>
    );
  }

  if (!idToken) {
    return (
      <Card title="Review assistant" subtitle="Freeform review → structured ratings">
        <p className="muted small">
          <Link to="/login">Sign in</Link> to chat through your visit and submit ratings.
        </p>
      </Card>
    );
  }

  return (
    <Card title="Review assistant" subtitle="Describe your visit — we'll fill in the right fields">
      <div className="review-chat">
        <div className="review-chat__messages" ref={scrollRef}>
          {messages.map((message, index) => (
            <div
              key={`${message.role}-${index}`}
              className={`review-chat__bubble review-chat__bubble--${message.role}`}
            >
              {message.text}
            </div>
          ))}
          {busy && !preview && (
            <div className="review-chat__bubble review-chat__bubble--assistant muted">
              Thinking…
            </div>
          )}
        </div>

        {extractSummary && (
          <div className="review-chat__preview-summary">
            <p>{extractSummary}</p>
          </div>
        )}

        {preview && (
          <div className="review-chat__preview">
            <p className="review-chat__preview-title">
              {preview.ready_to_submit ? "Ready to submit" : "Needs a bit more detail"}
            </p>
            {preview.missing_required.length > 0 && (
              <ul className="review-chat__missing">
                {preview.missing_required.map((field) => (
                  <li key={field}>{field}</li>
                ))}
              </ul>
            )}
            {preview.errors.length > 0 && (
              <ul className="review-chat__errors">
                {preview.errors.map((err) => (
                  <li key={err}>{err}</li>
                ))}
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

        {error && <p className="error">{error}</p>}

        <div className="review-chat__composer">
          <textarea
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
          <div className="review-chat__actions">
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
  if (parts.length === 0) return <p className="muted small">Nothing extracted yet.</p>;
  return (
    <ul className="review-chat__draft-summary">
      {parts.map((part) => (
        <li key={part}>{part}</li>
      ))}
    </ul>
  );
}
