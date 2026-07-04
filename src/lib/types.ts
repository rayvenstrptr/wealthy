export type Cadence = "monthly" | "yearly";
export type AllocationMode = "percent" | "amount";

export interface IncomeType {
  id: string;
  name: string;
  cadence: Cadence;
  allocation_mode: AllocationMode;
  is_active: boolean;
}

export interface BudgetType {
  id: string;
  name: string;
  is_active: boolean;
}

export interface BudgetAllocation {
  id: string;
  income_type_id: string;
  budget_type_id: string;
  percent: number | null;
  amount: number | null;
}

export interface ExpenseCategory {
  id: string;
  name: string;
  default_budget_type_id: string | null;
  is_active: boolean;
}

export interface EventRow {
  id: string;
  name: string;
  starts_on: string | null;
  ends_on: string | null;
  notes: string | null;
}

export interface IncomeRow {
  id: string;
  name: string;
  amount: number;
  date: string;
  income_type_id: string;
  notes: string | null;
}

export interface ExpenseRow {
  id: string;
  name: string;
  amount: number;
  date: string;
  budget_type_id: string;
  expense_category_id: string;
  event_id: string | null;
  notes: string | null;
}

/** Everything the settings/forms/dashboard need to resolve ids to names. */
export interface Config {
  incomeTypes: IncomeType[];
  budgetTypes: BudgetType[];
  allocations: BudgetAllocation[];
  categories: ExpenseCategory[];
  events: EventRow[];
}
