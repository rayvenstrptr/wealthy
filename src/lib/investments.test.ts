import { describe, expect, it } from "vitest";
import {
  computeDeployed,
  computeInvestmentSummary,
  computeItemPositions,
  type InvestmentTxInput,
} from "./investments";

let txSeq = 0;
function tx(
  item_id: string,
  side: "buy" | "sell",
  amount: number,
  quantity: number | null,
  date: string
): InvestmentTxInput {
  txSeq += 1;
  return { id: `tx-${txSeq}`, item_id, side, amount, quantity, date, created_at: `t${txSeq}` };
}

describe("computeItemPositions — average cost with quantities", () => {
  it("realizes P&L against average cost across two buys", () => {
    // Buy 100 @ 90k = 9jt, buy 100 @ 110k = 11jt → avg 100k. Sell 100 for 9.2jt → -800k.
    const { positions } = computeItemPositions([
      tx("bbca", "buy", 9_000_000, 100, "2026-06-20"),
      tx("bbca", "buy", 11_000_000, 100, "2026-06-27"),
      tx("bbca", "sell", 9_200_000, 100, "2026-07-04"),
    ]);
    const pos = positions.get("bbca")!;
    expect(pos.realized).toBe(-800_000);
    expect(pos.basisSold).toBe(10_000_000);
    expect(pos.realizedPct).toBeCloseTo(-0.08);
    expect(pos.units).toBe(100);
    expect(pos.costBasis).toBe(10_000_000);
    expect(pos.warnings).toEqual([]);
  });

  it("accumulates realized P&L across repeated round trips (Ray's example)", () => {
    // Round trip 1: lose 800k on 10jt basis. Round trip 2: win 1jt on 10jt basis.
    // Net: +200k on 20jt sold basis.
    const { positions } = computeItemPositions([
      tx("bbca", "buy", 10_000_000, 100, "2026-06-01"),
      tx("bbca", "sell", 9_200_000, 100, "2026-06-15"),
      tx("bbca", "buy", 10_000_000, 100, "2026-07-01"),
      tx("bbca", "sell", 11_000_000, 100, "2026-07-20"),
    ]);
    const pos = positions.get("bbca")!;
    expect(pos.realized).toBe(200_000);
    expect(pos.basisSold).toBe(20_000_000);
    expect(pos.realizedPct).toBeCloseTo(0.01);
    expect(pos.units).toBe(0);
    expect(pos.costBasis).toBe(0);
  });

  it("closes rounding dust on a full exit", () => {
    // 3 units for 10_000 → avg 3333.33…; selling all 3 must clear the basis exactly.
    const { positions } = computeItemPositions([
      tx("x", "buy", 10_000, 3, "2026-01-01"),
      tx("x", "sell", 12_000, 3, "2026-02-01"),
    ]);
    const pos = positions.get("x")!;
    expect(pos.costBasis).toBe(0);
    expect(pos.realized).toBe(2_000);
  });

  it("clamps oversells and warns; ignores quantity-sells on empty positions", () => {
    const { positions } = computeItemPositions([
      tx("btc", "buy", 2_000_000, 0.002, "2026-01-01"),
      tx("btc", "sell", 3_000_000, 0.005, "2026-02-01"), // only 0.002 held
      tx("eth", "sell", 1_000_000, 1, "2026-02-01"), // never bought
    ]);
    const btc = positions.get("btc")!;
    expect(btc.warnings.length).toBe(1);
    expect(btc.units).toBe(0);
    expect(btc.costBasis).toBe(0);
    expect(btc.realized).toBe(1_000_000); // proceeds 3jt − full 2jt basis

    const eth = positions.get("eth")!;
    expect(eth.warnings.length).toBe(1);
    expect(eth.realized).toBe(0);
  });
});

