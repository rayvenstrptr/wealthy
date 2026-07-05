// Hues for investment asset classes — parallel to envelope-colors (same shape)
// but its own palette keyed by the seeded class names. Pure presentation.

import type { EnvelopeHue } from "@/lib/envelope-colors";

const HUES: Record<string, EnvelopeHue> = {
  commodities: {
    fill: "oklch(0.64 0.11 70)",
    tint: "oklch(0.96 0.025 70)",
    text: "oklch(0.46 0.09 70)",
    track: "oklch(0.90 0.04 70)",
  },
  stocks: {
    fill: "oklch(0.56 0.11 170)",
    tint: "oklch(0.96 0.02 170)",
    text: "oklch(0.42 0.08 170)",
    track: "oklch(0.90 0.035 170)",
  },
  fixed: {
    fill: "oklch(0.58 0.10 245)",
    tint: "oklch(0.96 0.02 245)",
    text: "oklch(0.44 0.09 245)",
    track: "oklch(0.90 0.03 245)",
  },
  crypto: {
    fill: "oklch(0.56 0.14 305)",
    tint: "oklch(0.96 0.025 305)",
    text: "oklch(0.44 0.10 305)",
    track: "oklch(0.90 0.04 305)",
  },
  others: {
    fill: "oklch(0.60 0.10 25)",
    tint: "oklch(0.96 0.02 25)",
    text: "oklch(0.46 0.09 25)",
    track: "oklch(0.90 0.03 25)",
  },
  business: {
    fill: "oklch(0.58 0.11 130)",
    tint: "oklch(0.96 0.025 130)",
    text: "oklch(0.44 0.08 130)",
    track: "oklch(0.90 0.04 130)",
  },
  buffer: {
    fill: "oklch(0.60 0.04 260)",
    tint: "oklch(0.96 0.008 260)",
    text: "oklch(0.46 0.03 260)",
    track: "oklch(0.90 0.012 260)",
  },
};

/** Warm-neutral fallback for user-created classes with no seeded hue. */
const NEUTRAL: EnvelopeHue = {
  fill: "#9a9382",
  tint: "#f2eee6",
  text: "#6f6a5b",
  track: "#e6e0d4",
};

/** Hue for an asset class by its name. Falls back to a warm neutral. */
export function assetClassHue(name: string | null | undefined): EnvelopeHue {
  if (!name) return NEUTRAL;
  return HUES[name.trim().toLowerCase()] ?? NEUTRAL;
}
