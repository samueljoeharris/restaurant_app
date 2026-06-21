/** Parent-facing copy derived from profile kids ages — matches Bluebird kit voice. */
export function scoutingSubtitle(kidsAges: number[]): string {
  if (kidsAges.length === 0) {
    return "Add kids' ages to personalize tips";
  }
  if (kidsAges.length === 1) {
    return `Scouting for a ${kidsAges[0]}-year-old`;
  }
  const ages = [...kidsAges].sort((a, b) => a - b);
  if (ages.length === 2) {
    return `Scouting for ages ${ages[0]} and ${ages[1]}`;
  }
  const last = ages.pop();
  return `Scouting for ages ${ages.join(", ")}, and ${last}`;
}

export function trailScoutBadge(contributionCount: number): {
  glyph: string;
  label: string;
  earned: boolean;
} {
  if (contributionCount >= 3) {
    return { glyph: "★", label: "Trail Scout", earned: true };
  }
  return { glyph: "🌱", label: "New scout", earned: false };
}
