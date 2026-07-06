export type Cadence = "monthly" | "yearly";

/**
 * 'spending' envelopes are consumed by expenses; 'investment' envelopes are
 * deployed via the investments module (never via expenses). Seed-fixed in v2.
 */
export type BudgetKind = "spending" | "investment";

export interface IncomeType {
  id: string;
  name: string;
  cadence: Cadence;
  is_active: boolean;
}

export interface BudgetType {
  id: string;
  name: string;
  kind: BudgetKind;
  is_active: boolean;
}

/** One cell of an income's envelope split. Only non-zero cells are stored. */
export interface IncomeAllocation {
  id: string;
  income_id: string;
  budget_type_id: string;
  amount: number;
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
  /** Set when this income is a yield/dividend from an investment item (v2.2). */
  investment_item_id?: string | null;
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

export interface AssetClass {
  id: string;
  name: string;
  is_active: boolean;
  sort: number;
}

/** Target percent per class per BUDGET year (label '2026' = 25 Dec 2025 – 24 Dec 2026). */
export interface AssetClassTarget {
  id: string;
  asset_class_id: string;
  year: string;
  percent: number;
}

export interface InvestmentItem {
  id: string;
  asset_class_id: string;
  name: string;
  is_active: boolean;
}

export type TxSide = "buy" | "sell";

/** amount = total IDR; quantity optional (unit price derived, never stored). */
export interface InvestmentTransaction {
  id: string;
  item_id: string;
  side: TxSide;
  amount: number;
  quantity: number | null;
  date: string;
  notes: string | null;
}

/** Everything the settings/forms/dashboard need to resolve ids to names. */
export interface Config {
  incomeTypes: IncomeType[];
  budgetTypes: BudgetType[];
  categories: ExpenseCategory[];
  events: EventRow[];
}

/** Investment reference data (classes, per-year targets, items). */
export interface InvestmentConfig {
  assetClasses: AssetClass[];
  targets: AssetClassTarget[];
  items: InvestmentItem[];
}
