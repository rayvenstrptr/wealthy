"use server";

// xlsx import: parse → preview (validation + duplicate warnings) → execute.
// Sheet columns: Cat · Details · Date · Ex · In · Type · Notes (the yearly
// tracking spreadsheet format). Parsing/classification logic is pure and lives
// in lib/import/core.ts; this file does the I/O on both ends.

import { revalidatePath } from "next/cache";
import ExcelJS from "exceljs";
import { createClient } from "@/lib/supabase/server";
import * as mock from "@/lib/mock/api";
import { isMockMode } from "@/lib/mock/mode";
import { getConfig, getExpenses, getIncomes, getLatestSplitByIncomeType } from "@/lib/data";
import { scaleSplit } from "@/lib/allocation-split";
import {
  classifyRow,
  duplicateStatus,
  type DuplicateStatus,
  type ParsedEntry,
  type RawImportRow,
  type RejectedEntry,
} from "@/lib/import/core";
import type { BudgetType, Config } from "@/lib/types";
import { createBudgetType, createExpenseCategory, createIncomeType } from "./settings";

// ---------- exceljs cell coercion ----------

type AnyCell = ExcelJS.Cell;

function textOf(cell: AnyCell): string | null {
  const v = cell.value;
  if (v == null) return null;
  if (typeof v === "string") return v.trim() || null;
  if (typeof v === "number") return String(v);
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "object") {
    if ("richText" in v) {
      const joined = v.richText.map((r) => r.text).join("").trim();
      return joined || null;
    }
    if ("text" in v) return String(v.text).trim() || null; // hyperlink
    if ("result" in v && v.result != null) return String(v.result);
  }
  return null;
}

function numberOf(cell: AnyCell): { value: number | null; formula: string | null } {
  const v = cell.value;
  if (v == null) return { value: null, formula: null };
  if (typeof v === "number") return { value: v, formula: null };
  if (typeof v === "string") {
    const n = Number(v.replace(/[.,\s]/g, (m) => (m === "," ? "." : "")));
    return v.trim() && Number.isFinite(n) ? { value: n, formula: null } : { value: null, formula: null };
  }
  if (typeof v === "object" && ("formula" in v || "sharedFormula" in v)) {
    const cellValue = v as ExcelJS.CellFormulaValue & ExcelJS.CellSharedFormulaValue;
    const result = cellValue.result;
    return {
      value: typeof result === "number" ? result : null,
      formula: cellValue.formula ?? cellValue.sharedFormula ?? null,
    };
  }
  return { value: null, formula: null };
}

function dateOf(cell: AnyCell): string | number | Date | null {
  const v = cell.value;
  if (v == null) return null;
  if (typeof v === "number" || typeof v === "string" || v instanceof Date) return v;
  if (typeof v === "object" && "result" in v) {
    const result = v.result;
    if (typeof result === "number" || typeof result === "string" || result instanceof Date) {
      return result;
    }
  }
  return null;
}

// ---------- name → row lookups ----------

function norm(s: string): string {
  return s.trim().toLowerCase();
}

function findByName<T extends { name: string }>(rows: T[], name: string): T | undefined {
  const wanted = norm(name);
  return rows.find((row) => norm(row.name) === wanted);
}

// ---------- Preview ----------

export interface PreviewEntry extends ParsedEntry {
  dup: DuplicateStatus;
}

export interface ImportPreview {
  ok: true;
  fileName: string;
  entries: PreviewEntry[];
  rejected: RejectedEntry[];
  /** Config that will be created on import. */
  newCategories: string[];
  newEnvelopes: string[];
  newIncomeTypes: string[];
  /** Income types with no split history: those incomes go 100% → fallback envelope. */
  noSplitHistory: { type: string; count: number }[];
  fallbackEnvelope: string | null;
}

export type ParseImportResult = ImportPreview | { ok: false; error: string };

const HEADERS = ["cat", "details", "date", "ex", "in", "type", "notes"] as const;

