"use client";

import { useState } from "react";
import { toast } from "sonner";
import { createEvent, createExpense, deleteExpense, updateExpense } from "@/lib/actions/entries";
import { todayWIB } from "@/lib/dates";
import type { BudgetType, EventRow, ExpenseCategory, ExpenseRow } from "@/lib/types";
import { AmountInput } from "@/components/amount-input";
import { SimpleSelect } from "@/components/simple-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const NO_EVENT = "none";
const NEW_EVENT = "new";

interface ExpenseFormProps {
  budgetTypes: BudgetType[];
  categories: ExpenseCategory[];
  events: EventRow[];
  initial?: ExpenseRow;
  /** Called after a successful save (and after delete in edit mode). */
  onSaved?: () => void;
  /** Add mode only: close the dialog ("Done") without saving again. */
  onDone?: () => void;
}

export function ExpenseForm({ budgetTypes, categories, events, initial, onSaved, onDone }: ExpenseFormProps) {
  const isEdit = initial !== undefined;

  // Investment envelopes are deployed via the investments module, never via
  // expenses (single source of record). Keep a legacy type visible only when
  // editing an old expense that still references it.
  const spendingTypes = budgetTypes.filter(
    (b) => b.kind !== "investment" || b.id === initial?.budget_type_id
  );
  const spendingTypeIds = new Set(spendingTypes.map((b) => b.id));

  const [name, setName] = useState(initial?.name ?? "");
  const [amount, setAmount] = useState<number | null>(initial?.amount ?? null);
  const [date, setDate] = useState(initial?.date ?? todayWIB());
  const [categoryId, setCategoryId] = useState<string | null>(initial?.expense_category_id ?? null);
  const [budgetTypeId, setBudgetTypeId] = useState<string | null>(initial?.budget_type_id ?? null);
  const [eventChoice, setEventChoice] = useState<string>(initial?.event_id ?? NO_EVENT);
  const [newEventName, setNewEventName] = useState("");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [busy, setBusy] = useState(false);

  function handleCategoryChange(id: string) {
    setCategoryId(id);
    const category = categories.find((c) => c.id === id);
    // Ignore defaults pointing at investment-kind types.
    if (category?.default_budget_type_id && spendingTypeIds.has(category.default_budget_type_id)) {
      setBudgetTypeId(category.default_budget_type_id);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return toast.error("Name is required.");
    if (amount == null || amount === 0) return toast.error("Amount must not be 0.");
    if (!categoryId) return toast.error("Pick an expense category.");
    if (!budgetTypeId) return toast.error("Pick a budget type.");
    if (eventChoice === NEW_EVENT && !newEventName.trim())
      return toast.error("Give the new event a name.");

    setBusy(true);
    try {
      let eventId: string | null = eventChoice === NO_EVENT || eventChoice === NEW_EVENT ? null : eventChoice;

      if (eventChoice === NEW_EVENT) {
        const created = await createEvent({
          name: newEventName,
          starts_on: null,
          ends_on: null,
          notes: null,
        });
        if (!created.ok) return toast.error(created.error);
        eventId = created.id;
      }

      const payload = {
        name,
        amount,
        date,
        budget_type_id: budgetTypeId,
        expense_category_id: categoryId,
        event_id: eventId,
        notes: notes || null,
      };

      const result = isEdit ? await updateExpense(initial.id, payload) : await createExpense(payload);
      if (!result.ok) return toast.error(result.error);

      toast.success(isEdit ? "Expense updated" : "Expense saved");
      if (!isEdit) {
        // Reset for the next entry, keeping the date.
        setName("");
        setAmount(null);
        setCategoryId(null);
        setBudgetTypeId(null);
        setEventChoice(NO_EVENT);
        setNewEventName("");
        setNotes("");
      }
      onSaved?.();
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (!isEdit) return;
    if (!window.confirm("Delete this expense?")) return;
    setBusy(true);
    try {
      const result = await deleteExpense(initial.id);
      if (!result.ok) return toast.error(result.error);
      toast.success("Expense deleted");
      onSaved?.();
    } finally {
      setBusy(false);
    }
  }

  const eventOptions = [
    { value: NO_EVENT, label: "No event" },
    ...events.map((event) => ({ value: event.id, label: event.name })),
    { value: NEW_EVENT, label: "+ New event…" },
  ];

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor="expense-name">Name</Label>
        <Input
          id="expense-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Lunch at warteg"
          autoComplete="off"
          required
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="expense-amount">Amount</Label>
          <AmountInput
            id="expense-amount"
            value={amount}
            onChange={setAmount}
            placeholder="0"
            allowNegative
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="expense-date">Date</Label>
          <Input
            id="expense-date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
          />
        </div>
      </div>

      {amount != null && amount < 0 && (
        <p className="text-[12.5px] text-amber-600 dark:text-amber-500">
          Negative expense — this is a surplus (refund, someone paid extra) and will refill the
          budget.
        </p>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="expense-category">Category</Label>
          <SimpleSelect
            id="expense-category"
            value={categoryId}
            onChange={handleCategoryChange}
            options={categories.map((c) => ({ value: c.id, label: c.name }))}
            placeholder="Category"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="expense-budget-type">Budget type</Label>
          <SimpleSelect
            id="expense-budget-type"
            value={budgetTypeId}
            onChange={setBudgetTypeId}
            options={spendingTypes.map((b) => ({ value: b.id, label: b.name }))}
            placeholder="Budget"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="expense-event">Event (optional)</Label>
        <SimpleSelect
          id="expense-event"
          value={eventChoice}
          onChange={setEventChoice}
          options={eventOptions}
        />
        {eventChoice === NEW_EVENT && (
          <Input
            value={newEventName}
            onChange={(e) => setNewEventName(e.target.value)}
            placeholder="New event name (e.g. Bali trip)"
            autoComplete="off"
          />
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="expense-notes">Notes (optional)</Label>
        <Textarea
          id="expense-notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
        />
      </div>

      <div className="flex gap-2.5 pt-1">
        <Button type="submit" className="flex-1" disabled={busy}>
          {busy ? "Saving…" : isEdit ? "Save changes" : "Save & add another"}
        </Button>
        {isEdit ? (
          <Button type="button" variant="destructive" onClick={handleDelete} disabled={busy}>
            Delete
          </Button>
        ) : (
          onDone && (
            <Button type="button" variant="secondary" onClick={onDone} disabled={busy}>
              Done
            </Button>
          )
        )}
      </div>
    </form>
  );
}