describe("computeItemPositions — no-quantity (deposito-style)", () => {
  it("a sell without quantity closes the entire outstanding cost", () => {
    const { positions } = computeItemPositions([
      tx("depo", "buy", 10_000_000, null, "2026-01-01"),
      tx("depo", "sell", 10_400_000, null, "2026-07-01"),
    ]);
    const pos = positions.get("depo")!;
    expect(pos.units).toBeNull();
    expect(pos.costBasis).toBe(0);
    expect(pos.realized).toBe(400_000);
    expect(pos.realizedPct).toBeCloseTo(0.04);
  });

  it("mixed item: a no-quantity sell still closes everything", () => {
    const { positions } = computeItemPositions([
      tx("tcg", "buy", 1_000_000, 10, "2026-01-01"), // 10 cards
      tx("tcg", "buy", 500_000, null, "2026-02-01"), // a sealed lot, uncounted
      tx("tcg", "sell", 2_000_000, null, "2026-03-01"), // flip the whole binder
    ]);
    const pos = positions.get("tcg")!;
    expect(pos.costBasis).toBe(0);
    expect(pos.units).toBe(0);
    expect(pos.realized).toBe(500_000); // 2jt − 1.5jt
  });

  it("orders by date then created_at (sell after same-day buy)", () => {
    const buy = tx("depo", "buy", 5_000_000, null, "2026-03-01");
    const sell = tx("depo", "sell", 5_100_000, null, "2026-03-01");
    const { positions } = computeItemPositions([sell, buy]); // shuffled input
    expect(positions.get("depo")!.realized).toBe(100_000);
  });
});

describe("computeDeployed", () => {
  const items = [
    { id: "bbca", asset_class_id: "stocks" },
    { id: "depo", asset_class_id: "fixed" },
  ];

  it("nets buys minus sell proceeds per class", () => {
    const deployed = computeDeployed(
      [
        tx("bbca", "buy", 50_000_000, null, "2026-03-01"),
        tx("bbca", "sell", 50_000_000, null, "2026-06-01"),
        tx("bbca", "buy", 55_000_000, null, "2026-06-10"),
        tx("depo", "buy", 10_000_000, null, "2026-04-01"),
      ],
      items
    );
    expect(deployed.get("stocks")).toBe(55_000_000); // 50 − 50 + 55
    expect(deployed.get("fixed")).toBe(10_000_000);
  });

  it("windows by date and can go net-negative (sold more than bought)", () => {
    const deployed = computeDeployed(
      [
        tx("bbca", "buy", 50_000_000, null, "2025-11-01"), // before window
        tx("bbca", "sell", 60_000_000, null, "2026-03-01"), // inside window
      ],
      items,
      { start: "2025-12-25", end: "2026-12-24" }
    );
    expect(deployed.get("stocks")).toBe(-60_000_000);
  });
});

