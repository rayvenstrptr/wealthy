// File-backed store for local mock mode. Single user, dev only — synchronous
// fs is fine here. First load seeds the same defaults the SQL trigger creates,
// plus a handful of demo entries so the dashboard has something to show.

import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { currentYearWIB, shiftMonth, todayWIB } from "@/lib/dates";
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
  const incomeType = Object.fromEntries(incomeTypes.map((t) => [t.name, t.id]));

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
  const category = Object.fromEntries(categories.map((c) => [c.name, c.id]));

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
  const item = Object.fromEntries(investmentItems.map((i) => [i.name, i.id]));

  // ---- Demo entries (delete freely in the UI) ----
  const today = todayWIB();
  const month = today.slice(0, 7);
  const year = today.slice(0, 4);
  const prevMonth = shiftMonth(month, -1);

  // Starts on the 20th so it sits in the PREVIOUS budget month (cycle runs
  // 25th → 24th) and the event demonstrably crosses budget months.
  const baliTrip: EventRow & Stamped = {
    id: newId(),
    name: "Bali trip",
    starts_on: `${prevMonth}-20`,
    ends_on: `${month}-02`,
    notes: "Long weekend getaway",
    created_at: next(),
  };

  const incomes: MockDb["incomes"] = [
    {
      id: newId(),
      // Payday is the 25th — that salary funds the FOLLOWING budget month.
      name: "Monthly salary",
      amount: 10_500_000,
      date: `${prevMonth}-25`,
      income_type_id: incomeType.Salary,
      notes: null,
      created_at: next(),
    },
    {
      id: newId(),
      name: "THR",
      amount: 5_000_000,
      date: `${year}-03-30`,
      income_type_id: incomeType.THR,
      notes: null,
      created_at: next(),
    },
    {
      id: newId(),
      name: "BBCA dividend",
      amount: 1_200_000,
      date: `${year}-05-12`,
      income_type_id: incomeType.Yield,
      notes: null,
      created_at: next(),
    },
  ];
  const [salaryIncome, thrIncome, dividendIncome] = incomes;

  // Every income carries its own exact-sum envelope split (zero cells omitted).
  const incomeAllocations: MockDb["incomeAllocations"] = [];
  const addSplit = (incomeId: string, cells: [string, number][]) => {
    for (const [budgetName, amount] of cells) {
      incomeAllocations.push({
        id: newId(),
        income_id: incomeId,
        budget_type_id: budget[budgetName],
        amount,
        created_at: next(),
      });
    }
  };
  // Salary 10.5jt @ 20/10/50/15/5
  addSplit(salaryIncome.id, [
    ["Invest", 2_100_000],
    ["Cash", 1_050_000],
    ["Life", 5_250_000],
    ["Fun", 1_575_000],
    ["Giving", 525_000],
  ]);
  // THR 5jt @ 20/0/50/30/0
  addSplit(thrIncome.id, [
    ["Invest", 1_000_000],
    ["Life", 2_500_000],
    ["Fun", 1_500_000],
  ]);
  // Dividend 1.2jt @ 20/10/50/15/5
  addSplit(dividendIncome.id, [
    ["Invest", 240_000],
    ["Cash", 120_000],
    ["Life", 600_000],
    ["Fun", 180_000],
    ["Giving", 60_000],
  ]);

  const expenseDefs: [string, number, string, string, string, string | null][] = [
    // name, amount, date, category, budget type, event
    ["Kolekte", 100_000, `${month}-01`, "Kolekte", "Giving", null],
    ["Groceries", 350_000, `${month}-02`, "Daily", "Life", null],
    ["Grab to office", 32_000, `${month}-03`, "Transport", "Life", null],
    ["Lunch at warteg", 45_000, today, "Food", "Life", null],
    ["Kopi kenangan", 58_000, today, "Jajan", "Fun", null],
    ["Flights CGK–DPS", 1_800_000, `${prevMonth}-20`, "Extra", "Fun", baliTrip.id],
    ["Villa 2 nights", 2_400_000, `${month}-02`, "Extra", "Fun", baliTrip.id],
  ];
  const expenses: MockDb["expenses"] = expenseDefs.map(
    ([name, amount, date, categoryName, budgetName, eventId]) => ({
      id: newId(),
      name,
      amount,
      date,
      budget_type_id: budget[budgetName],
      expense_category_id: category[categoryName],
      event_id: eventId,
      notes: null,
      created_at: next(),
    })
  );

  // Demo transactions: a BBCA round trip (avg cost 9.5k/share; sell 200 for
  // 2.08jt → +180k realized) plus open positions with and without quantity.
  const txDefs: [string, "buy" | "sell", number, number | null, string][] = [
    ["BBCA", "buy", 2_700_000, 300, `${prevMonth}-26`],
    ["BBCA", "buy", 2_050_000, 200, `${month}-02`],
    ["BBCA", "sell", 2_080_000, 200, today],
    ["Deposito Superbank", "buy", 3_000_000, null, `${prevMonth}-28`],
    ["BTC", "buy", 1_000_000, 0.0005, `${month}-03`],
  ];
  const investmentTransactions: MockDb["investmentTransactions"] = txDefs.map(
    ([itemName, side, amount, quantity, date]) => ({
      id: newId(),
      item_id: item[itemName],
      side,
      amount,
      quantity,
      date,
      notes: null,
      created_at: next(),
    })
  );

  return {
    incomeTypes,
    budgetTypes,
    categories,
    events: [baliTrip],
    incomes,
    incomeAllocations,
    expenses,
    assetClasses,
    assetClassTargets,
    investmentItems,
    investmentTransactions,
  };
}
