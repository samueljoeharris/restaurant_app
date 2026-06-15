import { getGenerativeModel, Schema } from "firebase/ai";

import { firebaseAI } from "../firebase";
import type { ContributionDraft, ContributionSchema } from "../types";

const MODEL_NAME = "gemini-3.5-flash";

let chatModel: ReturnType<typeof getGenerativeModel> | null = null;
let extractModel: ReturnType<typeof getGenerativeModel> | null = null;

function aiEnabled(): boolean {
  return import.meta.env.VITE_ENABLE_REVIEW_CHAT === "true";
}

function getModels() {
  if (!aiEnabled()) {
    throw new Error("Review chat is not enabled. Set VITE_ENABLE_REVIEW_CHAT=true.");
  }
  if (!chatModel || !extractModel) {
    const ai = firebaseAI;
    chatModel = getGenerativeModel(ai, {
      model: MODEL_NAME,
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 1024,
      },
    });
    extractModel = getGenerativeModel(ai, {
      model: MODEL_NAME,
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 2048,
        responseMimeType: "application/json",
        responseSchema: buildExtractionSchema(),
        // Structured extraction doesn't need extended thinking — it was consuming
        // the output budget and truncating JSON (finishReason: MAX_TOKENS).
        thinkingConfig: { thinkingBudget: 0 },
      },
    });
  }
  return { chatModel, extractModel };
}

function buildExtractionSchema() {
  return Schema.object({
    properties: {
      ttf: Schema.object({
        properties: {
          elapsed_minutes: Schema.integer({ nullable: true }),
          item_type: Schema.enumString({
            enum: ["fries", "apple_slices", "bread", "kids_meal", "other"],
            nullable: true,
          }),
          item_quality: Schema.integer({ nullable: true, minimum: 1, maximum: 5 }),
          portion_size: Schema.enumString({
            enum: ["kid", "regular", "shareable"],
            nullable: true,
          }),
          daypart: Schema.enumString({
            enum: ["breakfast", "lunch", "dinner", "late"],
            nullable: true,
          }),
          party_size_kids: Schema.integer({ nullable: true, minimum: 1, maximum: 12 }),
          wait_context: Schema.string({ nullable: true }),
        },
        nullable: true,
      }),
      attributes: Schema.array({
        items: Schema.object({
          properties: {
            metric_key: Schema.string(),
            value: Schema.string(),
            visit_context: Schema.string({ nullable: true }),
          },
          required: ["metric_key", "value"],
        }),
      }),
      note: Schema.object({
        properties: {
          text: Schema.string(),
          tags: Schema.array({ items: Schema.string() }),
        },
        nullable: true,
      }),
      missing_required: Schema.array({ items: Schema.string() }),
    },
    required: ["attributes", "missing_required"],
  });
}

export function reviewChatAvailable(): boolean {
  return aiEnabled();
}

export function buildReviewSystemPrompt(
  restaurantName: string,
  schema: ContributionSchema,
): string {
  return `You are Little Scout's friendly review assistant helping a parent share their restaurant visit at "${restaurantName}".

Your job:
1. Greet the user and ask if they'd like to write a freeform review of their visit.
2. Encourage them to describe kid food speed (time until kid food arrived), atmosphere, access (stroller, high chairs), kids menu, and any tips — in their own words.
3. Ask short follow-up questions ONLY for required fields that are still missing from the schema below.
4. Do not invent facts. If timing or ratings are unclear, ask.
5. When you have enough for at least one contribution type (TTF observation, attribute ratings, or a note), summarize what you captured and ask if they're ready to preview and submit.
6. Keep replies concise (2-4 sentences). Warm, parent-to-parent tone.

Authoritative contribution schema (from our API — use exact enum keys and metric_key values):
${JSON.stringify(schema, null, 2)}

TTF item_type values: fries, apple_slices, bread, kids_meal, other.
TTF portion_size: kid, regular, shareable.
TTF daypart: breakfast, lunch, dinner, late.
Attribute values: booleans as true/false; numeric sliders as integers; enums as exact strings from schema.

You cannot submit data yourself — the app will parse and submit after the user confirms.`;
}

export type ChatMessage = {
  role: "user" | "assistant";
  text: string;
};

export function startReviewChat(systemPrompt: string) {
  const { chatModel: model } = getModels();
  return model.startChat({
    history: [
      {
        role: "user",
        parts: [{ text: systemPrompt }],
      },
      {
        role: "model",
        parts: [
          {
            text: "Got it — I'll help turn your visit into structured Little Scout ratings. Want to tell me about your meal in your own words?",
          },
        ],
      },
    ],
  });
}

