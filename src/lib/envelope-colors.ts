// Envelope hues for budget types. Colors carry meaning (README "Envelopes"
// system): gold=Invest, green=Cash, red=Life, purple=Fun, blue=Giving. Keyed by
// the seeded budget-type names (case-insensitive); user-created types fall back
// to a warm neutral. Pure presentation — no summary/date/data logic here.

export interface EnvelopeHue {
  /** Saturated fill: progress-bar fill, status dots, OVER badge. */
  fill: string;
  /** Pale tint: envelope card background, chip background. */
  tint: string;
  /** Readable text on paper/tint: labels in the type's color. */
  text: string;
  /** Progress-bar track (between tint and fill). */
  track: string;
}

const HUES: Record<string, EnvelopeHue> = {
  invest: {
    fill: "oklch(0.62 0.10 85)",
    tint: "oklch(0.96 0.025 85)",
    text: "oklch(0.45 0.09 85)",
    track: "oklch(0.90 0.035 85)",
  },
  cash: {
    fill: "oklch(0.58 0.11 155)",
    tint: "oklch(0.96 0.025 155)",
    text: "oklch(0.42 0.09 155)",
    track: "oklch(0.90 0.04 155)",
  },
  life: {
    fill: "oklch(0.56 0.13 25)",
    tint: "oklch(0.96 0.02 25)",
    text: "oklch(0.44 0.11 25)",
    track: "oklch(0.90 0.03 25)",
  },
  fun: {
    fill: "oklch(0.56 0.14 305)",
    tint: "oklch(0.96 0.025 305)",
    text: "oklch(0.44 0.10 305)",
    track: "oklch(0.90 0.04 305)",
  },
  giving: {
    fill: "oklch(0.58 0.10 245)",
    tint: "oklch(0.96 0.02 245)",
    text: "oklch(0.44 0.09 245)",
    track: "oklch(0.90 0.03 245)",
  },
};

/** Warm-neutral fallback for user-created budget types with no seeded hue. */
const NEUTRAL: EnvelopeHue = {
  fill: "#9a9382",
  tint: "#f2eee6",
  text: "#6f6a5b",
  track: "#e6e0d4",
};

/** Hue for a budget type by its name. Falls back to a warm neutral. */
export function envelopeHue(name: string | null | undefined): EnvelopeHue {
  if (!name) return NEUTRAL;
  return HUES[name.trim().toLowerCase()] ?? NEUTRAL;
}
