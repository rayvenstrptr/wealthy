"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  createInvestmentItem,
  createInvestmentTransaction,
  deleteInvestmentTransaction,
  updateInvestmentTransaction,
} from "@/lib/actions/investments";
import { todayWIB } from "@/lib/dates";
import { formatIDR } from "@/lib/format";
import type { AssetClass, InvestmentItem, InvestmentTransaction, TxSide } from "@/lib/types";
import { AmountInput } from "@/components/amount-input";
import { SimpleSelect } from "@/components/simple-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

const NEW_ITEM = "new";

interface TransactionFormProps {
  assetClasses: AssetClass[];
  items: InvestmentItem[];
  /** Remaining budget per class for the CURRENT budget year (buy warning). */
  remainingByClass: Record<string, number>;
  initial?: InvestmentTransaction;
  onSaved?: () => void;
}

export function TransactionForm({
  assetClasses,
  items,
  remainingByClass,
  initial,
  onSaved,
}: TransactionFormProps) {
  const isEdit = initial !== undefined;
  const initialItem = isEdit ? items.find((i) => i.id === initial.item_id) : undefined;

  const [classId, setClassId] = useState<string | null>(initialItem?.asset_class_id ?? null);
  const [itemChoice, setItemChoice] = useState<string | null>(initial?.item_id ?? null);
  const [newItemName, setNewItemName] = useState("");
  const [side, setSide] = useState<TxSide>(initial?.side ?? "buy");
  const [amount, setAmount] = useState<number | null>(initial?.amount ?? null);
  const [quantityDraft, setQuantityDraft] = useState(
    initial?.quantity != null ? String(initial.quantity) : ""
  );
  const [date, setDate] = useState(initial?.date ?? todayWIB());
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [busy, setBusy] = useState(false);

  const activeClasses = useMemo(
    () =>
      assetClasses.filter((c) => c.is_active || c.id === initialItem?.asset_class_id),
    [assetClasses, initialItem]
  );
  const classItems = useMemo(
    () =>
      items
        .filter((i) => i.asset_class_id === classId && (i.is_active || i.id === initial?.item_id))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [items, classId, initial]
  );

  const quantity = quantityDraft.trim() === "" ? null : Number.parseFloat(quantityDraft);
  const remaining = classId != null ? remainingByClass[classId] : undefined;
  const overBudget =
    side === "buy" && remaining !== undefined && amount != null && amount > remaining;

  function handleClassChange(id: string) {
    setClassId(id);
    setItemChoice(null); // items belong to a class — reset the pick
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!classId) return toast.error("Pick an asset class.");
    if (!itemChoice) return toast.error("Pick an item.");
    if (itemChoice === NEW_ITEM && !newItemName.trim())
      return toast.error("Give the new item a name.");
    if (!amount || amount <= 0) return toast.error("Amount must be greater than 0.");
    if (quantity != null && (!Number.isFinite(quantity) || quantity <= 0))
      return toast.error("Quantity must be greater than 0 (or left empty).");

    setBusy(true);
    try {
      let itemId = itemChoice;
      if (itemChoice === NEW_ITEM) {
        const created = await createInvestmentItem({ name: newItemName, assetClassId: classId });
        if (!created.ok) return toast.error(created.error);
        itemId = created.id;
      }

      const payload = {
        item_id: itemId,
        side,
        amount,
        quantity,
        date,
        notes: notes || null,
      };
      const result = isEdit
        ? await updateInvestmentTransaction(initial.id, payload)
        : await createInvestmentTransaction(payload);
      if (!result.ok) return toast.error(result.error);

      toast.success(isEdit ? "Transaction updated" : side === "buy" ? "Buy recorded" : "Sell recorded");
      if (!isEdit) {
        setAmount(null);
        setQuantityDraft("");
        setNewItemName("");
        setNotes("");
      }
      onSaved?.();
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (!isEdit) return;
    if (!window.confirm("Delete this transaction?")) return;
    setBusy(true);
    try {
      const result = await deleteInvestmentTransaction(initial.id);
      if (!result.ok) return toast.error(result.error);
      toast.success("Transaction deleted");
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
      {/* Buy / Sell toggle */}
      <div className="flex rounded-full bg-secondary p-[3px] text-[12.5px]">
        {(["buy", "sell"] as const).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setSide(s)}
            className={cn(
              "flex-1 rounded-full py-1.5 font-semibold capitalize transition-colors",
              side === s
                ? "bg-card text-foreground shadow-[0_1px_2px_rgba(0,0,0,0.06)]"
                : "text-muted-foreground"
            )}
          >
            {s}
          </button>
        ))}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="tx-class">Asset class</Label>
        <SimpleSelect
          id="tx-class"
          value={classId}
          onChange={handleClassChange}
          options={activeClasses.map((c) => ({ value: c.id, label: c.name }))}
          placeholder="Class"
        />
      </div>
      {/* Item gets a full row of its own — names run long ("Pokemon TCG - …"). */}
      <div className="space-y-1.5">
        <Label htmlFor="tx-item">Item</Label>
        <SimpleSelect
          id="tx-item"
          value={itemChoice}
          onChange={setItemChoice}
          options={itemOptions}
          placeholder="Item"
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

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="tx-amount">Total amount</Label>
          <AmountInput id="tx-amount" value={amount} onChange={setAmount} placeholder="0" required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="tx-quantity">Quantity (optional)</Label>
          <Input
            id="tx-quantity"
            type="text"
            inputMode="decimal"
            autoComplete="off"
            className="font-semibold tabular-nums"
            placeholder="e.g. 100 or 0.005"
            value={quantityDraft}
            onChange={(e) => setQuantityDraft(e.target.value.replace(",", "."))}
          />
        </div>
      </div>

      {/* Budget hint: warn, never block — Ray sometimes buys a little over. */}
      {side === "buy" && remaining !== undefined && (
        <p
          className={cn(
            "rounded-[10px] px-3 py-2 text-[12px]",
            overBudget ? "bg-amber-100 font-semibold text-amber-800" : "bg-secondary/60 text-muted-foreground"
          )}
        >
          {overBudget
            ? `⚠ This buy exceeds the remaining budget for this class (${formatIDR(remaining)} left this budget year).`
            : `Remaining budget this year: ${formatIDR(remaining)}`}
        </p>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="tx-date">Date</Label>
          <Input id="tx-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="tx-notes">Notes (optional)</Label>
          <Textarea id="tx-notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={1} />
        </div>
      </div>

      <div className="flex gap-2 pt-1">
        <Button type="submit" className="flex-1" disabled={busy}>
          {busy ? "Saving…" : isEdit ? "Save changes" : side === "buy" ? "Record buy" : "Record sell"}
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
