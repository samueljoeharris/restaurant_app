export const CONTRIBUTOR_TRUST_TIERS = [
  {
    value: "new",
    label: "New — review before publish",
    shortLabel: "New",
    description: "First-time contributor. Submissions wait in the moderation queue.",
  },
  {
    value: "standard",
    label: "Standard — review before publish",
    shortLabel: "Standard",
    description: "Established contributor. Submissions wait in the moderation queue.",
  },
  {
    value: "trusted",
    label: "Trusted — publishes immediately",
    shortLabel: "Trusted",
    description: "Reliable contributor. Submissions go live without queue review.",
  },
  {
    value: "restricted",
    label: "Restricted — account disabled",
    shortLabel: "Restricted",
    description: "Account disabled. Cannot sign in or submit.",
  },
] as const;

export type ContributorTrustLevel = (typeof CONTRIBUTOR_TRUST_TIERS)[number]["value"];

export function contributorTrustLabel(value: string): string {
  return CONTRIBUTOR_TRUST_TIERS.find((t) => t.value === value)?.shortLabel ?? value;
}

export function contributorTrustDescription(value: string): string | undefined {
  return CONTRIBUTOR_TRUST_TIERS.find((t) => t.value === value)?.description;
}

export function contributorTrustSuccessMessage(value: string): string {
  const tier = CONTRIBUTOR_TRUST_TIERS.find((t) => t.value === value);
  if (!tier) return "Contributor updated";
  if (value === "trusted") return "Promoted to trusted";
  return `Set to ${tier.shortLabel}`;
}
