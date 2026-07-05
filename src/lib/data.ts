// Server-side data fetching. All reads happen in server components via these
// helpers; RLS scopes every query to the signed-in user.

import { createClient } from "@/lib/supabase/server";
import * as mock from "@/lib/mock/api";
import { isMockMode } from "@/lib/mock/mode";
import type { SplitCell } from "@/lib/allocation-split";
import type {
  AssetClassTarget,
  Config,
  EventRow,
  ExpenseRow,
  IncomeAllocation,
  IncomeRow,
  InvestmentConfig,
  InvestmentTransaction,
} from "@/lib/types";

function unwrap<T>(result: { data: T | null; error: { message: string } | null }): T {
  if (result.error) throw new Error(result.error.message);
  return result.data as T;
}

/** Types, categories and events — the app's working vocabulary. */
export async function getConfig(): Promise<Config> {
  if (isMockMode()) return mock.getConfig();
  const supabase = await createClient();
  const [incomeTypes, budgetTypes, categories, events] = await Promise.all([
    supabase.from("income_types").select("id,name,cadence,is_active").order("created_at"),
    supabase.from("budget_types").select("id,name,kind,is_active").order("created_at"),
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
    categories: unwrap(categories),
    events: unwrap(events) as EventRow[],
  };
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

/** Stored envelope splits for the given incomes. */
export async function getIncomeAllocations(incomeIds: string[]): Promise<IncomeAllocation[]> {
  if (incomeIds.length === 0) return [];
  if (isMockMode()) return mock.getIncomeAllocations(incomeIds);
  const supabase = await createClient();
  const result = await supabase
    .from("income_allocations")
    .select("id,income_id,budget_type_id,amount")
    .in("income_id", incomeIds);
  return unwrap(result);
}

/**
 * Latest income's split per income type — prefill source for the income form
 * (each new income starts from how you last split that type).
 */
export async function getLatestSplitByIncomeType(): Promise<Record<string, SplitCell[]>> {
  if (isMockMode()) return mock.getLatestSplitByIncomeType();
  const supabase = await createClient();
  const incomes = unwrap(
    await supabase
      .from("incomes")
      .select("id,income_type_id")
      .order("date", { ascending: false })
      .order("created_at", { ascending: false })
  ) as { id: string; income_type_id: string }[];

  const latestByType = new Map<string, string>(); // income_type_id → income_id
  for (const income of incomes) {
    if (!latestByType.has(income.income_type_id)) {
      latestByType.set(income.income_type_id, income.id);
    }
  }
  const allocations = await getIncomeAllocations([...latestByType.values()]);

  const result: Record<string, SplitCell[]> = {};
  for (const [typeId, incomeId] of latestByType) {
    result[typeId] = allocations
      .filter((a) => a.income_id === incomeId)
      .map((a) => ({ budget_type_id: a.budget_type_id, amount: a.amount }));
  }
  return result;
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

/** Asset classes, per-year targets and items. */
export async function getInvestmentConfig(): Promise<InvestmentConfig> {
  if (isMockMode()) return mock.getInvestmentConfig();
  const supabase = await createClient();
  const [assetClasses, targets, items] = await Promise.all([
    supabase.from("asset_classes").select("id,name,is_active,sort").order("sort"),
    supabase.from("asset_class_targets").select("id,asset_class_id,year,percent"),
    supabase
      .from("investment_items")
      .select("id,asset_class_id,name,is_active")
      .order("created_at"),
  ]);
  return {
    assetClasses: unwrap(assetClasses),
    // numeric comes back as number via PostgREST, but coerce defensively
    targets: (unwrap(targets) as AssetClassTarget[]).map((t) => ({
      ...t,
      percent: Number(t.percent),
    })),
    items: unwrap(items),
  };
}

/** ALL transactions, chronological — the investment math folds them in order. */
export async function getInvestmentTransactions(): Promise<InvestmentTransaction[]> {
  if (isMockMode()) return mock.getInvestmentTransactions();
  const supabase = await createClient();
  const result = await supabase
    .from("investment_transactions")
    .select("id,item_id,side,amount,quantity,date,notes")
    .order("date", { ascending: true })
    .order("created_at", { ascending: true });
  return (unwrap(result) as InvestmentTransaction[]).map((t) => ({
    ...t,
    quantity: t.quantity === null ? null : Number(t.quantity),
  }));
}
