import type { TtfSubmission } from "../types";

export const TTF_ITEM_TYPES: {
  value: TtfSubmission["item_type"];
  label: string;
  emoji: string;
}[] = [
  { value: "fries", label: "Fries", emoji: "🍟" },
  { value: "apple_slices", label: "Apple slices", emoji: "🍎" },
  { value: "bread", label: "Bread", emoji: "🍞" },
  { value: "kids_meal", label: "Kids meal", emoji: "🧒" },
  { value: "other", label: "Other", emoji: "🍽️" },
];

export const TTF_PORTIONS: {
  value: TtfSubmission["portion_size"];
  label: string;
}[] = [
  { value: "kid", label: "Kid" },
  { value: "regular", label: "Regular" },
  { value: "shareable", label: "Shareable" },
];

export const TTF_DAYPARTS: {
  value: TtfSubmission["daypart"];
  label: string;
}[] = [
  { value: "breakfast", label: "Breakfast" },
  { value: "lunch", label: "Lunch" },
  { value: "dinner", label: "Dinner" },
  { value: "late", label: "Late" },
];
