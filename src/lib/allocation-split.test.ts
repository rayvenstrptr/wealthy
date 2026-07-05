import { describe, expect, it } from "vitest";
import { scaleSplit, splitFromPercents, splitRemaining, type SplitCell } from "./allocation-split";

// 10jt template: 20/10/50/15/5
const template: SplitCell[] = [
  { budget_type_id: "bt-invest", amount: 2_000_000 },
  { budget_type_id: "bt-cash", amount: 1_000_000 },
  { budget_type_id: "bt-life", amount: 5_000_000 },
  { budget_type_id: "bt-fun", amount: 1_500_000 },
  { budget_type_id: "bt-giving", amount: 500_000 },
];

function total(cells: SplitCell[]): number {
  return cells.reduce((sum, c) => sum + c.amount, 0);
}

describe("scaleSplit", () => {
  it("scales proportionally and sums exactly (10.5jt from 10jt template)", () => {
    const scaled = scaleSplit(template, 10_500_000);
    expect(total(scaled)).toBe(10_500_000);
    const byId = Object.fromEntries(scaled.map((c) => [c.budget_type_id, c.amount]));
    expect(byId["bt-invest"]).toBe(2_100_000);
    expect(byId["bt-life"]).toBe(5_250_000);
    expect(byId["bt-giving"]).toBe(525_000);
  });

  it("puts the rounding remainder on the largest cell for awkward totals", () => {
    // 3 equal cells scaled to 10_000: 3333+3333+3333 = 9999 → +1 on the first/largest
    const thirds: SplitCell[] = [
      { budget_type_id: "a", amount: 1 },
      { budget_type_id: "b", amount: 1 },
      { budget_type_id: "c", amount: 1 },
    ];
    const scaled = scaleSplit(thirds, 10_000);
    expect(total(scaled)).toBe(10_000);
    expect(scaled.map((c) => c.amount).sort((x, y) => y - x)).toEqual([3334, 3333, 3333]);
  });

  it("survives prime-ish totals with the 10jt template", () => {
    const scaled = scaleSplit(template, 10_000_001);
    expect(total(scaled)).toBe(10_000_001);
  });

  it("returns empty for empty/zero templates or non-positive totals", () => {
    expect(scaleSplit([], 5_000_000)).toEqual([]);
    expect(scaleSplit([{ budget_type_id: "a", amount: 0 }], 5_000_000)).toEqual([]);
    expect(scaleSplit(template, 0)).toEqual([]);
  });
});

describe("splitFromPercents", () => {
  it("converts a 100% row to exact amounts (12.5% cells)", () => {
    const cells = [
      { budget_type_id: "a", percent: 45 },
      { budget_type_id: "b", percent: 25 },
      { budget_type_id: "c", percent: 12.5 },
      { budget_type_id: "d", percent: 12.5 },
      { budget_type_id: "e", percent: 5 },
    ];
    const amounts = splitFromPercents(cells, 4_000_000);
    expect(total(amounts)).toBe(4_000_000);
    const byId = Object.fromEntries(amounts.map((c) => [c.budget_type_id, c.amount]));
    expect(byId.a).toBe(1_800_000);
    expect(byId.c).toBe(500_000);
  });

  it("fixes rounding on the largest cell when percents sum to 100", () => {
    const cells = [
      { budget_type_id: "a", percent: 33.33 },
      { budget_type_id: "b", percent: 33.33 },
      { budget_type_id: "c", percent: 33.34 },
    ];
    const amounts = splitFromPercents(cells, 10_000_001);
    expect(total(amounts)).toBe(10_000_001);
  });

  it("does NOT force-sum while percents are incomplete (mid-typing)", () => {
    const amounts = splitFromPercents([{ budget_type_id: "a", percent: 20 }], 10_000_000);
    expect(total(amounts)).toBe(2_000_000); // gap shows in splitRemaining instead
  });

  it("returns zero cells for non-positive totals", () => {
    const amounts = splitFromPercents([{ budget_type_id: "a", percent: 50 }], 0);
    expect(amounts).toEqual([{ budget_type_id: "a", amount: 0 }]);
  });
});

describe("splitRemaining", () => {
  it("reports the unallocated remainder", () => {
    expect(splitRemaining(10_000_000, template)).toBe(0);
    expect(splitRemaining(10_500_000, template)).toBe(500_000);
    expect(splitRemaining(9_500_000, template)).toBe(-500_000);
    expect(splitRemaining(1_000, [])).toBe(1_000);
  });
});