export async function sendReviewChatMessage(
  chat: ReturnType<typeof startReviewChat>,
  message: string,
): Promise<string> {
  const result = await chat.sendMessage(message);
  return result.response.text();
}

type RawExtraction = {
  ttf?: {
    elapsed_minutes?: number | null;
    item_type?: string | null;
    item_quality?: number | null;
    portion_size?: string | null;
    daypart?: string | null;
    party_size_kids?: number | null;
    wait_context?: string | null;
  } | null;
  attributes?: Array<{
    metric_key: string;
    value: string;
    visit_context?: string | null;
  }>;
  note?: { text: string; tags?: string[] } | null;
  missing_required?: string[];
};

function buildExtractionSummary(draft: ContributionDraft): string {
  const parts: string[] = [];
  if (draft.ttf) {
    parts.push(
      `kid food speed (${draft.ttf.elapsed_minutes ?? "?"} min, ${draft.ttf.item_type ?? "?"})`,
    );
  }
  if (draft.attributes && draft.attributes.length > 0) {
    parts.push(
      `${draft.attributes.length} parent rating${draft.attributes.length === 1 ? "" : "s"}`,
    );
  }
  if (draft.note?.text) {
    parts.push("a visit note");
  }
  if (parts.length === 0) {
    return "We couldn't extract structured data yet — try adding a bit more detail.";
  }
  return `Ready to submit: ${parts.join(", ")}.`;
}

function parseExtractionJson(raw: string): RawExtraction {
  try {
    return JSON.parse(raw) as RawExtraction;
  } catch {
    throw new Error(
      "Could not parse the review into structured data. Try Preview again — if it keeps failing, add one more detail in chat first.",
    );
  }
}

function coerceAttributeValue(raw: string, schema: ContributionSchema): boolean | number | string {
  const metric = schema.attributes.metrics[raw as keyof typeof schema.attributes.metrics];
  if (!metric) return raw;
  if (metric.type === "boolean") {
    if (raw === "true") return true;
    if (raw === "false") return false;
    return raw === "yes" || raw === "1";
  }
  if (metric.type === "numeric") {
    const num = Number(raw);
    return Number.isFinite(num) ? num : raw;
  }
  return raw;
}

function cleanTtf(
  ttf: NonNullable<RawExtraction["ttf"]>,
): ContributionDraft["ttf"] | undefined {
  const cleaned = Object.fromEntries(
    Object.entries(ttf).filter(([, value]) => value !== null && value !== undefined),
  );
  if (Object.keys(cleaned).length === 0) return undefined;
  return cleaned as ContributionDraft["ttf"];
}

export async function extractContributionDraft(
  schema: ContributionSchema,
  messages: ChatMessage[],
): Promise<{ draft: ContributionDraft; missing_required: string[]; summary: string }> {
  const { extractModel: model } = getModels();
  const transcript = messages
    .map((message) => `${message.role === "user" ? "Parent" : "Assistant"}: ${message.text}`)
    .join("\n\n");

  const prompt = `Extract structured Little Scout contributions from this review conversation.

Conversation:
${transcript}

Metric keys and TTF enums (use exact strings):
${JSON.stringify({
    ttf_enums: {
      item_type: ["fries", "apple_slices", "bread", "kids_meal", "other"],
      portion_size: ["kid", "regular", "shareable"],
      daypart: ["breakfast", "lunch", "dinner", "late"],
    },
    attribute_metrics: Object.keys(schema.attributes.metrics),
  })}

Rules:
- Only include fields clearly stated or strongly implied in the conversation.
- Omit unknown TTF fields rather than guessing.
- For attributes, use exact metric_key strings; encode value as a string.
- Include a note only for freeform tips not captured in TTF or attributes.
- Keep note.text concise (under 400 characters).
- List missing required TTF fields in missing_required when partial TTF data exists.`;

  const result = await model.generateContent(prompt);
  const parsed = parseExtractionJson(result.response.text());

  const draft: ContributionDraft = {
    attributes: (parsed.attributes ?? []).map((attr) => ({
      metric_key: attr.metric_key,
      value: coerceAttributeValue(attr.value, schema),
      visit_context: attr.visit_context ?? undefined,
    })),
  };

  const ttf = parsed.ttf ? cleanTtf(parsed.ttf) : undefined;
  if (ttf) draft.ttf = ttf;
  if (parsed.note?.text?.trim()) {
    draft.note = {
      text: parsed.note.text.trim(),
      tags: parsed.note.tags ?? [],
    };
  }

  return {
    draft,
    missing_required: parsed.missing_required ?? [],
    summary: buildExtractionSummary(draft),
  };
}
