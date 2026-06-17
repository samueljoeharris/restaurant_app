import { api } from "../api/client";
import type { ContributionDraft } from "../types";

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
