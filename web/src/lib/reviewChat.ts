import { api } from "../api/client";
import type { ContributionDraft, ContributionPreviewResponse } from "../types";

export function reviewChatAvailable(): boolean {
  return import.meta.env.VITE_ENABLE_REVIEW_CHAT === "true";
}

export type ChatMessage = {
  role: "user" | "assistant";
  text: string;
};

export async function sendReviewChatMessage(
  restaurantName: string,
  messages: ChatMessage[],
  token: string,
): Promise<string> {
  const result = await api.reviewChatReply(restaurantName, messages, token);
  return result.reply;
}

export async function extractContributionDraft(
  messages: ChatMessage[],
  token: string,
): Promise<{ draft: ContributionDraft; missing_required: string[]; summary: string }> {
  return api.reviewChatExtract(messages, token);
}

/**
 * Three-state readiness for the live draft card (#122 — replaces the manual
 * "Preview submission" step): no extraction has run yet, the draft is
 * missing required fields, or it's ready to submit.
 */
export type DraftReadinessTier = "empty" | "pending" | "ready";

export function draftReadinessTier(
  preview: Pick<ContributionPreviewResponse, "ready_to_submit"> | null,
): DraftReadinessTier {
  if (!preview) return "empty";
  return preview.ready_to_submit ? "ready" : "pending";
}

/** Header copy for the draft card / mobile disclosure badge per tier. */
export function draftReadinessLabel(
  preview: Pick<ContributionPreviewResponse, "ready_to_submit" | "missing_required"> | null,
): string {
  const tier = draftReadinessTier(preview);
  if (tier === "empty") return "Your draft";
  if (tier === "ready") return "Ready";
  const count = preview?.missing_required.length ?? 0;
  return count > 0 ? `${count} to add` : "Needs attention";
}
