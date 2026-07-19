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

/** Parse a comma/space-separated ages string into rounded integer ages.
 *  Accepts whole numbers and half-years (e.g. "2.5") because the stored profile
 *  format is integer ages; decimals are rounded to the nearest whole year. */
export function parseKidsAges(input: string): { ages: number[]; error: string | null } {
  const tokens = input
    .split(/[,\s]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  if (tokens.length === 0) {
    return { ages: [], error: null };
  }

  const ages: number[] = [];
  for (const token of tokens) {
    const value = Number(token);
    if (Number.isNaN(value) || !Number.isFinite(value)) {
      return { ages: [], error: `Invalid age: "${token}". Ages must be numbers, e.g. 2, 5 or 2.5.` };
    }
    if (value < 0 || value > 17) {
      return { ages: [], error: "Ages must be between 0 and 17." };
    }
    ages.push(Math.round(value));
  }

  if (ages.length > 8) {
    return { ages: [], error: "At most 8 kids ages are allowed." };
  }

  return { ages, error: null };
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
