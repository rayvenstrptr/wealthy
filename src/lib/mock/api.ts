// Mock-mode implementations mirroring the Supabase reads (lib/data.ts) and
// the storage half of the server actions. Same shapes, same semantics.

import type { ActionResult, ActionResultWithId } from "@/lib/actions/types";
import type {
  Cadence,
  Config,
  ExpenseRow,
  IncomeAllocation,
  IncomeRow,
  InvestmentConfig,
  InvestmentTransaction,
  TxSide,
} from "@/lib/types";
import type { ExpenseFilters, IncomeFilters } from "@/lib/data";
import type { SplitCell } from "@/lib/allocation-split";
import { validateSell } from "@/lib/investments";
import { loadDb, newId, saveDb, stamp, type MockDb } from "./store";

type Dated = { date: string; created_at: string };

function byDateDesc(a: Dated, b: Dated): number {
  return b.date.localeCompare(a.date) || b.created_at.localeCompare(a.created_at);
}

function byDateAsc(a: Dated, b: Dated): number {
  return a.date.localeCompare(b.date) || a.created_at.localeCompare(b.created_at);
}

// ---------- Reads ----------

export function getConfig(): Config {
  const db = loadDb();
  return {
    incomeTypes: db.incomeTypes,
    budgetTypes: db.budgetTypes,
    categories: db.categories,
    events: [...db.events].sort((a, b) => b.created_at.localeCompare(a.created_at)),
  };
}

export function getExpenses(filters: ExpenseFilters = {}): ExpenseRow[] {
  const db = loadDb();
  return db.expenses
    .filter(
      (e) =>
        (!filters.start || e.date >= filters.start) &&
        (!filters.end || e.date <= filters.end) &&
        (!filters.budgetTypeId || e.budget_type_id === filters.budgetTypeId) &&
        (!filters.categoryId || e.expense_category_id === filters.categoryId) &&
        (!filters.eventId || e.event_id === filters.eventId) &&
        (!filters.search || e.name.toLowerCase().includes(filters.search.toLowerCase()))
    )
    .sort(byDateDesc);
}

export function getIncomes(filters: IncomeFilters = {}): IncomeRow[] {
  const db = loadDb();
  return db.incomes
    .filter(
      (i) =>
        (!filters.start || i.date >= filters.start) &&
        (!filters.end || i.date <= filters.end) &&
        (!filters.incomeTypeId || i.income_type_id === filters.incomeTypeId) &&
        (!filters.search || i.name.toLowerCase().includes(filters.search.toLowerCase()))
    )
    .sort(byDateDesc);
}

export function getIncomeAllocations(incomeIds: string[]): IncomeAllocation[] {
  const db = loadDb();
  const wanted = new Set(incomeIds);
  return db.incomeAllocations.filter((a) => wanted.has(a.income_id));
}

/** Latest income's split per income type — prefill source for the income form. */
export function getLatestSplitByIncomeType(): Record<string, SplitCell[]> {
  const db = loadDb();
  const latestByType = new Map<string, IncomeRow & { created_at: string }>();
  for (const income of db.incomes) {
    const current = latestByType.get(income.income_type_id);
    if (!current || byDateDesc(income, current) < 0) latestByType.set(income.income_type_id, income);
  }
  const result: Record<string, SplitCell[]> = {};
  for (const [typeId, income] of latestByType) {
    result[typeId] = db.incomeAllocations
      .filter((a) => a.income_id === income.id)
      .map((a) => ({ budget_type_id: a.budget_type_id, amount: a.amount }));
  }
  return result;
}

export function getRecentExpenses(limit: number): ExpenseRow[] {
  return getExpenses().slice(0, limit);
}

export function getEventTotals(): Map<string, number> {
  const db = loadDb();
  const totals = new Map<string, number>();
  for (const expense of db.expenses) {
    if (!expense.event_id) continue;
    totals.set(expense.event_id, (totals.get(expense.event_id) ?? 0) + expense.amount);
  }
  return totals;
}

