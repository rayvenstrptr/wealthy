// All summary math lives here. Pure functions, no I/O — unit tested in summary.test.ts.
//
// Core rule: allocation is ALWAYS derived-% × actual income received.
// Amounts in `amount` mode are only a convenient way to define percentages.

import type { AllocationMode, Cadence } from "./types";

export interface AllocationCellInput {
  income_type_id: string;
  budget_type_id: string;
  percent: number | null;
  amount: number | null;
}

export interface IncomeTypeInput {
  id: string;
  name: string;
  cadence: Cadence;
  allocation_mode: AllocationMode;
}

export interface BudgetTypeInput {
  id: string;
  name: string;
}

export interface IncomeInput {
  income_type_id: string;
  amount: number;
}

export interface ExpenseInput {
  budget_type_id: string;
  expense_category_id?: string | null;
  amount: number;
}

/**
 * Derived percentages for one income type's allocation row, as fractions
 * (0..1) keyed by budget_type_id.
 *
 * - percent mode: percent ÷ 100 per cell. May not sum to 1 (UI warns, math
 *   applies them as-is).
 * - amount mode: amount ÷ sum of amounts — sums to 1 by construction.
 *
 * Returns null when the row defines no usable allocation (no cells, all
 * values null, or amount mode summing to 0) — callers treat that income
 * type as "no budget split configured".
 */
export function deriveRowPercents(
  mode: AllocationMode,
  cells: AllocationCellInput[]
): Map<string, number> | null {
  if (mode === "amount") {
    const filled = cells.filter((c) => c.amount != null);
    const total = filled.reduce((sum, c) => sum + (c.amount ?? 0), 0);
    if (total <= 0) return null;
    return new Map(filled.map((c) => [c.budget_type_id, (c.amount ?? 0) / total]));
  }
  const filled = cells.filter((c) => c.percent != null);
  if (filled.length === 0) return null;
  return new Map(filled.map((c) => [c.budget_type_id, (c.percent ?? 0) / 100]));
}

/** Sum of percent-mode cells in percent units (for the "≠ 100" warning). */
export function percentRowSum(cells: AllocationCellInput[]): number {
  return cells.reduce((sum, c) => sum + (c.percent ?? 0), 0);
}

export interface BudgetPerformanceRow {
  budget_type_id: string;
  name: string;
  allocated: number;
  spent: number;
  remaining: number;
}

export interface BudgetPerformanceResult {
  rows: BudgetPerformanceRow[];
  /** Names of income types that received income in the window but have no usable allocation row. */
  unallocatedIncomeTypeNames: string[];
  /** Total income from monthly-cadence types in the window (0 ⇒ "no salary this month" note). */
  monthlyCadenceIncomeTotal: number;
}

/**
 * Budget performance for a window whose incomes/expenses are pre-filtered.
 *
 * - window "monthly": allocated = monthly-cadence income that month × those
 *   types' derived %s. Yearly-cadence income received in the month does NOT
 *   inflate the month's budget.
 * - window "yearly": allocated = ALL income received that year × each income
 *   type's derived %s, summed per budget type.
 */
