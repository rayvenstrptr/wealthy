// File-backed store for local mock mode. Single user, dev only — synchronous
// fs is fine here. First load seeds the same defaults the SQL trigger creates
// (envelopes, categories, income types, investment reference data) and nothing
// else: a new user starts blank — no demo incomes, expenses, or transactions.

import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { currentYearWIB } from "@/lib/dates";
import type {
  AssetClass,
  AssetClassTarget,
  BudgetType,
  EventRow,
  ExpenseCategory,
  ExpenseRow,
  IncomeAllocation,
  IncomeRow,
  IncomeType,
  InvestmentItem,
  InvestmentTransaction,
} from "@/lib/types";

interface Stamped {
  created_at: string;
}

export interface MockDb {
  incomeTypes: (IncomeType & Stamped)[];
  budgetTypes: (BudgetType & Stamped)[];
  categories: (ExpenseCategory & Stamped)[];
  events: (EventRow & Stamped)[];
  incomes: (IncomeRow & Stamped)[];
  incomeAllocations: (IncomeAllocation & Stamped)[];
  expenses: (ExpenseRow & Stamped)[];
  assetClasses: (AssetClass & Stamped)[];
  assetClassTargets: (AssetClassTarget & Stamped)[];
  investmentItems: (InvestmentItem & Stamped)[];
  investmentTransactions: (InvestmentTransaction & Stamped)[];
}

const DB_DIR = path.join(process.cwd(), ".mock");
const DB_PATH = path.join(DB_DIR, "db.json");

export function loadDb(): MockDb {
  if (fs.existsSync(DB_PATH)) {
    const db = JSON.parse(fs.readFileSync(DB_PATH, "utf8")) as MockDb;
    // Pre-v2 file (allocation matrix era) — reseed rather than crash.
    if (Array.isArray(db.incomeAllocations)) return db;
  }
  const db = seed();
  saveDb(db);
  return db;
}

export function saveDb(db: MockDb): void {
  fs.mkdirSync(DB_DIR, { recursive: true });
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
}

export function stamp(): string {
  return new Date().toISOString();
}

export function newId(): string {
  return randomUUID();
}

function seed(): MockDb {
  // Monotonic created_at so "order by created_at" matches insertion order.
  let tick = Date.now() - 1_000_000;
  const next = () => new Date((tick += 1000)).toISOString();

  const budgetTypes = ["Invest", "Cash", "Life", "Fun", "Giving"].map((name) => ({
    id: newId(),
    name,
    kind: (name === "Invest" ? "investment" : "spending") as BudgetType["kind"],
    is_active: true,
    created_at: next(),
  }));
  const budget = Object.fromEntries(budgetTypes.map((b) => [b.name, b.id]));

  const incomeTypeDefs: [string, "monthly" | "yearly"][] = [
    ["Salary", "monthly"],
    ["Yield", "yearly"],
    ["Bonus", "yearly"],
    ["Angpao", "yearly"],
    ["THR", "yearly"],
    ["TCG Yield", "yearly"],
    ["Others", "yearly"],
  ];
  const incomeTypes = incomeTypeDefs.map(([name, cadence]) => ({
    id: newId(),
    name,
    cadence,
    is_active: true,
    created_at: next(),
  }));

  // No "Invest" category: investment-kind envelopes are deployed via the
  // investments module, never via expenses.
  const categoryDefs: [string, string][] = [
    ["Food", "Life"],
    ["Daily", "Life"],
    ["Extra", "Fun"],
    ["Transport", "Life"],
    ["Jajan", "Fun"],
    ["Give", "Giving"],
    ["Cigarettes", "Life"],
    ["Kolekte", "Giving"],
    ["Kado", "Life"],
    ["Cash", "Cash"],
  ];
  const categories = categoryDefs.map(([name, budgetName]) => ({
    id: newId(),
    name,
    default_budget_type_id: budget[budgetName],
    is_active: true,
    created_at: next(),
  }));

  // ---- Investments reference data ----
  const classDefs: [string, number][] = [
    ["Commodities", 5],
    ["Stocks", 45],
    ["Fixed", 25],
    ["Crypto", 5],
    ["Others", 12.5],
    ["Business", 5],
    ["Buffer", 2.5],
  ];
  const assetClasses = classDefs.map(([name], index) => ({
    id: newId(),
    name,
    is_active: true,
    sort: index,
    created_at: next(),
  }));
  const assetClass = Object.fromEntries(assetClasses.map((c) => [c.name, c.id]));

  const budgetYear = currentYearWIB();
  const assetClassTargets = classDefs.map(([name, percent]) => ({
    id: newId(),
    asset_class_id: assetClass[name],
    year: budgetYear,
    percent,
    created_at: next(),
  }));

  const itemDefs: [string, string][] = [
    ["BBCA", "Stocks"],
    ["CDIA", "Stocks"],
    ["BMRI", "Stocks"],
    ["AAPL", "Stocks"],
    ["BTC", "Crypto"],
    ["ETH", "Crypto"],
    ["SOL", "Crypto"],
    ["Deposito Superbank", "Fixed"],
    ["Pasar Uang BRI", "Fixed"],
  ];
  const investmentItems = itemDefs.map(([name, className]) => ({
    id: newId(),
    asset_class_id: assetClass[className],
    name,
    is_active: true,
    created_at: next(),
  }));

  // Reference/config data only — no demo entries. This mirrors the SQL
  // trigger seed_user_defaults(): a brand-new user starts with envelopes,
  // categories, income types, and the investment reference set, but a blank
  // slate for incomes, expenses, events, and transactions.
  return {
    incomeTypes,
    budgetTypes,
    categories,
    events: [],
    incomes: [],
    incomeAllocations: [],
    expenses: [],
    assetClasses,
    assetClassTargets,
    investmentItems,
    investmentTransactions: [],
  };
}
