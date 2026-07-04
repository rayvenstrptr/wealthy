import { describe, expect, it } from "vitest";
import {
  computeBudgetPerformance,
  computeTotals,
  deriveRowPercents,
  percentRowSum,
  summarizeEvent,
  summarizeIncomeByType,
  type AllocationCellInput,
  type BudgetTypeInput,
  type IncomeTypeInput,
} from "./summary";

const budgetTypes: BudgetTypeInput[] = [
  { id: "bt-invest", name: "Invest" },
  { id: "bt-cash", name: "Cash" },
  { id: "bt-life", name: "Life" },
  { id: "bt-fun", name: "Fun" },
  { id: "bt-giving", name: "Giving" },
];

const salary: IncomeTypeInput = {
  id: "it-salary",
  name: "Salary",
  cadence: "monthly",
  allocation_mode: "amount",
};
const thr: IncomeTypeInput = {
  id: "it-thr",
  name: "THR",
  cadence: "yearly",
  allocation_mode: "percent",
};
const bonus: IncomeTypeInput = {
  id: "it-bonus",
  name: "Bonus",
  cadence: "yearly",
  allocation_mode: "percent",
};

// Salary in amount mode on a 10jt base: 2jt / 1jt / 5jt / 1.5jt / 500k
const salaryCells: AllocationCellInput[] = [
  { income_type_id: "it-salary", budget_type_id: "bt-invest", percent: null, amount: 2_000_000 },
  { income_type_id: "it-salary", budget_type_id: "bt-cash", percent: null, amount: 1_000_000 },
  { income_type_id: "it-salary", budget_type_id: "bt-life", percent: null, amount: 5_000_000 },
  { income_type_id: "it-salary", budget_type_id: "bt-fun", percent: null, amount: 1_500_000 },
  { income_type_id: "it-salary", budget_type_id: "bt-giving", percent: null, amount: 500_000 },
];

// THR in percent mode: 20 / 0 / 50 / 30 / 0
const thrCells: AllocationCellInput[] = [
  { income_type_id: "it-thr", budget_type_id: "bt-invest", percent: 20, amount: null },
  { income_type_id: "it-thr", budget_type_id: "bt-cash", percent: 0, amount: null },
  { income_type_id: "it-thr", budget_type_id: "bt-life", percent: 50, amount: null },
  { income_type_id: "it-thr", budget_type_id: "bt-fun", percent: 30, amount: null },
  { income_type_id: "it-thr", budget_type_id: "bt-giving", percent: 0, amount: null },
];

describe("deriveRowPercents", () => {
  it("derives % from amounts (amount ÷ row total)", () => {
    const percents = deriveRowPercents("amount", salaryCells);
    expect(percents).not.toBeNull();
    expect(percents!.get("bt-invest")).toBeCloseTo(0.2);
    expect(percents!.get("bt-cash")).toBeCloseTo(0.1);
    expect(percents!.get("bt-life")).toBeCloseTo(0.5);
    expect(percents!.get("bt-fun")).toBeCloseTo(0.15);
    expect(percents!.get("bt-giving")).toBeCloseTo(0.05);
    // Amount mode sums to 1 by construction
    const sum = [...percents!.values()].reduce((s, v) => s + v, 0);
    expect(sum).toBeCloseTo(1);
  });

  it("passes percent-mode values through as fractions", () => {
    const percents = deriveRowPercents("percent", thrCells);
    expect(percents!.get("bt-invest")).toBeCloseTo(0.2);
    expect(percents!.get("bt-fun")).toBeCloseTo(0.3);
    expect(percents!.get("bt-cash")).toBe(0);
  });

  it("returns null when no allocation is defined", () => {
    expect(deriveRowPercents("percent", [])).toBeNull();
    expect(deriveRowPercents("amount", [])).toBeNull();
    expect(
      deriveRowPercents("amount", [
        { income_type_id: "x", budget_type_id: "bt-invest", percent: null, amount: 0 },
      ])
    ).toBeNull();
    expect(
      deriveRowPercents("percent", [
        { income_type_id: "x", budget_type_id: "bt-invest", percent: null, amount: null },
      ])
    ).toBeNull();
  });

  it("sums percent rows for the ≠100 warning", () => {
    expect(percentRowSum(thrCells)).toBe(100);
    expect(
      percentRowSum([
        { income_type_id: "x", budget_type_id: "bt-invest", percent: 40, amount: null },
        { income_type_id: "x", budget_type_id: "bt-life", percent: 30, amount: null },
      ])
    ).toBe(70);
  });
});

