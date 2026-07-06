"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import * as mock from "@/lib/mock/api";
import { isMockMode } from "@/lib/mock/mode";
import { validateSell } from "@/lib/investments";
import type { TxSide } from "@/lib/types";
import { failure, type ActionResult, type ActionResultWithId } from "./types";

function revalidateAll() {
  revalidatePath("/", "layout");
}

function done<T extends ActionResult | ActionResultWithId>(result: T): T {
  if (result.ok) revalidateAll();
  return result;
}

// ---------- Asset classes ----------

export async function createAssetClass(name: string): Promise<ActionResult> {
  const trimmed = name.trim();
  if (!trimmed) return { ok: false, error: "Name is required." };
  if (isMockMode()) return done(mock.createAssetClass(trimmed));

  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("asset_classes")
    .select("sort")
    .order("sort", { ascending: false })
    .limit(1);
  const nextSort = ((existing?.[0]?.sort as number | undefined) ?? -1) + 1;
  const { error } = await supabase.from("asset_classes").insert({ name: trimmed, sort: nextSort });
  if (error) return failure(error, "Could not create asset class.");
  revalidateAll();
  return { ok: true };
}

export async function updateAssetClass(
  id: string,
  input: { name?: string; is_active?: boolean; sort?: number }
): Promise<ActionResult> {
  if (input.name !== undefined && !input.name.trim()) {
    return { ok: false, error: "Name is required." };
  }
  if (isMockMode()) return done(mock.updateAssetClass(id, { ...input, name: input.name?.trim() }));

  const supabase = await createClient();
  const { error } = await supabase
    .from("asset_classes")
    .update({
      ...(input.name !== undefined ? { name: input.name.trim() } : {}),
      ...(input.is_active !== undefined ? { is_active: input.is_active } : {}),
      ...(input.sort !== undefined ? { sort: input.sort } : {}),
    })
    .eq("id", id);
  if (error) return failure(error, "Could not update asset class.");
  revalidateAll();
  return { ok: true };
}

// ---------- Per-year targets ----------

/**
 * Saves one budget year's target percents. Sum ≠ 100 only warns client-side —
 * targets are guidance, not a hard budget.
 */
export async function saveClassTargets(
  year: string,
  cells: { assetClassId: string; percent: number }[]
): Promise<ActionResult> {
  if (!/^\d{4}$/.test(year)) return { ok: false, error: "Invalid year." };
  for (const cell of cells) {
    if (!Number.isFinite(cell.percent) || cell.percent < 0 || cell.percent > 100) {
      return { ok: false, error: "Each percent must be between 0 and 100." };
    }
  }
  if (isMockMode()) return done(mock.saveClassTargets(year, cells));

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const rows = cells.map((cell) => ({
    user_id: user.id,
    asset_class_id: cell.assetClassId,
    year,
    percent: cell.percent,
  }));
  const { error } = await supabase
    .from("asset_class_targets")
    .upsert(rows, { onConflict: "user_id,asset_class_id,year" });
  if (error) return failure(error, "Could not save targets.");
  revalidateAll();
  return { ok: true };
}

// ---------- Items ----------

export async function createInvestmentItem(input: {
  name: string;
  assetClassId: string;
}): Promise<ActionResultWithId> {
  const name = input.name.trim();
  if (!name) return { ok: false, error: "Item name is required." };
  if (!input.assetClassId) return { ok: false, error: "Asset class is required." };
  if (isMockMode()) return done(mock.createInvestmentItem({ name, assetClassId: input.assetClassId }));

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("investment_items")
    .insert({ name, asset_class_id: input.assetClassId })
    .select("id")
    .single();
  if (error || !data) return failure(error, "Could not create item.");
  revalidateAll();
  return { ok: true, id: data.id };
}

export async function updateInvestmentItem(
  id: string,
  input: { name?: string; is_active?: boolean }
): Promise<ActionResult> {
  if (input.name !== undefined && !input.name.trim()) {
    return { ok: false, error: "Name is required." };
  }
  if (isMockMode()) return done(mock.updateInvestmentItem(id, { ...input, name: input.name?.trim() }));

  const supabase = await createClient();
  const { error } = await supabase
    .from("investment_items")
    .update({
      ...(input.name !== undefined ? { name: input.name.trim() } : {}),
      ...(input.is_active !== undefined ? { is_active: input.is_active } : {}),
    })
    .eq("id", id);
  if (error) return failure(error, "Could not update item.");
  revalidateAll();
  return { ok: true };
}

// ---------- Transactions ----------

interface TransactionInput {
  item_id: string;
  side: TxSide;
  amount: number;
  quantity: number | null;
  date: string;
  notes: string | null;
}

function validateTransaction(input: TransactionInput): string | null {
  if (!input.item_id) return "Item is required.";
  if (!Number.isFinite(input.amount) || input.amount <= 0) return "Amount must be greater than 0.";
  if (input.quantity != null && (!Number.isFinite(input.quantity) || input.quantity <= 0)) {
    return "Quantity must be greater than 0 (or left empty).";
  }
  if (!input.date) return "Date is required.";
  return null;
}

