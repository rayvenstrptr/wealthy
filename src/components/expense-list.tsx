"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Pencil } from "lucide-react";
import { updateExpense } from "@/lib/actions/entries";
import { formatDate } from "@/lib/dates";
import { envelopeHue } from "@/lib/envelope-colors";
import type { BudgetType, EventRow, ExpenseCategory, ExpenseRow } from "@/lib/types";
import { cn } from "@/lib/utils";
import { ExpenseForm } from "@/components/expense-form";
import { InlineAmount, InlineName } from "@/components/inline-edit";
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
  /** Empty-state copy, shown in a dashed panel when there are no rows. */
  emptyTitle?: string;
  emptyHint?: string;
}

const COLS = "auto 1fr 140px 130px 90px 130px 40px";

/**
 * Expense rows in a white card. Desktop: a 7-column table (dot · name ·
 * category · event · date · amount · pencil). Mobile: stacked rows with a meta
 * line. Name and amount edit inline; the pencil opens the full edit dialog.
 */
export function ExpenseList({
  expenses,
  budgetTypes,
  categories,
  events,
  emptyTitle = "Nothing here yet",
  emptyHint = "No expenses match these filters.",
}: ExpenseListProps) {
  const [editing, setEditing] = useState<ExpenseRow | null>(null);

  const categoryById = new Map(categories.map((c) => [c.id, c]));
  const budgetById = new Map(budgetTypes.map((b) => [b.id, b]));
  const eventById = new Map(events.map((e) => [e.id, e]));

  function formOptions(expense: ExpenseRow) {
    return {
      activeCategories: categories.filter(
        (c) => c.is_active || c.id === expense.expense_category_id
      ),
      activeBudgets: budgetTypes.filter((b) => b.is_active || b.id === expense.budget_type_id),
    };
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
    if (patch.amount != null && patch.amount < 0) {
      toast.warning("Negative expense — this surplus refills the budget.");
    } else {
      toast.success("Updated");
    }
    return true;
  }

  if (expenses.length === 0) {
    return (
      <div className="rounded-[14px] border border-dashed border-input bg-card px-6 py-8 text-center">
        <div className="text-[13.5px] font-semibold">{emptyTitle}</div>
        <div className="mt-1 text-[12.5px] text-muted-foreground">{emptyHint}</div>
      </div>
    );
  }

  return (
    <>
      <div className="overflow-hidden rounded-[16px] bg-card shadow-[0_1px_2px_rgba(38,35,30,0.05)]">
        {/* Desktop header overline */}
        <div
          className="hidden items-center gap-3.5 border-b border-border px-6 py-3 text-[11px] font-semibold tracking-[0.1em] text-muted-foreground uppercase md:grid"
          style={{ gridTemplateColumns: COLS }}
        >
          <span className="w-2" />
          <span>Name</span>
          <span>Category</span>
          <span>Event</span>
          <span>Date</span>
          <span className="text-right">Amount</span>
          <span />
        </div>

        {expenses.map((expense, i) => {
          const category = categoryById.get(expense.expense_category_id);
          const budget = budgetById.get(expense.budget_type_id);
          const event = expense.event_id ? eventById.get(expense.event_id) : null;
          const last = i === expenses.length - 1;
          return (
            <div
              key={expense.id}
              className="flex items-center gap-2 px-3 py-2.5 transition-colors hover:bg-row-hover md:grid md:gap-3.5 md:px-6 md:py-3"
              style={{
                gridTemplateColumns: COLS,
                borderBottom: last ? undefined : "1px solid var(--border)",
              }}
            >
              <span
                className="size-2 shrink-0 rounded-full"
                style={{ background: envelopeHue(budget?.name).fill }}
              />
              <div className="min-w-0 flex-1 md:flex-none">
                <InlineName
                  key={`${expense.id}:${expense.name}`}
                  value={expense.name}
                  onSave={(name) => savePatch(expense, { name })}
                  aria-label={`Rename ${expense.name}`}
                />
                {/* Mobile meta line */}
                <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 px-1 text-[12px] text-muted-foreground md:hidden">
                  <span>{formatDate(expense.date)}</span>
                  {category && <span>· {category.name}</span>}
                  {event && <span className="italic">· {event.name}</span>}
                </div>
              </div>
              <span className="hidden truncate text-[12.5px] text-muted-foreground md:block">
                {category?.name ?? "—"}
              </span>
              <span className="hidden truncate text-[12.5px] text-muted-foreground md:block">
                {event ? <span className="italic">{event.name}</span> : <span className="text-placeholder">—</span>}
              </span>
              <span className="hidden text-[12.5px] text-muted-foreground md:block">
                {formatDate(expense.date)}
              </span>
              <InlineAmount
                key={`${expense.id}:${expense.amount}`}
                value={expense.amount}
                onSave={(amount) => savePatch(expense, { amount })}
                currency
                allowNegative
                className={cn(
                  "w-32 shrink-0 md:w-full md:text-right",
                  expense.amount < 0 && "text-emerald-600 dark:text-emerald-500"
                )}
                aria-label={`Amount of ${expense.name}`}
              />
              <Button
                size="icon-sm"
                variant="ghost"
                className="shrink-0 text-placeholder hover:text-foreground"
                onClick={() => setEditing(expense)}
                aria-label={`Edit ${expense.name}`}
              >
                <Pencil className="size-4" />
              </Button>
            </div>
          );
        })}
      </div>

      <Dialog open={editing !== null} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-[440px]">
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