describe("computeInvestmentSummary", () => {
  const assetClasses = [
    { id: "stocks", name: "Stocks", is_active: true, sort: 1 },
    { id: "fixed", name: "Fixed", is_active: true, sort: 2 },
    { id: "buffer", name: "Buffer", is_active: true, sort: 6 },
  ];
  const targets = [
    { asset_class_id: "stocks", percent: 45 },
    { asset_class_id: "fixed", percent: 25 },
    { asset_class_id: "buffer", percent: 2.5 },
  ];
  const items = [
    { id: "bbca", asset_class_id: "stocks" },
    { id: "depo", asset_class_id: "fixed" },
  ];

  it("computes class budgets from investBudget × percent and windows realized/deployed", () => {
    const year = { start: "2025-12-25", end: "2026-12-24" };
    const summary = computeInvestmentSummary({
      assetClasses,
      targets,
      items,
      transactions: [
        tx("bbca", "buy", 10_000_000, 100, "2026-01-10"),
        tx("bbca", "sell", 11_000_000, 100, "2026-05-10"), // +1jt realized in window
        tx("depo", "buy", 5_000_000, null, "2025-06-01"), // last budget year
      ],
      investBudget: 40_000_000,
      window: year,
    });

    const stocks = summary.classes.find((c) => c.name === "Stocks")!;
    expect(stocks.budget).toBe(18_000_000); // 45% × 40jt
    expect(stocks.deployed).toBe(-1_000_000); // 10jt buy − 11jt sell, both in window
    expect(stocks.remaining).toBe(19_000_000); // sells replenish
    expect(stocks.realized).toBe(1_000_000);
    expect(stocks.holdingsCost).toBe(0);

    const fixed = summary.classes.find((c) => c.name === "Fixed")!;
    expect(fixed.budget).toBe(10_000_000);
    expect(fixed.deployed).toBe(0); // buy was outside the window
    expect(fixed.holdingsCost).toBe(5_000_000); // holdings are all-time state

    expect(summary.totals.holdingsCost).toBe(5_000_000);
    expect(summary.totals.realized).toBe(1_000_000);
  });

  it("net worth = holdings + undeployed budget, floored at 0 undeployed", () => {
    const summary = computeInvestmentSummary({
      assetClasses,
      targets,
      items,
      transactions: [tx("bbca", "buy", 50_000_000, null, "2026-02-01")],
      investBudget: 40_000_000,
    });
    // Deployed (50jt) > budget (29jt) → undeployed floors at 0.
    expect(summary.totals.netWorth).toBe(50_000_000);
  });

  it("all-time view (no window) counts everything", () => {
    const summary = computeInvestmentSummary({
      assetClasses,
      targets,
      items,
      transactions: [
        tx("depo", "buy", 10_000_000, null, "2024-01-01"),
        tx("depo", "sell", 10_500_000, null, "2024-12-01"),
        tx("depo", "buy", 8_000_000, null, "2026-01-01"),
      ],
      investBudget: 100_000_000,
    });
    const fixed = summary.classes.find((c) => c.name === "Fixed")!;
    expect(fixed.realized).toBe(500_000);
    expect(fixed.deployed).toBe(7_500_000); // 10 − 10.5 + 8
    expect(fixed.holdingsCost).toBe(8_000_000);
  });

  it("folds yields into realized (class + totals) without touching the trading math", () => {
    const year = { start: "2025-12-25", end: "2026-12-24" };
    const summary = computeInvestmentSummary({
      assetClasses,
      targets,
      items,
      transactions: [
        tx("bbca", "buy", 10_000_000, 100, "2026-01-10"),
        tx("bbca", "sell", 5_500_000, 50, "2026-05-10"), // basis 5jt → +500k trading realized
      ],
      yields: [
        { item_id: "bbca", amount: 250_000, date: "2026-06-01" }, // in window
        { item_id: "depo", amount: 400_000, date: "2026-07-01" }, // in window
        { item_id: "bbca", amount: 999_000, date: "2025-06-01" }, // last budget year
      ],
      investBudget: 40_000_000,
      window: year,
    });

    const stocks = summary.classes.find((c) => c.name === "Stocks")!;
    expect(stocks.realized).toBe(750_000); // 500k trading + 250k yield
    const fixed = summary.classes.find((c) => c.name === "Fixed")!;
    expect(fixed.realized).toBe(400_000); // yield only, nothing sold
    expect(summary.totals.realized).toBe(1_150_000);

    // Trading state is untouched: half the position remains at cost.
    expect(stocks.holdingsCost).toBe(5_000_000);
    expect(stocks.deployed).toBe(4_500_000); // 10jt buy − 5.5jt sell proceeds
  });

  it("capitalBase overrides the budget: net worth = holdings + undeployed capital", () => {
    const summary = computeInvestmentSummary({
      assetClasses,
      targets,
      items,
      transactions: [
        tx("bbca", "buy", 30_000_000, null, "2025-02-01"),
        tx("depo", "buy", 50_000_000, null, "2026-02-01"),
      ],
      investBudget: 40_000_000, // current-year budget — ignored when capitalBase is set
      capitalBase: 120_000_000, // every Rp ever allocated to Invest envelopes
    });
    expect(summary.totals.budget).toBe(120_000_000);
    expect(summary.totals.deployed).toBe(80_000_000);
    // 80jt held at cost + (120jt − 80jt) undeployed capital.
    expect(summary.totals.netWorth).toBe(120_000_000);
  });

  it("archived classes disappear from rows but keep their holdings in totals", () => {
    const summary = computeInvestmentSummary({
      assetClasses: [
        { id: "stocks", name: "Stocks", is_active: true, sort: 1 },
        { id: "fixed", name: "Fixed", is_active: false, sort: 2 },
      ],
      targets,
      items,
      transactions: [tx("depo", "buy", 5_000_000, null, "2026-01-01")],
      investBudget: 10_000_000,
    });
    expect(summary.classes.map((c) => c.name)).toEqual(["Stocks"]);
    expect(summary.totals.holdingsCost).toBe(5_000_000);
  });
});
