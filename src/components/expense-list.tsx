"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Pencil } from "lucide-react";
import { updateExpense } from "@/lib/actions/entries";
import { formatDate } from "@/lib/dates";
import type { BudgetType, EventRow, ExpenseCategory, ExpenseRow } from "@/lib/types";
import { ExpenseForm } from "@/components/expense-form";
import { InlineAmount, InlineName } from "@/components/inline-edit";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface ExpenseListProps {
  expenses: ExpenseRow[];
  budgetTypes: BudgetType[];
  categories: ExpenseCategory[];
  events: EventRow[];
}

/**
 * Expense rows. Name and amount are edited inline (blur/Enter saves);
 * everything else via the pencil → edit dialog.
 */
export function ExpenseList({ expenses, budgetTypes, categories, events }: ExpenseListProps) {
  const [editing, setEditing] = useState<ExpenseRow | null>(null);

  if (expenses.length === 0) {
    return (
      <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
        No expenses match these filters.
      </p>
    );
  }

  const categoryById = new Map(categories.map((c) => [c.id, c]));
  const budgetById = new Map(budgetTypes.map((b) => [b.id, b]));
  const eventById = new Map(events.map((e) => [e.id, e]));

  // Edit form options: active items, plus the archived item the row references.
  function formOptions(expense: ExpenseRow) {
    const activeCategories = categories.filter(
      (c) => c.is_active || c.id === expense.expense_category_id
    );
    const activeBudgets = budgetTypes.filter(
      (b) => b.is_active || b.id === expense.budget_type_id
    );
    return { activeCategories, activeBudgets };
  }

  async function savePatch(
    expense: ExpenseRow,
    patch: Partial<Pick<ExpenseRow, "name" | "amount">>
  ): Promise<boolean> {
    const result = await updateExpense(expense.id, {
      name: expense.name,
      amount: expense.amount,
      date: expense.date,
      budget_type_id: expense.budget_type_id,
      expense_category_id: expense.expense_category_id,
      event_id: expense.event_id,
      notes: expense.notes,
      ...patch,
    });
    if (!result.ok) {
      toast.error(result.error);
      return false;
    }
    toast.success("Updated");
    return true;
  }

  return (
    <>
      <ul className="divide-y rounded-lg border">
        {expenses.map((expense) => {
          const category = categoryById.get(expense.expense_category_id);
          const budget = budgetById.get(expense.budget_type_id);
          const event = expense.event_id ? eventById.get(expense.event_id) : null;
          return (
            <li key={expense.id} className="flex items-center gap-1.5 px-2 py-2">
              <div className="min-w-0 flex-1">
                <InlineName
                  key={`${expense.id}:${expense.name}`}
                  value={expense.name}
                  onSave={(name) => savePatch(expense, { name })}
                  aria-label={`Rename ${expense.name}`}
                />
                <div className="mt-0.5 flex flex-wrap items-center gap-1.5 px-1.5 text-xs text-muted-foreground">
                  <span>{formatDate(expense.date)}</span>
                  {category && <Badge variant="secondary">{category.name}</Badge>}
                  {budget && <Badge variant="outline">{budget.name}</Badge>}
                  {event && <Badge variant="outline">📌 {event.name}</Badge>}
                </div>
              </div>
              <InlineAmount
                key={`${expense.id}:${expense.amount}`}
                value={expense.amount}
                onSave={(amount) => savePatch(expense, { amount })}
                className="w-28 shrink-0"
                aria-label={`Amount of ${expense.name}`}
              />
              <Button
                size="icon"
                variant="ghost"
                className="shrink-0 text-muted-foreground"
                onClick={() => setEditing(expense)}
                aria-label={`Edit ${expense.name}`}
              >
                <Pencil className="size-4" />
              </Button>
            </li>
          );
        })}
      </ul>

      <Dialog open={editing !== null} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit expense</DialogTitle>
          </DialogHeader>
          {editing && (
            <ExpenseForm
              budgetTypes={formOptions(editing).activeBudgets}
              categories={formOptions(editing).activeCategories}
              events={events}
              initial={editing}
              onSaved={() => setEditing(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
