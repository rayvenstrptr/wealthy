"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import * as mock from "@/lib/mock/api";
import { isMockMode } from "@/lib/mock/mode";
import { failure, type ActionResult, type ActionResultWithId } from "./types";

function revalidateAll() {
  revalidatePath("/", "layout");
}

function done<T extends ActionResult | ActionResultWithId>(result: T): T {
  if (result.ok) revalidateAll();
  return result;
}

interface ExpenseInput {
  name: string;
  amount: number;
  date: string;
  budget_type_id: string;
  expense_category_id: string;
  event_id: string | null;
  notes: string | null;
}

function validateExpense(input: ExpenseInput): string | null {
  if (!input.name.trim()) return "Name is required.";
  if (!Number.isFinite(input.amount) || input.amount <= 0) return "Amount must be greater than 0.";
  if (!input.date) return "Date is required.";
  if (!input.budget_type_id) return "Budget type is required.";
  if (!input.expense_category_id) return "Category is required.";
  return null;
}

export async function createExpense(input: ExpenseInput): Promise<ActionResult> {
  const invalid = validateExpense(input);
  if (invalid) return { ok: false, error: invalid };
  if (isMockMode()) {
    return done(
      mock.createExpense({ ...input, name: input.name.trim(), notes: input.notes?.trim() || null })
    );
  }

  const supabase = await createClient();
  const { error } = await supabase.from("expenses").insert({
    name: input.name.trim(),
    amount: input.amount,
    date: input.date,
    budget_type_id: input.budget_type_id,
    expense_category_id: input.expense_category_id,
    event_id: input.event_id,
    notes: input.notes?.trim() || null,
  });
  if (error) return failure(error, "Could not save expense.");
  revalidateAll();
  return { ok: true };
}

export async function updateExpense(id: string, input: ExpenseInput): Promise<ActionResult> {
  const invalid = validateExpense(input);
  if (invalid) return { ok: false, error: invalid };
  if (isMockMode()) {
    return done(
      mock.updateExpense(id, { ...input, name: input.name.trim(), notes: input.notes?.trim() || null })
    );
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("expenses")
    .update({
      name: input.name.trim(),
      amount: input.amount,
      date: input.date,
      budget_type_id: input.budget_type_id,
      expense_category_id: input.expense_category_id,
      event_id: input.event_id,
      notes: input.notes?.trim() || null,
    })
    .eq("id", id);
  if (error) return failure(error, "Could not update expense.");
  revalidateAll();
  return { ok: true };
}

export async function deleteExpense(id: string): Promise<ActionResult> {
  if (isMockMode()) return done(mock.deleteExpense(id));
  const supabase = await createClient();
  const { error } = await supabase.from("expenses").delete().eq("id", id);
  if (error) return failure(error, "Could not delete expense.");
  revalidateAll();
  return { ok: true };
}

interface IncomeInput {
  name: string;
  amount: number;
  date: string;
  income_type_id: string;
  notes: string | null;
}

function validateIncome(input: IncomeInput): string | null {
  if (!input.name.trim()) return "Name is required.";
  if (!Number.isFinite(input.amount) || input.amount <= 0) return "Amount must be greater than 0.";
  if (!input.date) return "Date is required.";
  if (!input.income_type_id) return "Income type is required.";
  return null;
}

export async function createIncome(input: IncomeInput): Promise<ActionResult> {
  const invalid = validateIncome(input);
  if (invalid) return { ok: false, error: invalid };
  if (isMockMode()) {
    return done(
      mock.createIncome({ ...input, name: input.name.trim(), notes: input.notes?.trim() || null })
    );
  }

  const supabase = await createClient();
  const { error } = await supabase.from("incomes").insert({
    name: input.name.trim(),
    amount: input.amount,
    date: input.date,
    income_type_id: input.income_type_id,
    notes: input.notes?.trim() || null,
  });
  if (error) return failure(error, "Could not save income.");
  revalidateAll();
  return { ok: true };
}

export async function updateIncome(id: string, input: IncomeInput): Promise<ActionResult> {
  const invalid = validateIncome(input);
  if (invalid) return { ok: false, error: invalid };
  if (isMockMode()) {
    return done(
      mock.updateIncome(id, { ...input, name: input.name.trim(), notes: input.notes?.trim() || null })
    );
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("incomes")
    .update({
      name: input.name.trim(),
      amount: input.amount,
      date: input.date,
      income_type_id: input.income_type_id,
      notes: input.notes?.trim() || null,
    })
    .eq("id", id);
  if (error) return failure(error, "Could not update income.");
  revalidateAll();
  return { ok: true };
}

export async function deleteIncome(id: string): Promise<ActionResult> {
  if (isMockMode()) return done(mock.deleteIncome(id));
  const supabase = await createClient();
  const { error } = await supabase.from("incomes").delete().eq("id", id);
  if (error) return failure(error, "Could not delete income.");
  revalidateAll();
  return { ok: true };
}

interface EventInput {
  name: string;
  starts_on: string | null;
  ends_on: string | null;
  notes: string | null;
}

export async function createEvent(input: EventInput): Promise<ActionResultWithId> {
  const name = input.name.trim();
  if (!name) return { ok: false, error: "Event name is required." };
  if (isMockMode()) {
    return done(
      mock.createEvent({
        name,
        starts_on: input.starts_on || null,
        ends_on: input.ends_on || null,
        notes: input.notes?.trim() || null,
      })
    );
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("events")
    .insert({
      name,
      starts_on: input.starts_on || null,
      ends_on: input.ends_on || null,
      notes: input.notes?.trim() || null,
    })
    .select("id")
    .single();
  if (error || !data) return failure(error, "Could not create event.");
  revalidateAll();
  return { ok: true, id: data.id };
}

export async function updateEvent(id: string, input: EventInput): Promise<ActionResult> {
  if (!input.name.trim()) return { ok: false, error: "Event name is required." };
  if (isMockMode()) {
    return done(
      mock.updateEvent(id, {
        name: input.name.trim(),
        starts_on: input.starts_on || null,
        ends_on: input.ends_on || null,
        notes: input.notes?.trim() || null,
      })
    );
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("events")
    .update({
      name: input.name.trim(),
      starts_on: input.starts_on || null,
      ends_on: input.ends_on || null,
      notes: input.notes?.trim() || null,
    })
    .eq("id", id);
  if (error) return failure(error, "Could not update event.");
  revalidateAll();
  return { ok: true };
}

export async function deleteEvent(id: string): Promise<ActionResult> {
  if (isMockMode()) return done(mock.deleteEvent(id));
  const supabase = await createClient();
  const { error } = await supabase.from("events").delete().eq("id", id);
  if (error) {
    if (error.code === "23503") {
      return { ok: false, error: "This event has expenses attached — remove them first." };
    }
    return failure(error, "Could not delete event.");
  }
  revalidateAll();
  return { ok: true };
}
