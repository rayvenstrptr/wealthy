import { describe, expect, it } from "vitest";
import {
  normalizePeriod,
  periodCaption,
  periodKind,
  periodLabel,
  periodRange,
} from "./period";

describe("period param parsing", () => {
  it("classifies month, year, and all-time values", () => {
    expect(periodKind("2026-07")).toBe("month");
    expect(periodKind("2026")).toBe("year");
    expect(periodKind("all")).toBe("all");
  });

  it("accepts valid params and falls back to the default month otherwise", () => {
    expect(normalizePeriod("2026-07", "2026-01")).toBe("2026-07");
    expect(normalizePeriod("2026", "2026-01")).toBe("2026");
    expect(normalizePeriod("all", "2026-01")).toBe("all");
    expect(normalizePeriod(undefined, "2026-01")).toBe("2026-01");
    expect(normalizePeriod("2026-13", "2026-01")).toBe("2026-01");
    expect(normalizePeriod("garbage", "2026-01")).toBe("2026-01");
  });
});

describe("period resolution (payday cycle)", () => {
  it("resolves a month to its 25th→24th window", () => {
    expect(periodRange("2026-07")).toEqual({ start: "2026-06-25", end: "2026-07-24" });
  });

  it("resolves a year to its budget-year window", () => {
    expect(periodRange("2026")).toEqual({ start: "2025-12-25", end: "2026-12-24" });
  });

  it("leaves all time unbounded", () => {
    expect(periodRange("all")).toBeUndefined();
  });

  it("labels and captions each kind", () => {
    expect(periodLabel("2026-07")).toBe("July 2026");
    expect(periodLabel("2026")).toBe("2026");
    expect(periodLabel("all")).toBe("All time");
    expect(periodCaption("2026-07")).toBe("25 Jun 2026 – 24 Jul 2026");
    expect(periodCaption("2026")).toBe("25 Dec 2025 – 24 Dec 2026");
    expect(periodCaption("all")).toBe("Everything ever recorded");
  });
});
