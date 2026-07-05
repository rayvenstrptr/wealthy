"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { createIncome, deleteIncome, updateIncome } from "@/lib/actions/entries";
import { scaleSplit, splitRemaining, type SplitCell } from "@/lib/allocation-split";
import { todayWIB } from "@/lib/dates";
import type { BudgetType, IncomeRow, IncomeType } from "@/lib/types";
import { AmountInput } from "@/components/amount-input";
import { IncomeSplitEditor } from "@/components/income-split-editor";
import { SimpleSelect } from "@/components/simple-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface IncomeFormProps {
  incomeTypes: IncomeType[];
  budgetTypes: BudgetType[];
  /** Prefill source: how the latest income of each type was split. */
  latestSplitByType: Record<string, SplitCell[]>;
  initial?: IncomeRow;
  /** Stored split when editing. */
  initialAllocations?: SplitCell[];
  onSaved?: () => void;
}

export function IncomeForm({
  incomeTypes,
  budgetTypes,
  latestSplitByType,
  initial,
  initialAllocations,
  onSaved,
}: IncomeFormProps) {
  const isEdit = initial !== undefined;

  // Active envelopes, plus archived ones the stored split references.
  const splitTypes = useMemo(() => {
    const referenced = new Set((initialAllocations ?? []).map((c) => c.budget_type_id));
    return budgetTypes.filter((b) => b.is_active || referenced.has(b.id));
  }, [budgetTypes, initialAllocations]);

  const emptySplit = useMemo(
    () => splitTypes.map((b) => ({ budget_type_id: b.id, amount: 0 })),
    [splitTypes]
  );

  function alignedCells(cells: SplitCell[]): SplitCell[] {
    const byId = new Map(cells.map((c) => [c.budget_type_id, c.amount]));
    return splitTypes.map((b) => ({ budget_type_id: b.id, amount: byId.get(b.id) ?? 0 }));
  }

  const [name, setName] = useState(initial?.name ?? "");
  const [amount, setAmount] = useState<number | null>(initial?.amount ?? null);
  const [date, setDate] = useState(initial?.date ?? todayWIB());
  const [incomeTypeId, setIncomeTypeId] = useState<string | null>(initial?.income_type_id ?? null);
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [split, setSplit] = useState<SplitCell[]>(() =>
    initialAllocations ? alignedCells(initialAllocations) : emptySplit
  );
  // Once the user hand-edits the split, amount/type changes stop re-prefilling it.
  const [splitTouched, setSplitTouched] = useState(isEdit);
  const [busy, setBusy] = useState(false);

  const remaining = amount != null && amount > 0 ? splitRemaining(amount, split) : null;

  /** Prefill from the latest income of the same type, scaled to the amount. */
  function prefill(typeId: string | null, total: number | null) {
    if (splitTouched || !typeId || total == null || total <= 0) return;
    const template = latestSplitByType[typeId];
    if (!template || template.length === 0) return;
    setSplit(alignedCells(scaleSplit(template, total)));
  }

  function handleTypeChange(typeId: string | null) {
    setIncomeTypeId(typeId);
    prefill(typeId, amount);
  }

  function handleAmountChange(value: number | null) {
    setAmount(value);
    prefill(incomeTypeId, value);
  }

  function handleSplitChange(cells: SplitCell[]) {
    setSplit(cells);
    setSplitTouched(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return toast.error("Name is required.");
    if (!amount || amount <= 0) return toast.error("Amount must be greater than 0.");
    if (!incomeTypeId) return toast.error("Pick an income type.");
    if (splitRemaining(amount, split) !== 0) {
      return toast.error("Allocate the full amount across envelopes before saving.");
    }

    setBusy(true);
    try {
      const payload = {
        name,
        amount,
        date,
        income_type_id: incomeTypeId,
        notes: notes || null,
        allocations: split,
      };
      const result = isEdit ? await updateIncome(initial.id, payload) : await createIncome(payload);
      if (!result.ok) return toast.error(result.error);

      toast.success(isEdit ? "Income updated" : "Income saved");
      if (!isEdit) {
        setName("");
        setAmount(null);
        setIncomeTypeId(null);
        setNotes("");
        setSplit(emptySplit);
        setSplitTouched(false);
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
          <AmountInput
            id="income-amount"
            value={amount}
            onChange={handleAmountChange}
            placeholder="0"
            required
          />
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
          onChange={handleTypeChange}
          options={incomeTypes.map((t) => ({ value: t.id, label: t.name }))}
          placeholder="Income type"
        />
      </div>

      <IncomeSplitEditor
        budgetTypes={splitTypes}
        total={amount}
        value={split}
        onChange={handleSplitChange}
      />

      <div className="space-y-1.5">
        <Label htmlFor="income-notes">Notes (optional)</Label>
        <Textarea id="income-notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
      </div>

      <div className="flex gap-2 pt-1">
        <Button
          type="submit"
          className="flex-1"
          disabled={busy || (amount != null && amount > 0 && remaining !== 0)}
        >
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