function clean(input: TransactionInput): TransactionInput {
  return { ...input, notes: input.notes?.trim() || null };
}

export async function createInvestmentTransaction(
  input: TransactionInput
): Promise<ActionResult> {
  const invalid = validateTransaction(input);
  if (invalid) return { ok: false, error: invalid };
  if (isMockMode()) return done(mock.createInvestmentTransaction(clean(input)));

  const supabase = await createClient();
  if (input.side === "sell") {
    const txs = await fetchItemTransactions(input.item_id);
    const sellError = validateSell(txs, input);
    if (sellError) return { ok: false, error: sellError };
  }
  const { error } = await supabase.from("investment_transactions").insert(clean(input));
  if (error) return failure(error, "Could not save transaction.");
  revalidateAll();
  return { ok: true };
}

export async function updateInvestmentTransaction(
  id: string,
  input: TransactionInput
): Promise<ActionResult> {
  const invalid = validateTransaction(input);
  if (invalid) return { ok: false, error: invalid };
  if (isMockMode()) return done(mock.updateInvestmentTransaction(id, clean(input)));

  const supabase = await createClient();
  if (input.side === "sell") {
    const txs = await fetchItemTransactions(input.item_id);
    const sellError = validateSell(txs, input, id);
    if (sellError) return { ok: false, error: sellError };
  }
  const { error } = await supabase
    .from("investment_transactions")
    .update(clean(input))
    .eq("id", id);
  if (error) return failure(error, "Could not update transaction.");
  revalidateAll();
  return { ok: true };
}

export async function deleteInvestmentTransaction(id: string): Promise<ActionResult> {
  if (isMockMode()) return done(mock.deleteInvestmentTransaction(id));
  const supabase = await createClient();
  const { error } = await supabase.from("investment_transactions").delete().eq("id", id);
  if (error) return failure(error, "Could not delete transaction.");
  revalidateAll();
  return { ok: true };
}

// ---------- Yields ----------

interface YieldInput {
  item_id: string;
  name: string;
  amount: number;
  date: string;
  income_type_id: string;
  notes: string | null;
  /** Envelope split — must sum EXACTLY to `amount` (same hard rule as incomes). */
  allocations: { budget_type_id: string; amount: number }[];
}

function validateYield(input: YieldInput): string | null {
  if (!input.item_id) return "Item is required.";
  if (!input.name.trim()) return "Name is required.";
  if (!Number.isFinite(input.amount) || input.amount <= 0) return "Amount must be greater than 0.";
  if (!input.date) return "Date is required.";
  if (!input.income_type_id) return "Income type is required.";
  for (const cell of input.allocations) {
    if (!Number.isInteger(cell.amount) || cell.amount < 0) {
      return "Split amounts must be zero or positive.";
    }
  }
  const splitTotal = input.allocations.reduce((sum, c) => sum + c.amount, 0);
  if (splitTotal !== input.amount) return "Split must add up to the yield amount.";
  return null;
}

/**
 * Records a yield/dividend from an investment item as a NORMAL income (with
 * an envelope split) carrying investment_item_id for per-holding attribution.
 * One entry, no double bookkeeping: the money funds envelopes like any income;
 * the investments view folds it into realized.
 */
export async function createInvestmentYield(input: YieldInput): Promise<ActionResult> {
  const invalid = validateYield(input);
  if (invalid) return { ok: false, error: invalid };
  const nonZero = input.allocations.filter((c) => c.amount > 0);
  if (isMockMode()) {
    return done(
      mock.createIncome({
        name: input.name.trim(),
        amount: input.amount,
        date: input.date,
        income_type_id: input.income_type_id,
        notes: input.notes?.trim() || null,
        investment_item_id: input.item_id,
        allocations: nonZero,
      })
    );
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("incomes")
    .insert({
      name: input.name.trim(),
      amount: input.amount,
      date: input.date,
      income_type_id: input.income_type_id,
      notes: input.notes?.trim() || null,
      investment_item_id: input.item_id,
    })
    .select("id")
    .single();
  if (error || !data) return failure(error, "Could not save yield.");

  // Same compensating-delete pattern as createIncome (no transactions).
  const { error: splitError } = await supabase.from("income_allocations").insert(
    nonZero.map((cell) => ({
      income_id: data.id,
      budget_type_id: cell.budget_type_id,
      amount: cell.amount,
    }))
  );
  if (splitError) {
    await supabase.from("incomes").delete().eq("id", data.id);
    return failure(splitError, "Could not save the envelope split.");
  }
  revalidateAll();
  return { ok: true };
}

async function fetchItemTransactions(itemId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("investment_transactions")
    .select("id,item_id,side,amount,quantity,date")
    .eq("item_id", itemId)
    .order("date", { ascending: true })
    .order("created_at", { ascending: true });
  if (error || !data) return [];
  return data.map((t) => ({
    ...t,
    side: t.side as TxSide,
    quantity: t.quantity === null ? null : Number(t.quantity),
  }));
}
