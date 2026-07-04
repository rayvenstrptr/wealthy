// Server-side data fetching. All reads happen in server components via these
// helpers; RLS scopes every query to the signed-in user.

import { createClient } from "@/lib/supabase/server";
import * as mock from "@/lib/mock/api";
import { isMockMode } from "@/lib/mock/mode";
import type {
  BudgetAllocation,
  Config,
  EventRow,
  ExpenseRow,
  IncomeRow,
} from "@/lib/types";

function unwrap<T>(result: { data: T | null; error: { message: string } | null }): T {
  if (result.error) throw new Error(result.error.message);
  return result.data as T;
}

/** Types, allocations, categories and events — the app's working vocabulary. */
export async function getConfig(): Promise<Config> {
  if (isMockMode()) return mock.getConfig();
  const supabase = await createClient();
  const [incomeTypes, budgetTypes, allocations, categories, events] = await Promise.all([
    supabase
      .from("income_types")
      .select("id,name,cadence,allocation_mode,is_active")
      .order("created_at"),
    supabase.from("budget_types").select("id,name,is_active").order("created_at"),
    supabase
      .from("budget_allocations")
      .select("id,income_type_id,budget_type_id,percent,amount"),
    supabase
      .from("expense_categories")
      .select("id,name,default_budget_type_id,is_active")
      .order("created_at"),
    supabase
      .from("events")
      .select("id,name,starts_on,ends_on,notes")
      .order("created_at", { ascending: false }),
  ]);

  return {
    incomeTypes: unwrap(incomeTypes),
    budgetTypes: unwrap(budgetTypes),
    // numeric comes back as number via PostgREST, but coerce defensively
    allocations: (unwrap(allocations) as BudgetAllocation[]).map((a) => ({
      ...a,
      percent: a.percent === null ? null : Number(a.percent),
      amount: a.amount === null ? null : Number(a.amount),
    })),
    categories: unwrap(categories),
    events: unwrap(events) as EventRow[],
  };
}

export async function getIncomesBetween(start: string, end: string): Promise<IncomeRow[]> {
  const supabase = await createClient();
  const result = await supabase
    .from("incomes")
    .select("id,name,amount,date,income_type_id,notes")
    .gte("date", start)
    .lte("date", end)
    .order("date", { ascending: false })
    .order("created_at", { ascending: false });
  return unwrap(result);
}

export interface ExpenseFilters {
  start?: string;
  end?: string;
  budgetTypeId?: string;
  categoryId?: string;
  eventId?: string;
  search?: string;
}

export async function getExpenses(filters: ExpenseFilters = {}): Promise<ExpenseRow[]> {
  if (isMockMode()) return mock.getExpenses(filters);
  const supabase = await createClient();
  let query = supabase
    .from("expenses")
    .select("id,name,amount,date,budget_type_id,expense_category_id,event_id,notes")
    .order("date", { ascending: false })
    .order("created_at", { ascending: false });

  if (filters.start) query = query.gte("date", filters.start);
  if (filters.end) query = query.lte("date", filters.end);
  if (filters.budgetTypeId) query = query.eq("budget_type_id", filters.budgetTypeId);
  if (filters.categoryId) query = query.eq("expense_category_id", filters.categoryId);
  if (filters.eventId) query = query.eq("event_id", filters.eventId);
  if (filters.search) query = query.ilike("name", `%${filters.search}%`);

  return unwrap(await query);
}

export interface IncomeFilters {
  start?: string;
  end?: string;
  incomeTypeId?: string;
  search?: string;
}

export async function getIncomes(filters: IncomeFilters = {}): Promise<IncomeRow[]> {
  if (isMockMode()) return mock.getIncomes(filters);
  const supabase = await createClient();
  let query = supabase
    .from("incomes")
    .select("id,name,amount,date,income_type_id,notes")
    .order("date", { ascending: false })
    .order("created_at", { ascending: false });

  if (filters.start) query = query.gte("date", filters.start);
  if (filters.end) query = query.lte("date", filters.end);
  if (filters.incomeTypeId) query = query.eq("income_type_id", filters.incomeTypeId);
  if (filters.search) query = query.ilike("name", `%${filters.search}%`);

  return unwrap(await query);
}

export async function getRecentExpenses(limit: number): Promise<ExpenseRow[]> {
  if (isMockMode()) return mock.getRecentExpenses(limit);
  const supabase = await createClient();
  const result = await supabase
    .from("expenses")
    .select("id,name,amount,date,budget_type_id,expense_category_id,event_id,notes")
    .order("date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limit);
  return unwrap(result);
}

/** Total spent per event across all time (events cross months/years). */
export async function getEventTotals(): Promise<Map<string, number>> {
  if (isMockMode()) return mock.getEventTotals();
  const supabase = await createClient();
  const result = await supabase
    .from("expenses")
    .select("event_id,amount")
    .not("event_id", "is", null);
  const rows = unwrap(result) as { event_id: string; amount: number }[];
  const totals = new Map<string, number>();
  for (const row of rows) {
    totals.set(row.event_id, (totals.get(row.event_id) ?? 0) + row.amount);
  }
  return totals;
}