describe("monthly budget performance (salary-based)", () => {
  it("allocates derived % × actual salary received, not the flat amounts", () => {
    // Salary lands at 10.5jt instead of the 10jt base → Invest gets 2.1jt, not 2jt
    const result = computeBudgetPerformance({
      window: "monthly",
      incomeTypes: [salary, thr],
      budgetTypes,
      allocations: [...salaryCells, ...thrCells],
      incomes: [{ income_type_id: "it-salary", amount: 10_500_000 }],
      expenses: [{ budget_type_id: "bt-life", amount: 3_000_000 }],
    });

    const byName = Object.fromEntries(result.rows.map((r) => [r.name, r]));
    expect(byName.Invest.allocated).toBe(2_100_000);
    expect(byName.Cash.allocated).toBe(1_050_000);
    expect(byName.Life.allocated).toBe(5_250_000);
    expect(byName.Fun.allocated).toBe(1_575_000);
    expect(byName.Giving.allocated).toBe(525_000);
    expect(byName.Life.spent).toBe(3_000_000);
    expect(byName.Life.remaining).toBe(2_250_000);
  });

  it("excludes yearly-cadence income (THR) from the monthly budget", () => {
    const result = computeBudgetPerformance({
      window: "monthly",
      incomeTypes: [salary, thr],
      budgetTypes,
      allocations: [...salaryCells, ...thrCells],
      incomes: [
        { income_type_id: "it-salary", amount: 10_000_000 },
        { income_type_id: "it-thr", amount: 5_000_000 }, // received this month, must not inflate it
      ],
      expenses: [],
    });
    const invest = result.rows.find((r) => r.name === "Invest")!;
    expect(invest.allocated).toBe(2_000_000); // 20% × salary only
  });

  it("flags overspend via negative remaining", () => {
    const result = computeBudgetPerformance({
      window: "monthly",
      incomeTypes: [salary],
      budgetTypes,
      allocations: salaryCells,
      incomes: [{ income_type_id: "it-salary", amount: 10_000_000 }],
      expenses: [{ budget_type_id: "bt-fun", amount: 2_000_000 }],
    });
    const fun = result.rows.find((r) => r.name === "Fun")!;
    expect(fun.allocated).toBe(1_500_000);
    expect(fun.remaining).toBe(-500_000);
  });

  it("handles a no-salary month: allocated 0, spent still counted", () => {
    const result = computeBudgetPerformance({
      window: "monthly",
      incomeTypes: [salary],
      budgetTypes,
      allocations: salaryCells,
      incomes: [],
      expenses: [{ budget_type_id: "bt-life", amount: 750_000 }],
    });
    expect(result.monthlyCadenceIncomeTotal).toBe(0);
    const life = result.rows.find((r) => r.name === "Life")!;
    expect(life.allocated).toBe(0);
    expect(life.spent).toBe(750_000);
    expect(life.remaining).toBe(-750_000);
  });
});

describe("yearly budget performance (all income)", () => {
  it("sums each income type's derived % × yearly income per budget type", () => {
    const result = computeBudgetPerformance({
      window: "yearly",
      incomeTypes: [salary, thr],
      budgetTypes,
      allocations: [...salaryCells, ...thrCells],
      incomes: [
        // 12 months of salary
        { income_type_id: "it-salary", amount: 120_000_000 },
        { income_type_id: "it-thr", amount: 10_000_000 },
      ],
      expenses: [],
    });
    const byName = Object.fromEntries(result.rows.map((r) => [r.name, r]));
    // Invest: 20% × 120jt + 20% × 10jt = 26jt
    expect(byName.Invest.allocated).toBe(26_000_000);
    // Fun: 15% × 120jt + 30% × 10jt = 21jt
    expect(byName.Fun.allocated).toBe(21_000_000);
    // Cash: 10% × 120jt + 0% × 10jt = 12jt
    expect(byName.Cash.allocated).toBe(12_000_000);
  });

  it("excludes income types without an allocation and reports them", () => {
    const result = computeBudgetPerformance({
      window: "yearly",
      incomeTypes: [salary, bonus], // bonus has no allocation cells
      budgetTypes,
      allocations: salaryCells,
      incomes: [
        { income_type_id: "it-salary", amount: 120_000_000 },
        { income_type_id: "it-bonus", amount: 8_000_000 },
      ],
      expenses: [],
    });
    expect(result.unallocatedIncomeTypeNames).toEqual(["Bonus"]);
    const invest = result.rows.find((r) => r.name === "Invest")!;
    expect(invest.allocated).toBe(24_000_000); // salary only — bonus excluded
  });
});

describe("totals and groupings", () => {
  it("computes income / expenses / net", () => {
    const totals = computeTotals(
      [{ income_type_id: "it-salary", amount: 10_000_000 }],
      [
        { budget_type_id: "bt-life", amount: 3_000_000 },
        { budget_type_id: "bt-fun", amount: 500_000 },
      ]
    );
    expect(totals).toEqual({ income: 10_000_000, expenses: 3_500_000, net: 6_500_000 });
  });

  it("summarizes income by type, non-zero only, largest first", () => {
    const rows = summarizeIncomeByType(
      [
        { income_type_id: "it-salary", amount: 10_000_000 },
        { income_type_id: "it-thr", amount: 12_000_000 },
      ],
      [salary, thr, bonus]
    );
    expect(rows.map((r) => r.name)).toEqual(["THR", "Salary"]);
    expect(rows[0].cadence).toBe("yearly");
  });
});

describe("event summary", () => {
  it("totals event expenses across months/years, ignoring any period filter", () => {
    // Bali trip spanning Dec 2025 → Jan 2026: both expenses count
    const eventExpenses = [
      { budget_type_id: "bt-fun", expense_category_id: "cat-extra", amount: 4_000_000 }, // Dec 2025
      { budget_type_id: "bt-life", expense_category_id: "cat-food", amount: 1_500_000 }, // Jan 2026
    ];
    const summary = summarizeEvent(
      eventExpenses,
      budgetTypes,
      [
        { id: "cat-extra", name: "Extra" },
        { id: "cat-food", name: "Food" },
      ]
    );
    expect(summary.total).toBe(5_500_000);
    expect(summary.byBudgetType).toEqual([
      { id: "bt-fun", name: "Fun", total: 4_000_000 },
      { id: "bt-life", name: "Life", total: 1_500_000 },
    ]);
    expect(summary.byCategory.map((r) => r.name)).toEqual(["Extra", "Food"]);
  });
});
