"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { createInvestmentItem, createInvestmentYield } from "@/lib/actions/investments";
import { scaleSplit, splitRemaining, type SplitCell } from "@/lib/allocation-split";
import { todayWIB } from "@/lib/dates";
import type { AssetClass, BudgetType, IncomeType, InvestmentItem } from "@/lib/types";
import { AmountInput } from "@/components/amount-input";
import { IncomeSplitEditor } from "@/components/income-split-editor";
import { SimpleSelect } from "@/components/simple-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const NEW_ITEM = "new";

interface YieldFormProps {
  assetClasses: AssetClass[];
  items: InvestmentItem[];
  incomeTypes: IncomeType[];
  budgetTypes: BudgetType[];
  /** Prefill source: how the latest income of each type was split. */
  latestSplitByType: Record<string, SplitCell[]>;
  onSaved?: () => void;
}

/**
 * Records a dividend/coupon/TCG yield from a holding. ONE entry: it creates a
 * normal income (type + envelope split, same exact-sum rule) attributed to the
 * investment item, and the investments view folds it into realized.
 */
export function YieldForm({
  assetClasses,
  items,
  incomeTypes,
  budgetTypes,
  latestSplitByType,
  onSaved,
}: YieldFormProps) {
  const activeClasses = assetClasses.filter((c) => c.is_active);
  const activeIncomeTypes = incomeTypes.filter((t) => t.is_active);
  const splitTypes = useMemo(() => budgetTypes.filter((b) => b.is_active), [budgetTypes]);
  const emptySplit = useMemo(
    () => splitTypes.map((b) => ({ budget_type_id: b.id, amount: 0 })),
    [splitTypes]
  );

  // Default the income type to the seeded "Yield" (or first *yield* match).
  const defaultTypeId = useMemo(() => {
    const yieldTypes = activeIncomeTypes.filter((t) => t.name.toLowerCase().includes("yield"));
    const exact = yieldTypes.find((t) => t.name.toLowerCase() === "yield");
    return exact?.id ?? yieldTypes[0]?.id ?? null;
  }, [activeIncomeTypes]);

  const [classId, setClassId] = useState<string | null>(null);
  const [itemChoice, setItemChoice] = useState<string | null>(null);
  const [newItemName, setNewItemName] = useState("");
  const [name, setName] = useState("");
  const [nameTouched, setNameTouched] = useState(false);
  const [amount, setAmount] = useState<number | null>(null);
  const [date, setDate] = useState(todayWIB());
  const [incomeTypeId, setIncomeTypeId] = useState<string | null>(defaultTypeId);
  const [split, setSplit] = useState<SplitCell[]>(emptySplit);
  // Once the user hand-edits the split, amount/type changes stop re-prefilling it.
  const [splitTouched, setSplitTouched] = useState(false);
  const [busy, setBusy] = useState(false);

  const classItems = useMemo(
    () =>
      items
        .filter((i) => i.asset_class_id === classId && i.is_active)
        .sort((a, b) => a.name.localeCompare(b.name)),
    [items, classId]
  );

  const remaining = amount != null && amount > 0 ? splitRemaining(amount, split) : null;

  function alignedCells(cells: SplitCell[]): SplitCell[] {
    const byId = new Map(cells.map((c) => [c.budget_type_id, c.amount]));
    return splitTypes.map((b) => ({ budget_type_id: b.id, amount: byId.get(b.id) ?? 0 }));
  }

  /** Prefill from the latest income of the same type, scaled to the amount. */
  function prefill(typeId: string | null, total: number | null) {
    if (splitTouched || !typeId || total == null || total <= 0) return;
    const template = latestSplitByType[typeId];
    if (!template || template.length === 0) return;
    setSplit(alignedCells(scaleSplit(template, total)));
  }

  /** Auto-name "BBCA yield" until the user types their own. */
  function suggestName(itemId: string | null) {
    if (nameTouched || !itemId || itemId === NEW_ITEM) return;
    const item = items.find((i) => i.id === itemId);
    if (item) setName(`${item.name} yield`);
  }

  function handleClassChange(id: string) {
    setClassId(id);
    setItemChoice(null); // items belong to a class — reset the pick
  }

  function handleItemChange(id: string) {
    setItemChoice(id);
    suggestName(id);
  }

  function handleAmountChange(value: number | null) {
    setAmount(value);
    prefill(incomeTypeId, value);
  }

  function handleTypeChange(typeId: string) {
    setIncomeTypeId(typeId);
    prefill(typeId, amount);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!classId) return toast.error("Pick an asset class.");
    if (!itemChoice) return toast.error("Pick an item.");
    if (itemChoice === NEW_ITEM && !newItemName.trim())
      return toast.error("Give the new item a name.");
    if (!name.trim()) return toast.error("Name is required.");
    if (!amount || amount <= 0) return toast.error("Amount must be greater than 0.");
    if (!incomeTypeId) return toast.error("Pick an income type.");
    if (splitRemaining(amount, split) !== 0) {
      return toast.error("Allocate the full amount across envelopes before saving.");
    }

    setBusy(true);
    try {
      let itemId = itemChoice;
      if (itemChoice === NEW_ITEM) {
        const created = await createInvestmentItem({ name: newItemName, assetClassId: classId });
        if (!created.ok) return toast.error(created.error);
        itemId = created.id;
      }

      const result = await createInvestmentYield({
        item_id: itemId,
        name,
        amount,
        date,
        income_type_id: incomeTypeId,
        notes: null,
        allocations: split,
      });
      if (!result.ok) return toast.error(result.error);

      toast.success("Yield recorded");
      onSaved?.();
    } finally {
      setBusy(false);
    }
  }

  const itemOptions = [
    ...classItems.map((i) => ({ value: i.id, label: i.name })),
    { value: NEW_ITEM, label: "+ New item…" },
  ];

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="yield-class">Asset class</Label>
          <SimpleSelect
            id="yield-class"
            value={classId}
            onChange={handleClassChange}
            options={activeClasses.map((c) => ({ value: c.id, label: c.name }))}
            placeholder="Class"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="yield-type">Income type</Label>
          <SimpleSelect
            id="yield-type"
            value={incomeTypeId}
            onChange={handleTypeChange}
            options={activeIncomeTypes.map((t) => ({ value: t.id, label: t.name }))}
            placeholder="Type"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="yield-item">Item</Label>
        <SimpleSelect
          id="yield-item"
          value={itemChoice}
          onChange={handleItemChange}
          options={itemOptions}
          placeholder="Which holding paid this?"
          disabled={classId == null}
        />
      </div>
      {itemChoice === NEW_ITEM && (
        <Input
          value={newItemName}
          onChange={(e) => setNewItemName(e.target.value)}
          placeholder="New item name (e.g. BBCA, Deposito Neo)"
          autoComplete="off"
        />
      )}

      <div className="space-y-1.5">
        <Label htmlFor="yield-name">Name</Label>
        <Input
          id="yield-name"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setNameTouched(true);
          }}
          placeholder="BBCA dividend"
          autoComplete="off"
          required
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="yield-amount">Amount</Label>
          <AmountInput
            id="yield-amount"
            value={amount}
            onChange={handleAmountChange}
            placeholder="0"
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="yield-date">Date</Label>
          <Input
            id="yield-date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
          />
        </div>
      </div>

      <IncomeSplitEditor
        budgetTypes={splitTypes}
        total={amount}
        value={split}
        onChange={(cells) => {
          setSplit(cells);
          setSplitTouched(true);
        }}
      />

      <div className="pt-1">
        <Button
          type="submit"
          className="w-full"
          disabled={busy || (amount != null && amount > 0 && remaining !== 0)}
        >
          {busy ? "Saving…" : "Record yield"}
        </Button>
      </div>
    </form>
  );
}