export function computeBudgetPerformance(params: {
  window: "monthly" | "yearly";
  incomeTypes: IncomeTypeInput[];
  budgetTypes: BudgetTypeInput[];
  allocations: AllocationCellInput[];
  incomes: IncomeInput[];
  expenses: ExpenseInput[];
}): BudgetPerformanceResult {
  const { window, incomeTypes, budgetTypes, allocations, incomes, expenses } = params;

  const incomeByType = new Map<string, number>();
  for (const income of incomes) {
    incomeByType.set(
      income.income_type_id,
      (incomeByType.get(income.income_type_id) ?? 0) + income.amount
    );
  }

  const allocated = new Map<string, number>();
  const unallocatedIncomeTypeNames: string[] = [];
  let monthlyCadenceIncomeTotal = 0;

  for (const incomeType of incomeTypes) {
    const received = incomeByType.get(incomeType.id) ?? 0;
    if (incomeType.cadence === "monthly") monthlyCadenceIncomeTotal += received;
    if (received <= 0) continue;

    const cells = allocations.filter((a) => a.income_type_id === incomeType.id);
    const percents = deriveRowPercents(incomeType.allocation_mode, cells);
    if (percents === null) {
      unallocatedIncomeTypeNames.push(incomeType.name);
      continue;
    }

    // Monthly budget is driven only by monthly-cadence income.
    if (window === "monthly" && incomeType.cadence !== "monthly") continue;

    for (const [budgetTypeId, fraction] of percents) {
      allocated.set(budgetTypeId, (allocated.get(budgetTypeId) ?? 0) + received * fraction);
    }
  }

  const spent = new Map<string, number>();
  for (const expense of expenses) {
    spent.set(
      expense.budget_type_id,
      (spent.get(expense.budget_type_id) ?? 0) + expense.amount
    );
  }

  const rows: BudgetPerformanceRow[] = budgetTypes.map((budgetType) => {
    const alloc = Math.round(allocated.get(budgetType.id) ?? 0);
    const spentTotal = spent.get(budgetType.id) ?? 0;
    return {
      budget_type_id: budgetType.id,
      name: budgetType.name,
      allocated: alloc,
      spent: spentTotal,
      remaining: alloc - spentTotal,
    };
  });

  return { rows, unallocatedIncomeTypeNames, monthlyCadenceIncomeTotal };
}

export interface TotalsResult {
  income: number;
  expenses: number;
  net: number;
}

export function computeTotals(incomes: IncomeInput[], expenses: ExpenseInput[]): TotalsResult {
  const income = incomes.reduce((sum, i) => sum + i.amount, 0);
  const spent = expenses.reduce((sum, e) => sum + e.amount, 0);
  return { income, expenses: spent, net: income - spent };
}

export interface IncomeByTypeRow {
  income_type_id: string;
  name: string;
  cadence: Cadence;
  total: number;
}

/** Per-type income totals, non-zero types only, largest first. */
export function summarizeIncomeByType(
  incomes: IncomeInput[],
  incomeTypes: IncomeTypeInput[]
): IncomeByTypeRow[] {
  const totals = new Map<string, number>();
  for (const income of incomes) {
    totals.set(income.income_type_id, (totals.get(income.income_type_id) ?? 0) + income.amount);
  }
  return incomeTypes
    .filter((t) => (totals.get(t.id) ?? 0) > 0)
    .map((t) => ({
      income_type_id: t.id,
      name: t.name,
      cadence: t.cadence,
      total: totals.get(t.id) ?? 0,
    }))
    .sort((a, b) => b.total - a.total);
}

export interface GroupTotalRow {
  id: string;
  name: string;
  total: number;
}

/** Expense totals grouped by an arbitrary key (category or budget type). */
export function summarizeExpensesBy(
  expenses: ExpenseInput[],
  key: "expense_category_id" | "budget_type_id",
  names: { id: string; name: string }[]
): GroupTotalRow[] {
  const totals = new Map<string, number>();
  for (const expense of expenses) {
    const id = (key === "budget_type_id" ? expense.budget_type_id : expense.expense_category_id) ?? "";
    if (!id) continue;
    totals.set(id, (totals.get(id) ?? 0) + expense.amount);
  }
  const nameById = new Map(names.map((n) => [n.id, n.name]));
  return [...totals.entries()]
    .map(([id, total]) => ({ id, name: nameById.get(id) ?? "Unknown", total }))
    .sort((a, b) => b.total - a.total);
}

/**
 * Event summary: total + breakdowns. Expenses passed in are ALL expenses of
 * the event regardless of date — events cross months/years by design.
 */
export function summarizeEvent(
  expenses: ExpenseInput[],
  budgetTypes: { id: string; name: string }[],
  categories: { id: string; name: string }[]
): { total: number; byBudgetType: GroupTotalRow[]; byCategory: GroupTotalRow[] } {
  return {
    total: expenses.reduce((sum, e) => sum + e.amount, 0),
    byBudgetType: summarizeExpensesBy(expenses, "budget_type_id", budgetTypes),
    byCategory: summarizeExpensesBy(expenses, "expense_category_id", categories),
  };
}