export async function parseImportFile(formData: FormData): Promise<ParseImportResult> {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "Pick an .xlsx file first." };
  }

  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(await file.arrayBuffer());
  } catch {
    return { ok: false, error: "Could not read that file — is it a valid .xlsx?" };
  }
  const sheet = workbook.worksheets[0];
  if (!sheet) return { ok: false, error: "The workbook has no sheets." };

  // Map headers (row 1) to column numbers, case-insensitively.
  const columns = new Map<string, number>();
  sheet.getRow(1).eachCell((cell, col) => {
    const header = textOf(cell);
    if (header) columns.set(norm(header), col);
  });
  const missing = HEADERS.filter((h) => h !== "notes" && !columns.has(h));
  if (missing.length > 0) {
    return {
      ok: false,
      error: `Missing column(s): ${missing.join(", ")}. Expected headers: Cat, Details, Date, Ex, In, Type, Notes.`,
    };
  }
  const col = (name: (typeof HEADERS)[number]) => columns.get(name) ?? 0;

  const config = await getConfig();
  const investmentEnvelopes = config.budgetTypes
    .filter((b) => b.kind === "investment")
    .map((b) => b.name);

  const entries: ParsedEntry[] = [];
  const rejected: RejectedEntry[] = [];
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const raw: RawImportRow = {
      rowNumber,
      cat: textOf(row.getCell(col("cat"))),
      details: textOf(row.getCell(col("details"))),
      date: dateOf(row.getCell(col("date"))),
      ex: numberOf(row.getCell(col("ex"))),
      inc: numberOf(row.getCell(col("in"))),
      type: textOf(row.getCell(col("type"))),
      notes: col("notes") ? textOf(row.getCell(col("notes"))) : null,
    };
    const classified = classifyRow(raw, { investmentEnvelopes });
    if (!classified) return;
    if ("entry" in classified) entries.push(classified.entry);
    else rejected.push(classified.rejected);
  });

  if (entries.length === 0 && rejected.length === 0) {
    return { ok: false, error: "No data rows found in the sheet." };
  }

  // Duplicate check against what's already recorded.
  const [existingExpenses, existingIncomes] = await Promise.all([getExpenses(), getIncomes()]);
  const preview: PreviewEntry[] = entries.map((entry) => ({
    ...entry,
    dup: duplicateStatus(entry, entry.kind === "expense" ? existingExpenses : existingIncomes),
  }));

  // Config that would be created.
  const activeSpending = config.budgetTypes.filter((b) => b.is_active && b.kind === "spending");
  const newCategories = distinctMissing(
    entries.filter((e) => e.kind === "expense").map((e) => e.category ?? ""),
    config.categories
  );
  const newEnvelopes = distinctMissing(
    entries.filter((e) => e.kind === "expense").map((e) => e.type),
    config.budgetTypes
  );
  const newIncomeTypes = distinctMissing(
    entries.filter((e) => e.kind === "income").map((e) => e.type),
    config.incomeTypes
  );

  // Incomes whose type has no stored split → 100% fallback envelope.
  const latestSplits = await getLatestSplitByIncomeType();
  const noSplit = new Map<string, number>();
  for (const entry of entries) {
    if (entry.kind !== "income") continue;
    const incomeType = findByName(config.incomeTypes, entry.type);
    const hasHistory = incomeType && (latestSplits[incomeType.id]?.length ?? 0) > 0;
    if (!hasHistory) noSplit.set(entry.type, (noSplit.get(entry.type) ?? 0) + 1);
  }
  const fallback = fallbackEnvelope(activeSpending);

  return {
    ok: true,
    fileName: file.name,
    entries: preview,
    rejected,
    newCategories,
    newEnvelopes,
    newIncomeTypes,
    noSplitHistory: [...noSplit].map(([type, count]) => ({ type, count })),
    fallbackEnvelope: fallback?.name ?? null,
  };
}

function distinctMissing(names: string[], existing: { name: string }[]): string[] {
  const seen = new Set(existing.map((e) => norm(e.name)));
  const result: string[] = [];
  for (const name of names) {
    if (!name || seen.has(norm(name))) continue;
    seen.add(norm(name));
    result.push(name);
  }
  return result;
}

/** Where split-less imported incomes land: the Cash envelope, else the first spending one. */
function fallbackEnvelope(activeSpending: BudgetType[]): BudgetType | undefined {
  return activeSpending.find((b) => norm(b.name) === "cash") ?? activeSpending[0];
}

// ---------- Execute ----------

export interface ImportResult {
  ok: true;
  imported: { expenses: number; incomes: number };
  created: { categories: number; envelopes: number; incomeTypes: number };
}

export type ExecuteImportResult = ImportResult | { ok: false; error: string };

