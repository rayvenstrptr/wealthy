// Mock-mode implementations mirroring the Supabase reads (lib/data.ts) and
// the storage half of the server actions. Same shapes, same semantics.

import type { ActionResult, ActionResultWithId } from "@/lib/actions/types";
import type {
  AllocationMode,
  Cadence,
  Config,
  ExpenseRow,
  IncomeRow,
} from "@/lib/types";
import type { ExpenseFilters, IncomeFilters } from "@/lib/data";
import { loadDb, newId, saveDb, stamp } from "./store";

type Dated = { date: string; created_at: string };

function byDateDesc(a: Dated, b: Dated): number {
  return b.date.localeCompare(a.date) || b.created_at.localeCompare(a.created_at);
}

// ---------- Reads ----------

export function getConfig(): Config {
  const db = loadDb();
  return {
    incomeTypes: db.incomeTypes,
    budgetTypes: db.budgetTypes,
    allocations: db.allocations,
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
    allocation_mode: "percent",
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
  db.budgetTypes.push({ id: newId(), name, is_active: true, created_at: stamp() });
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

export function saveAllocationRow(input: {
  incomeTypeId: string;
  mode: AllocationMode;
  cells: { budgetTypeId: string; value: number | null }[];
}): ActionResult {
  const db = loadDb();
  const incomeType = db.incomeTypes.find((t) => t.id === input.incomeTypeId);
  if (!incomeType) return { ok: false, error: "Income type not found." };
  incomeType.allocation_mode = input.mode;

  for (const cell of input.cells) {
    const existing = db.allocations.find(
      (a) => a.income_type_id === input.incomeTypeId && a.budget_type_id === cell.budgetTypeId
    );
    const percent = input.mode === "percent" ? cell.value : null;
    const amount = input.mode === "amount" ? cell.value : null;
    if (existing) {
      existing.percent = percent;
      existing.amount = amount;
    } else {
      db.allocations.push({
        id: newId(),
        income_type_id: input.incomeTypeId,
        budget_type_id: cell.budgetTypeId,
        percent,
        amount,
        created_at: stamp(),
      });
    }
  }
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

// ---------- Entry writes ----------

type ExpenseInput = Omit<ExpenseRow, "id">;
type IncomeInput = Omit<IncomeRow, "id">;

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

export function createIncome(input: IncomeInput): ActionResult {
  const db = loadDb();
  db.incomes.push({ id: newId(), ...input, created_at: stamp() });
  saveDb(db);
  return { ok: true };
}

export function updateIncome(id: string, input: IncomeInput): ActionResult {
  const db = loadDb();
  const row = db.incomes.find((i) => i.id === id);
  if (!row) return { ok: false, error: "Income not found." };
  Object.assign(row, input);
  saveDb(db);
  return { ok: true };
}

export function deleteIncome(id: string): ActionResult {
  const db = loadDb();
  db.incomes = db.incomes.filter((i) => i.id !== id);
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
