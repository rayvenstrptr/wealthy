"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import * as mock from "@/lib/mock/api";
import { isMockMode } from "@/lib/mock/mode";
import type { AllocationMode, Cadence } from "@/lib/types";
import { failure, type ActionResult } from "./types";

function revalidateAll() {
  revalidatePath("/", "layout");
}

function done(result: ActionResult): ActionResult {
  if (result.ok) revalidateAll();
  return result;
}

// ---------- Income types ----------

export async function createIncomeType(input: {
  name: string;
  cadence: Cadence;
}): Promise<ActionResult> {
  const name = input.name.trim();
  if (!name) return { ok: false, error: "Name is required." };
  if (isMockMode()) return done(mock.createIncomeType({ name, cadence: input.cadence }));

  const supabase = await createClient();
  const { error } = await supabase
    .from("income_types")
    .insert({ name, cadence: input.cadence });
  if (error) return failure(error, "Could not create income type.");
  revalidateAll();
  return { ok: true };
}

export async function updateIncomeType(
  id: string,
  input: { name?: string; cadence?: Cadence; is_active?: boolean }
): Promise<ActionResult> {
  if (input.name !== undefined && !input.name.trim()) {
    return { ok: false, error: "Name is required." };
  }
  if (isMockMode()) {
    return done(mock.updateIncomeType(id, { ...input, name: input.name?.trim() }));
  }
  const supabase = await createClient();
  const { error } = await supabase
    .from("income_types")
    .update({
      ...(input.name !== undefined ? { name: input.name.trim() } : {}),
      ...(input.cadence !== undefined ? { cadence: input.cadence } : {}),
      ...(input.is_active !== undefined ? { is_active: input.is_active } : {}),
    })
    .eq("id", id);
  if (error) return failure(error, "Could not update income type.");
  revalidateAll();
  return { ok: true };
}

// ---------- Budget types ----------

export async function createBudgetType(name: string): Promise<ActionResult> {
  const trimmed = name.trim();
  if (!trimmed) return { ok: false, error: "Name is required." };
  if (isMockMode()) return done(mock.createBudgetType(trimmed));

  const supabase = await createClient();
  const { error } = await supabase.from("budget_types").insert({ name: trimmed });
  if (error) return failure(error, "Could not create budget type.");
  revalidateAll();
  return { ok: true };
}

export async function updateBudgetType(
  id: string,
  input: { name?: string; is_active?: boolean }
): Promise<ActionResult> {
  if (input.name !== undefined && !input.name.trim()) {
    return { ok: false, error: "Name is required." };
  }
  if (isMockMode()) {
    return done(mock.updateBudgetType(id, { ...input, name: input.name?.trim() }));
  }
  const supabase = await createClient();
  const { error } = await supabase
    .from("budget_types")
    .update({
      ...(input.name !== undefined ? { name: input.name.trim() } : {}),
      ...(input.is_active !== undefined ? { is_active: input.is_active } : {}),
    })
    .eq("id", id);
  if (error) return failure(error, "Could not update budget type.");
  revalidateAll();
  return { ok: true };
}

// ---------- Allocation matrix ----------

/**
 * Saves one income type's allocation row: its entry mode plus one cell per
 * budget type. Percent-mode cells land in `percent`, amount-mode cells in
 * `amount`; the other column is nulled so stale values can't leak between
 * modes.
 */
export async function saveAllocationRow(input: {
  incomeTypeId: string;
  mode: AllocationMode;
  cells: { budgetTypeId: string; value: number | null }[];
}): Promise<ActionResult> {
  for (const cell of input.cells) {
    if (cell.value != null && (Number.isNaN(cell.value) || cell.value < 0)) {
      return { ok: false, error: "Values must be zero or positive." };
    }
    if (input.mode === "percent" && cell.value != null && cell.value > 100) {
      return { ok: false, error: "A single percentage cannot exceed 100." };
    }
  }

  if (isMockMode()) return done(mock.saveAllocationRow(input));

  const supabase = await createClient();

  const { error: modeError } = await supabase
    .from("income_types")
    .update({ allocation_mode: input.mode })
    .eq("id", input.incomeTypeId);
  if (modeError) return failure(modeError, "Could not update allocation mode.");

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const rows = input.cells.map((cell) => ({
    user_id: user.id,
    income_type_id: input.incomeTypeId,
    budget_type_id: cell.budgetTypeId,
    percent: input.mode === "percent" ? cell.value : null,
    amount: input.mode === "amount" ? cell.value : null,
  }));

  const { error } = await supabase
    .from("budget_allocations")
    .upsert(rows, { onConflict: "user_id,income_type_id,budget_type_id" });
  if (error) return failure(error, "Could not save allocations.");

  revalidateAll();
  return { ok: true };
}

// ---------- Expense categories ----------

export async function createExpenseCategory(input: {
  name: string;
  defaultBudgetTypeId: string | null;
}): Promise<ActionResult> {
  const name = input.name.trim();
  if (!name) return { ok: false, error: "Name is required." };
  if (isMockMode()) {
    return done(
      mock.createExpenseCategory({ name, defaultBudgetTypeId: input.defaultBudgetTypeId })
    );
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("expense_categories")
    .insert({ name, default_budget_type_id: input.defaultBudgetTypeId });
  if (error) return failure(error, "Could not create category.");
  revalidateAll();
  return { ok: true };
}

export async function updateExpenseCategory(
  id: string,
  input: { name?: string; default_budget_type_id?: string | null; is_active?: boolean }
): Promise<ActionResult> {
  if (input.name !== undefined && !input.name.trim()) {
    return { ok: false, error: "Name is required." };
  }
  if (isMockMode()) {
    return done(mock.updateExpenseCategory(id, { ...input, name: input.name?.trim() }));
  }
  const supabase = await createClient();
  const { error } = await supabase
    .from("expense_categories")
    .update({
      ...(input.name !== undefined ? { name: input.name.trim() } : {}),
      ...(input.default_budget_type_id !== undefined
        ? { default_budget_type_id: input.default_budget_type_id }
        : {}),
      ...(input.is_active !== undefined ? { is_active: input.is_active } : {}),
    })
    .eq("id", id);
  if (error) return failure(error, "Could not update category.");
  revalidateAll();
  return { ok: true };
}
