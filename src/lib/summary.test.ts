import { describe, expect, it } from "vitest";
import {
  computeBudgetPerformance,
  computeTotals,
  summarizeEvent,
  summarizeIncomeByType,
  type BudgetTypeInput,
  type IncomeAllocationInput,
  type IncomeTypeInput,
} from "./summary";

const budgetTypes: BudgetTypeInput[] = [
  { id: "bt-invest", name: "Invest" },
  { id: "bt-cash", name: "Cash" },
  { id: "bt-life", name: "Life" },
  { id: "bt-fun", name: "Fun" },
  { id: "bt-giving", name: "Giving" },
];

const salary: IncomeTypeInput = { id: "it-salary", name: "Salary", cadence: "monthly" };
const thr: IncomeTypeInput = { id: "it-thr", name: "THR", cadence: "yearly" };
const bonus: IncomeTypeInput = { id: "it-bonus", name: "Bonus", cadence: "yearly" };

/** Split helper: cells for one income. */
function split(incomeId: string, cells: Record<string, number>): IncomeAllocationInput[] {
  return Object.entries(cells).map(([budget_type_id, amount]) => ({
    income_id: incomeId,
    budget_type_id,
    amount,
  }));
}

// July salary landed at 10.5jt, split 20/10/50/15/5.
const julySalary = { id: "inc-jul", income_type_id: "it-salary", amount: 10_500_000 };
const julySalarySplit = split("inc-jul", {
  "bt-invest": 2_100_000,
  "bt-cash": 1_050_000,
  "bt-life": 5_250_000,
  "bt-fun": 1_575_000,
  "bt-giving": 525_000,
});

// THR 5jt split 20/0/50/30/0 (zero cells not stored).
const thrIncome = { id: "inc-thr", income_type_id: "it-thr", amount: 5_000_000 };
const thrSplit = split("inc-thr", {
  "bt-invest": 1_000_000,
  "bt-life": 2_500_000,
  "bt-fun": 1_500_000,
});

describe("monthly budget performance (salary-based)", () => {
  it("allocates each income's stored split exactly", () => {
    const result = computeBudgetPerformance({
      window: "monthly",
      incomeTypes: [salary, thr],
      budgetTypes,
      incomes: [julySalary],
      incomeAllocations: julySalarySplit,
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
    expect(result.monthlyCadenceIncomeTotal).toBe(10_500_000);
  });

  it("excludes yearly-cadence income (THR) splits from the monthly budget", () => {
    const result = computeBudgetPerformance({
      window: "monthly",
      incomeTypes: [salary, thr],
      budgetTypes,
      incomes: [julySalary, thrIncome], // THR received this month must not inflate it
      incomeAllocations: [...julySalarySplit, ...thrSplit],
      expenses: [],
    });
    const invest = result.rows.find((r) => r.name === "Invest")!;
    expect(invest.allocated).toBe(2_100_000); // salary split only
  });

  it("ignores allocation rows whose income is outside the window", () => {
    // Superset of allocations passed in; only inc-jul is in `incomes`.
    const result = computeBudgetPerformance({
      window: "monthly",
      incomeTypes: [salary],
      budgetTypes,
      incomes: [julySalary],
      incomeAllocations: [
        ...julySalarySplit,
        ...split("inc-aug", { "bt-invest": 9_999_999 }),
      ],
      expenses: [],
    });
    const invest = result.rows.find((r) => r.name === "Invest")!;
    expect(invest.allocated).toBe(2_100_000);
  });

  it("flags overspend via negative remaining", () => {
    const result = computeBudgetPerformance({
      window: "monthly",
      incomeTypes: [salary],
      budgetTypes,
      incomes: [julySalary],
      incomeAllocations: julySalarySplit,
      expenses: [{ budget_type_id: "bt-fun", amount: 2_000_000 }],
    });
    const fun = result.rows.find((r) => r.name === "Fun")!;
    expect(fun.allocated).toBe(1_575_000);
    expect(fun.remaining).toBe(-425_000);
  });

  it("handles a no-salary month: allocated 0, spent still counted", () => {
    const result = computeBudgetPerformance({
      window: "monthly",
      incomeTypes: [salary],
      budgetTypes,
      incomes: [],
      incomeAllocations: [],
      expenses: [{ budget_type_id: "bt-life", amount: 750_000 }],
    });
    expect(result.monthlyCadenceIncomeTotal).toBe(0);
    const life = result.rows.find((r) => r.name === "Life")!;
    expect(life.allocated).toBe(0);
    expect(life.spent).toBe(750_000);
    expect(life.remaining).toBe(-750_000);
  });

  it("an income with no stored split contributes 0 (defensive)", () => {
    const result = computeBudgetPerformance({
      window: "monthly",
      incomeTypes: [salary],
      budgetTypes,
      incomes: [julySalary],
      incomeAllocations: [],
      expenses: [],
    });
    expect(result.rows.every((r) => r.allocated === 0)).toBe(true);
    expect(result.monthlyCadenceIncomeTotal).toBe(10_500_000);
  });
});

describe("yearly budget performance (all income)", () => {
  it("sums the stored splits of every income in the window per budget type", () => {
    // 12 months of salary (recorded as one row here) + THR
    const yearSalary = { id: "inc-year", income_type_id: "it-salary", amount: 120_000_000 };
    const yearSalarySplit = split("inc-year", {
      "bt-invest": 24_000_000,
      "bt-cash": 12_000_000,
      "bt-life": 60_000_000,
      "bt-fun": 18_000_000,
      "bt-giving": 6_000_000,
    });
    const result = computeBudgetPerformance({
      window: "yearly",
      incomeTypes: [salary, thr],
      budgetTypes,
      incomes: [yearSalary, thrIncome],
      incomeAllocations: [...yearSalarySplit, ...thrSplit],
      expenses: [],
    });
    const byName = Object.fromEntries(result.rows.map((r) => [r.name, r]));
    expect(byName.Invest.allocated).toBe(25_000_000); // 24jt + 1jt
    expect(byName.Fun.allocated).toBe(19_500_000); // 18jt + 1.5jt
    expect(byName.Cash.allocated).toBe(12_000_000); // THR gave Cash nothing
  });

  it("yearly window counts yearly-cadence incomes (unlike monthly)", () => {
    const bonusIncome = { id: "inc-bonus", income_type_id: "it-bonus", amount: 8_000_000 };
    const result = computeBudgetPerformance({
      window: "yearly",
      incomeTypes: [salary, bonus],
      budgetTypes,
      incomes: [bonusIncome],
      incomeAllocations: split("inc-bonus", { "bt-invest": 8_000_000 }),
      expenses: [],
    });
    const invest = result.rows.find((r) => r.name === "Invest")!;
    expect(invest.allocated).toBe(8_000_000);
    expect(result.monthlyCadenceIncomeTotal).toBe(0);
  });
});

describe("totals and groupings", () => {
  it("computes income / expenses / net", () => {
    const totals = computeTotals(
      [{ id: "i1", income_type_id: "it-salary", amount: 10_000_000 }],
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
        { id: "i1", income_type_id: "it-salary", amount: 10_000_000 },
        { id: "i2", income_type_id: "it-thr", amount: 12_000_000 },
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