export function getInvestmentConfig(): InvestmentConfig {
  const db = loadDb();
  return {
    assetClasses: [...db.assetClasses].sort((a, b) => a.sort - b.sort),
    targets: db.assetClassTargets,
    items: db.investmentItems,
  };
}

export function getInvestmentTransactions(): InvestmentTransaction[] {
  const db = loadDb();
  // Chronological — the math folds these in order.
  return [...db.investmentTransactions].sort(byDateAsc);
}

// ---------- Settings writes ----------

export function createIncomeType(input: { name: string; cadence: Cadence }): ActionResult {
  const db = loadDb();
  if (db.incomeTypes.some((t) => t.name.toLowerCase() === input.name.toLowerCase())) {
    return { ok: false, error: "An income type with that name already exists." };
  }
  db.incomeTypes.push({
    id: newId(),
    name: input.name,
    cadence: input.cadence,
    is_active: true,
    created_at: stamp(),
  });
  saveDb(db);
  return { ok: true };
}

export function updateIncomeType(
  id: string,
  input: { name?: string; cadence?: Cadence; is_active?: boolean }
): ActionResult {
  const db = loadDb();
  const row = db.incomeTypes.find((t) => t.id === id);
  if (!row) return { ok: false, error: "Income type not found." };
  if (input.name !== undefined) row.name = input.name;
  if (input.cadence !== undefined) row.cadence = input.cadence;
  if (input.is_active !== undefined) row.is_active = input.is_active;
  saveDb(db);
  return { ok: true };
}

export function createBudgetType(name: string): ActionResult {
  const db = loadDb();
  db.budgetTypes.push({ id: newId(), name, kind: "spending", is_active: true, created_at: stamp() });
  saveDb(db);
  return { ok: true };
}

export function updateBudgetType(
  id: string,
  input: { name?: string; is_active?: boolean }
): ActionResult {
  const db = loadDb();
  const row = db.budgetTypes.find((t) => t.id === id);
  if (!row) return { ok: false, error: "Budget type not found." };
  if (input.name !== undefined) row.name = input.name;
  if (input.is_active !== undefined) row.is_active = input.is_active;
  saveDb(db);
  return { ok: true };
}

export function createExpenseCategory(input: {
  name: string;
  defaultBudgetTypeId: string | null;
}): ActionResult {
  const db = loadDb();
  db.categories.push({
    id: newId(),
    name: input.name,
    default_budget_type_id: input.defaultBudgetTypeId,
    is_active: true,
    created_at: stamp(),
  });
  saveDb(db);
  return { ok: true };
}

export function updateExpenseCategory(
  id: string,
  input: { name?: string; default_budget_type_id?: string | null; is_active?: boolean }
): ActionResult {
  const db = loadDb();
  const row = db.categories.find((c) => c.id === id);
  if (!row) return { ok: false, error: "Category not found." };
  if (input.name !== undefined) row.name = input.name;
  if (input.default_budget_type_id !== undefined)
    row.default_budget_type_id = input.default_budget_type_id;
  if (input.is_active !== undefined) row.is_active = input.is_active;
  saveDb(db);
  return { ok: true };
}

// ---------- Investment settings writes ----------

export function createAssetClass(name: string): ActionResult {
  const db = loadDb();
  if (db.assetClasses.some((c) => c.name.toLowerCase() === name.toLowerCase())) {
    return { ok: false, error: "An asset class with that name already exists." };
  }
  const maxSort = db.assetClasses.reduce((max, c) => Math.max(max, c.sort), -1);
  db.assetClasses.push({
    id: newId(),
    name,
    is_active: true,
    sort: maxSort + 1,
    created_at: stamp(),
  });
  saveDb(db);
  return { ok: true };
}