export async function executeImport(entries: ParsedEntry[]): Promise<ExecuteImportResult> {
  if (entries.length === 0) return { ok: false, error: "Nothing selected to import." };
  for (const entry of entries) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(entry.date)) return { ok: false, error: "Bad date in selection." };
    if (!Number.isInteger(entry.amount) || entry.amount === 0) {
      return { ok: false, error: "Bad amount in selection." };
    }
    if (entry.kind === "income" && entry.amount < 0) {
      return { ok: false, error: "Income amounts must be positive." };
    }
  }

  const expenses = entries.filter((e) => e.kind === "expense");
  const incomes = entries
    .filter((e) => e.kind === "income")
    .sort((a, b) => a.date.localeCompare(b.date));

  // 1) Create missing envelopes and income types (settings actions cover both
  //    mock and Supabase), then re-read config to pick up the new ids.
  let config = await getConfig();
  const created = { categories: 0, envelopes: 0, incomeTypes: 0 };

  for (const name of distinctMissing(expenses.map((e) => e.type), config.budgetTypes)) {
    const result = await createBudgetType(name);
    if (!result.ok) return result;
    created.envelopes += 1;
  }
  for (const name of distinctMissing(incomes.map((e) => e.type), config.incomeTypes)) {
    const result = await createIncomeType({ name, cadence: "yearly" });
    if (!result.ok) return result;
    created.incomeTypes += 1;
  }
  if (created.envelopes || created.incomeTypes) config = await getConfig();

  // 2) Create missing categories, defaulting each to the envelope its rows use most.
  const missingCategories = distinctMissing(
    expenses.map((e) => e.category ?? ""),
    config.categories
  );
  for (const name of missingCategories) {
    const result = await createExpenseCategory({
      name,
      defaultBudgetTypeId: majorityEnvelopeId(name, expenses, config),
    });
    if (!result.ok) return result;
    created.categories += 1;
  }
  if (created.categories) config = await getConfig();

  // 3) Resolve rows to ids.
  const expenseInputs: mock.ImportExpenseInput[] = [];
  for (const entry of expenses) {
    const budgetType = findByName(config.budgetTypes, entry.type);
    const category = findByName(config.categories, entry.category ?? "");
    if (!budgetType || !category) return { ok: false, error: `Could not resolve row ${entry.rowNumber}.` };
    if (budgetType.kind === "investment") {
      return { ok: false, error: `Row ${entry.rowNumber} points at an investment envelope.` };
    }
    expenseInputs.push({
      name: entry.name,
      amount: entry.amount,
      date: entry.date,
      budget_type_id: budgetType.id,
      expense_category_id: category.id,
      notes: entry.notes,
    });
  }

  // 4) Incomes: every income needs an exact-sum split. Reuse the latest split
  //    of its type (scaled); with no history, 100% goes to the fallback
  //    envelope — editable later like any income.
  const latestSplits = await getLatestSplitByIncomeType();
  const fallback = fallbackEnvelope(
    config.budgetTypes.filter((b) => b.is_active && b.kind === "spending")
  );
  if (incomes.length > 0 && !fallback) {
    return { ok: false, error: "No spending envelope available for income splits." };
  }

  const incomeInputs: mock.ImportIncomeInput[] = [];
  for (const entry of incomes) {
    const incomeType = findByName(config.incomeTypes, entry.type);
    if (!incomeType) return { ok: false, error: `Could not resolve row ${entry.rowNumber}.` };
    const template = latestSplits[incomeType.id] ?? [];
    let allocations = scaleSplit(template, entry.amount);
    if (allocations.length === 0) {
      allocations = [{ budget_type_id: fallback!.id, amount: entry.amount }];
    }
    latestSplits[incomeType.id] = allocations; // later imports of the same type scale from this
    incomeInputs.push({
      name: entry.name,
      amount: entry.amount,
      date: entry.date,
      income_type_id: incomeType.id,
      notes: entry.notes,
      allocations,
    });
  }

  // 5) Write.
  if (isMockMode()) {
    const result = mock.importEntries(expenseInputs, incomeInputs);
    if (!result.ok) return result;
  } else {
    const supabase = await createClient();
    for (let i = 0; i < expenseInputs.length; i += 500) {
      const { error } = await supabase
        .from("expenses")
        .insert(expenseInputs.slice(i, i + 500).map((e) => ({ ...e, event_id: null })));
      if (error) return { ok: false, error: "Import failed while inserting expenses." };
    }
    for (const income of incomeInputs) {
      const { allocations, ...row } = income;
      const { data, error } = await supabase.from("incomes").insert(row).select("id").single();
      if (error || !data) return { ok: false, error: "Import failed while inserting incomes." };
      const { error: splitError } = await supabase.from("income_allocations").insert(
        allocations.map((cell) => ({
          income_id: data.id,
          budget_type_id: cell.budget_type_id,
          amount: cell.amount,
        }))
      );
      if (splitError) {
        await supabase.from("incomes").delete().eq("id", data.id);
        return { ok: false, error: "Import failed while saving an income split." };
      }
    }
  }

  revalidatePath("/", "layout");
  return {
    ok: true,
    imported: { expenses: expenseInputs.length, incomes: incomeInputs.length },
    created,
  };
}

/** The envelope most of this category's rows use — the created category's default. */
function majorityEnvelopeId(
  categoryName: string,
  expenses: ParsedEntry[],
  config: Config
): string | null {
  const counts = new Map<string, number>();
  for (const entry of expenses) {
    if (norm(entry.category ?? "") !== norm(categoryName)) continue;
    const budgetType = findByName(config.budgetTypes, entry.type);
    if (!budgetType || budgetType.kind !== "spending") continue;
    counts.set(budgetType.id, (counts.get(budgetType.id) ?? 0) + 1);
  }
  let best: string | null = null;
  let bestCount = 0;
  for (const [id, count] of counts) {
    if (count > bestCount) {
      best = id;
      bestCount = count;
    }
  }
  return best;
}
