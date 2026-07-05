// All summary math lives here. Pure functions, no I/O — unit tested in summary.test.ts.
//
// v2: every income carries its own stored envelope split (income_allocations),
// so allocated amounts are exact sums of stored cells — no derivation, no
// rounding, no "unconfigured split" case.

import type { Cadence } from "./types";

export interface IncomeTypeInput {
  id: string;
  name: string;
  cadence: Cadence;
}

export interface BudgetTypeInput {
  id: string;
  name: string;
}

export interface IncomeInput {
  id: string;
  income_type_id: string;
  amount: number;
}

export interface IncomeAllocationInput {
  income_id: string;
  budget_type_id: string;
  amount: number;
}

export interface ExpenseInput {
  budget_type_id: string;
  expense_category_id?: string | null;
  amount: number;
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
  /** Total income from monthly-cadence types in the window (0 ⇒ "no salary this month" note). */
  monthlyCadenceIncomeTotal: number;
}

/**
 * Budget performance for a window whose incomes/expenses are pre-filtered.
 * Allocated per budget type = sum of the stored splits of the counted incomes.
 *
 * - window "monthly": only splits of monthly-cadence incomes count.
 *   Yearly-cadence income received in the month does NOT inflate the budget.
 * - window "yearly": splits of ALL incomes in the window count.
 *
 * `incomeAllocations` may be a superset — only rows whose income is in
 * `incomes` (and passes the cadence filter) are used.
 */
export function computeBudgetPerformance(params: {
  window: "monthly" | "yearly";
  incomeTypes: IncomeTypeInput[];
  budgetTypes: BudgetTypeInput[];
  incomes: IncomeInput[];
  incomeAllocations: IncomeAllocationInput[];
  expenses: ExpenseInput[];
}): BudgetPerformanceResult {
  const { window, incomeTypes, budgetTypes, incomes, incomeAllocations, expenses } = params;

  const cadenceByType = new Map(incomeTypes.map((t) => [t.id, t.cadence]));
  let monthlyCadenceIncomeTotal = 0;
  const countedIncomeIds = new Set<string>();

  for (const income of incomes) {
    const cadence = cadenceByType.get(income.income_type_id);
    if (cadence === "monthly") monthlyCadenceIncomeTotal += income.amount;
    if (window === "monthly" && cadence !== "monthly") continue;
    countedIncomeIds.add(income.id);
  }

  const allocated = new Map<string, number>();
  for (const cell of incomeAllocations) {
    if (!countedIncomeIds.has(cell.income_id)) continue;
    allocated.set(cell.budget_type_id, (allocated.get(cell.budget_type_id) ?? 0) + cell.amount);
  }

  const spent = new Map<string, number>();
  for (const expense of expenses) {
    spent.set(
      expense.budget_type_id,
      (spent.get(expense.budget_type_id) ?? 0) + expense.amount
    );
  }

  const rows: BudgetPerformanceRow[] = budgetTypes.map((budgetType) => {
    const alloc = allocated.get(budgetType.id) ?? 0;
    const spentTotal = spent.get(budgetType.id) ?? 0;
    return {
      budget_type_id: budgetType.id,
      name: budgetType.name,
      allocated: alloc,
      spent: spentTotal,
      remaining: alloc - spentTotal,
    };
  });

  return { rows, monthlyCadenceIncomeTotal };
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