export function updateAssetClass(
  id: string,
  input: { name?: string; is_active?: boolean; sort?: number }
): ActionResult {
  const db = loadDb();
  const row = db.assetClasses.find((c) => c.id === id);
  if (!row) return { ok: false, error: "Asset class not found." };
  if (input.name !== undefined) row.name = input.name;
  if (input.is_active !== undefined) row.is_active = input.is_active;
  if (input.sort !== undefined) row.sort = input.sort;
  saveDb(db);
  return { ok: true };
}

export function saveClassTargets(
  year: string,
  cells: { assetClassId: string; percent: number }[]
): ActionResult {
  const db = loadDb();
  for (const cell of cells) {
    const existing = db.assetClassTargets.find(
      (t) => t.asset_class_id === cell.assetClassId && t.year === year
    );
    if (existing) {
      existing.percent = cell.percent;
    } else {
      db.assetClassTargets.push({
        id: newId(),
        asset_class_id: cell.assetClassId,
        year,
        percent: cell.percent,
        created_at: stamp(),
      });
    }
  }
  saveDb(db);
  return { ok: true };
}

export function createInvestmentItem(input: {
  name: string;
  assetClassId: string;
}): ActionResultWithId {
  const db = loadDb();
  if (!db.assetClasses.some((c) => c.id === input.assetClassId)) {
    return { ok: false, error: "Asset class not found." };
  }
  const id = newId();
  db.investmentItems.push({
    id,
    asset_class_id: input.assetClassId,
    name: input.name,
    is_active: true,
    created_at: stamp(),
  });
  saveDb(db);
  return { ok: true, id };
}

export function updateInvestmentItem(
  id: string,
  input: { name?: string; is_active?: boolean }
): ActionResult {
  const db = loadDb();
  const row = db.investmentItems.find((i) => i.id === id);
  if (!row) return { ok: false, error: "Item not found." };
  if (input.name !== undefined) row.name = input.name;
  if (input.is_active !== undefined) row.is_active = input.is_active;
  saveDb(db);
  return { ok: true };
}

// ---------- Entry writes ----------

type ExpenseInput = Omit<ExpenseRow, "id">;
type IncomeInput = Omit<IncomeRow, "id"> & { allocations: SplitCell[] };

export function createExpense(input: ExpenseInput): ActionResult {
  const db = loadDb();
  db.expenses.push({ id: newId(), ...input, created_at: stamp() });
  saveDb(db);
  return { ok: true };
}

export function updateExpense(id: string, input: ExpenseInput): ActionResult {
  const db = loadDb();
  const row = db.expenses.find((e) => e.id === id);
  if (!row) return { ok: false, error: "Expense not found." };
  Object.assign(row, input);
  saveDb(db);
  return { ok: true };
}

export function deleteExpense(id: string): ActionResult {
  const db = loadDb();
  db.expenses = db.expenses.filter((e) => e.id !== id);
  saveDb(db);
  return { ok: true };
}

function writeSplit(db: MockDb, incomeId: string, cells: SplitCell[]): void {
  db.incomeAllocations = db.incomeAllocations.filter((a) => a.income_id !== incomeId);
  for (const cell of cells) {
    if (cell.amount <= 0) continue; // only non-zero cells are stored
    db.incomeAllocations.push({
      id: newId(),
      income_id: incomeId,
      budget_type_id: cell.budget_type_id,
      amount: cell.amount,
      created_at: stamp(),
    });
  }
}

export function createIncome(input: IncomeInput): ActionResult {
  const db = loadDb();
  const { allocations, ...income } = input;
  const id = newId();
  db.incomes.push({ id, ...income, created_at: stamp() });
  writeSplit(db, id, allocations);
  saveDb(db);
  return { ok: true };
}

export function updateIncome(id: string, input: IncomeInput): ActionResult {
  const db = loadDb();
  const row = db.incomes.find((i) => i.id === id);
  if (!row) return { ok: false, error: "Income not found." };
  const { allocations, ...income } = input;
  Object.assign(row, income);
  writeSplit(db, id, allocations);
  saveDb(db);
  return { ok: true };
}

