"use client";

import { useState } from "react";
import { toast } from "sonner";
import { createIncome, deleteIncome, updateIncome } from "@/lib/actions/entries";
import { todayWIB } from "@/lib/dates";
import type { IncomeRow, IncomeType } from "@/lib/types";
import { AmountInput } from "@/components/amount-input";
import { SimpleSelect } from "@/components/simple-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface IncomeFormProps {
  incomeTypes: IncomeType[];
  initial?: IncomeRow;
  onSaved?: () => void;
}

export function IncomeForm({ incomeTypes, initial, onSaved }: IncomeFormProps) {
  const isEdit = initial !== undefined;

  const [name, setName] = useState(initial?.name ?? "");
  const [amount, setAmount] = useState<number | null>(initial?.amount ?? null);
  const [date, setDate] = useState(initial?.date ?? todayWIB());
  const [incomeTypeId, setIncomeTypeId] = useState<string | null>(initial?.income_type_id ?? null);
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return toast.error("Name is required.");
    if (!amount || amount <= 0) return toast.error("Amount must be greater than 0.");
    if (!incomeTypeId) return toast.error("Pick an income type.");

    setBusy(true);
    try {
      const payload = {
        name,
        amount,
        date,
        income_type_id: incomeTypeId,
        notes: notes || null,
      };
      const result = isEdit ? await updateIncome(initial.id, payload) : await createIncome(payload);
      if (!result.ok) return toast.error(result.error);

      toast.success(isEdit ? "Income updated" : "Income saved");
      if (!isEdit) {
        setName("");
        setAmount(null);
        setIncomeTypeId(null);
        setNotes("");
      }
      onSaved?.();
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (!isEdit) return;
    if (!window.confirm("Delete this income entry?")) return;
    setBusy(true);
    try {
      const result = await deleteIncome(initial.id);
      if (!result.ok) return toast.error(result.error);
      toast.success("Income deleted");
      onSaved?.();
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor="income-name">Name</Label>
        <Input
          id="income-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="July salary"
          autoComplete="off"
          required
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="income-amount">Amount</Label>
          <AmountInput id="income-amount" value={amount} onChange={setAmount} placeholder="0" required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="income-date">Date</Label>
          <Input
            id="income-date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="income-type">Income type</Label>
        <SimpleSelect
          id="income-type"
          value={incomeTypeId}
          onChange={setIncomeTypeId}
          options={incomeTypes.map((t) => ({ value: t.id, label: t.name }))}
          placeholder="Income type"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="income-notes">Notes (optional)</Label>
        <Textarea id="income-notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
      </div>

      <div className="flex gap-2 pt-1">
        <Button type="submit" className="flex-1" disabled={busy}>
          {busy ? "Saving…" : isEdit ? "Save changes" : "Save income"}
        </Button>
        {isEdit && (
          <Button type="button" variant="destructive" onClick={handleDelete} disabled={busy}>
            Delete
          </Button>
        )}
      </div>
    </form>
  );
}
