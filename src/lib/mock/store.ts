// File-backed store for local mock mode. Single user, dev only — synchronous
// fs is fine here. First load seeds the same defaults the SQL trigger creates,
// plus a handful of demo entries so the dashboard has something to show.

import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { shiftMonth, todayWIB } from "@/lib/dates";
import type {
  BudgetAllocation,
  BudgetType,
  EventRow,
  ExpenseCategory,
  ExpenseRow,
  IncomeRow,
  IncomeType,
} from "@/lib/types";

interface Stamped {
  created_at: string;
}

export interface MockDb {
  incomeTypes: (IncomeType & Stamped)[];
  budgetTypes: (BudgetType & Stamped)[];
  allocations: (BudgetAllocation & Stamped)[];
  categories: (ExpenseCategory & Stamped)[];
  events: (EventRow & Stamped)[];
  incomes: (IncomeRow & Stamped)[];
  expenses: (ExpenseRow & Stamped)[];
}

const DB_DIR = path.join(process.cwd(), ".mock");
const DB_PATH = path.join(DB_DIR, "db.json");

export function loadDb(): MockDb {
  if (!fs.existsSync(DB_PATH)) {
    const db = seed();
    saveDb(db);
    return db;
  }
  return JSON.parse(fs.readFileSync(DB_PATH, "utf8")) as MockDb;
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
    is_active: true,
    created_at: next(),
  }));
  const budget = Object.fromEntries(budgetTypes.map((b) => [b.name, b.id]));

  const incomeTypeDefs: [string, "monthly" | "yearly", "percent" | "amount"][] = [
    ["Salary", "monthly", "amount"],
    ["Yield", "yearly", "percent"],
    ["Bonus", "yearly", "percent"],
    ["Angpao", "yearly", "percent"],
    ["THR", "yearly", "percent"],
    ["TCG Yield", "yearly", "percent"],
    ["Others", "yearly", "percent"],
  ];
  const incomeTypes = incomeTypeDefs.map(([name, cadence, allocation_mode]) => ({
    id: newId(),
    name,
    cadence,
    allocation_mode,
    is_active: true,
    created_at: next(),
  }));
  const incomeType = Object.fromEntries(incomeTypes.map((t) => [t.name, t.id]));

  const allocations: MockDb["allocations"] = [];
  const addAllocation = (
    incomeTypeId: string,
    budgetTypeId: string,
    percent: number | null,
    amount: number | null
  ) =>
    allocations.push({
      id: newId(),
      income_type_id: incomeTypeId,
      budget_type_id: budgetTypeId,
      percent,
      amount,
      created_at: next(),
    });

  // Salary — amount mode on a 10jt base
  addAllocation(incomeType.Salary, budget.Invest, null, 2_000_000);
  addAllocation(incomeType.Salary, budget.Cash, null, 1_000_000);
  addAllocation(incomeType.Salary, budget.Life, null, 5_000_000);
  addAllocation(incomeType.Salary, budget.Fun, null, 1_500_000);
  addAllocation(incomeType.Salary, budget.Giving, null, 500_000);

  // THR — percent mode 20/0/50/30/0
  addAllocation(incomeType.THR, budget.Invest, 20, null);
  addAllocation(incomeType.THR, budget.Cash, 0, null);
  addAllocation(incomeType.THR, budget.Life, 50, null);
  addAllocation(incomeType.THR, budget.Fun, 30, null);
  addAllocation(incomeType.THR, budget.Giving, 0, null);

  // Everything else — Salary's derived split 20/10/50/15/5
  for (const name of ["Yield", "Bonus", "Angpao", "TCG Yield", "Others"]) {
    addAllocation(incomeType[name], budget.Invest, 20, null);
    addAllocation(incomeType[name], budget.Cash, 10, null);
    addAllocation(incomeType[name], budget.Life, 50, null);
    addAllocation(incomeType[name], budget.Fun, 15, null);
    addAllocation(incomeType[name], budget.Giving, 5, null);
  }

  const categoryDefs: [string, string][] = [
    ["Food", "Life"],
    ["Daily", "Life"],
    ["Extra", "Fun"],
    ["Transport", "Life"],
    ["Jajan", "Fun"],
    ["Give", "Giving"],
    ["Cigarettes", "Life"],
    ["Kolekte", "Giving"],
    ["Invest", "Invest"],
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

  const expenseDefs: [string, number, string, string, string, string | null][] = [
    // name, amount, date, category, budget type, event
    ["Transfer to RDN", 2_000_000, `${month}-01`, "Invest", "Invest", null],
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

  return {
    incomeTypes,
    budgetTypes,
    allocations,
    categories,
    events: [baliTrip],
    incomes,
    expenses,
  };
}