export function deleteIncome(id: string): ActionResult {
  const db = loadDb();
  db.incomes = db.incomes.filter((i) => i.id !== id);
  db.incomeAllocations = db.incomeAllocations.filter((a) => a.income_id !== id); // FK cascade
  saveDb(db);
  return { ok: true };
}

interface EventInput {
  name: string;
  starts_on: string | null;
  ends_on: string | null;
  notes: string | null;
}

export function createEvent(input: EventInput): ActionResultWithId {
  const db = loadDb();
  const id = newId();
  db.events.push({ id, ...input, created_at: stamp() });
  saveDb(db);
  return { ok: true, id };
}

export function updateEvent(id: string, input: EventInput): ActionResult {
  const db = loadDb();
  const row = db.events.find((e) => e.id === id);
  if (!row) return { ok: false, error: "Event not found." };
  Object.assign(row, input);
  saveDb(db);
  return { ok: true };
}

export function deleteEvent(id: string): ActionResult {
  const db = loadDb();
  if (db.expenses.some((e) => e.event_id === id)) {
    return { ok: false, error: "This event has expenses attached — remove them first." };
  }
  db.events = db.events.filter((e) => e.id !== id);
  saveDb(db);
  return { ok: true };
}

// ---------- Bulk import ----------

export interface ImportExpenseInput {
  name: string;
  amount: number;
  date: string;
  budget_type_id: string;
  expense_category_id: string;
  notes: string | null;
}

export interface ImportIncomeInput {
  name: string;
  amount: number;
  date: string;
  income_type_id: string;
  notes: string | null;
  allocations: SplitCell[];
}

/** Insert a whole xlsx import in one load/save (one write per file, not per row). */
export function importEntries(
  expenses: ImportExpenseInput[],
  incomes: ImportIncomeInput[]
): ActionResult {
  const db = loadDb();
  // Monotonic created_at so same-date rows keep their sheet order.
  let tick = Date.now();
  const next = () => new Date(tick++).toISOString();
  for (const expense of expenses) {
    db.expenses.push({ id: newId(), ...expense, event_id: null, created_at: next() });
  }
  for (const income of incomes) {
    const { allocations, ...row } = income;
    const id = newId();
    db.incomes.push({ id, ...row, created_at: next() });
    for (const cell of allocations) {
      if (cell.amount <= 0) continue;
      db.incomeAllocations.push({
        id: newId(),
        income_id: id,
        budget_type_id: cell.budget_type_id,
        amount: cell.amount,
        created_at: next(),
      });
    }
  }
  saveDb(db);
  return { ok: true };
}

// ---------- Investment transaction writes ----------

interface TransactionInput {
  item_id: string;
  side: TxSide;
  amount: number;
  quantity: number | null;
  date: string;
  notes: string | null;
}

export function createInvestmentTransaction(input: TransactionInput): ActionResult {
  const db = loadDb();
  if (!db.investmentItems.some((i) => i.id === input.item_id)) {
    return { ok: false, error: "Item not found." };
  }
  if (input.side === "sell") {
    const error = validateSell(getInvestmentTransactions(), input);
    if (error) return { ok: false, error };
  }
  db.investmentTransactions.push({ id: newId(), ...input, created_at: stamp() });
  saveDb(db);
  return { ok: true };
}

export function updateInvestmentTransaction(id: string, input: TransactionInput): ActionResult {
  const db = loadDb();
  const row = db.investmentTransactions.find((t) => t.id === id);
  if (!row) return { ok: false, error: "Transaction not found." };
  if (input.side === "sell") {
    const error = validateSell(getInvestmentTransactions(), input, id);
    if (error) return { ok: false, error };
  }
  Object.assign(row, input);
  saveDb(db);
  return { ok: true };
}

export function deleteInvestmentTransaction(id: string): ActionResult {
  const db = loadDb();
  db.investmentTransactions = db.investmentTransactions.filter((t) => t.id !== id);
  saveDb(db);
  return { ok: true };
}
