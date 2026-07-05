"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Check, X } from "lucide-react";
import { createInvestmentItem, updateInvestmentItem } from "@/lib/actions/investments";
import { assetClassHue } from "@/lib/asset-class-colors";
import type { AssetClass, InvestmentItem } from "@/lib/types";
import { ArchivedRow } from "./income-types-card";

interface InvestmentItemsCardProps {
  assetClasses: AssetClass[];
  items: InvestmentItem[];
}

/** Investment items grouped by class — the options in the transaction form. */
export function InvestmentItemsCard({ assetClasses, items }: InvestmentItemsCardProps) {
  const activeClasses = assetClasses.filter((c) => c.is_active).sort((a, b) => a.sort - b.sort);
  const archived = items.filter((i) => !i.is_active);

  return (
    <div className="space-y-3">
      {activeClasses.map((assetClass) => (
        <ClassItems
          key={assetClass.id}
          assetClass={assetClass}
          items={items.filter((i) => i.asset_class_id === assetClass.id && i.is_active)}
        />
      ))}

      {archived.length > 0 && (
        <details className="text-[13px]">
          <summary className="cursor-pointer text-muted-foreground">
            Archived ({archived.length})
          </summary>
          <div className="mt-2 max-w-xs space-y-1">
            {archived.map((item) => (
              <ArchivedRow
                key={item.id}
                name={item.name}
                struck={false}
                onRestore={() => updateInvestmentItem(item.id, { is_active: true })}
              />
            ))}
          </div>
        </details>
      )}
    </div>
  );
}

function ClassItems({ assetClass, items }: { assetClass: AssetClass; items: InvestmentItem[] }) {
  const hue = assetClassHue(assetClass.name);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleAdd() {
    if (!newName.trim()) return toast.error("Name is required.");
    setBusy(true);
    try {
      const result = await createInvestmentItem({ name: newName, assetClassId: assetClass.id });
      if (!result.ok) return toast.error(result.error);
      toast.success("Item added");
      setNewName("");
      setAdding(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="flex items-center gap-1.5 text-[11px] font-semibold tracking-[0.08em] text-muted-foreground uppercase">
        <span className="size-[7px] rounded-full" style={{ background: hue.fill }} aria-hidden />
        {assetClass.name}
      </div>
      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
        {items.map((item) => (
          <ItemChip key={item.id} item={item} />
        ))}
        {adding ? (
          <span className="inline-flex items-center gap-1 rounded-full border border-input bg-card px-2.5 py-0.5">
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleAdd();
                if (e.key === "Escape") {
                  setNewName("");
                  setAdding(false);
                }
              }}
              placeholder="Name"
              autoFocus
              className="w-24 bg-transparent text-[12px] font-medium outline-none placeholder:text-placeholder"
            />
            <button
              type="button"
              onClick={handleAdd}
              disabled={busy}
              aria-label={`Save new ${assetClass.name} item`}
              className="text-muted-foreground hover:text-foreground"
            >
              <Check className="size-3.5" />
            </button>
          </span>
        ) : (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="rounded-full border border-dashed border-input px-2.5 py-0.5 text-[12px] text-muted-foreground transition-colors hover:text-foreground"
          >
            + Add
          </button>
        )}
      </div>
    </div>
  );
}

function ItemChip({ item }: { item: InvestmentItem }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(item.name);
  const [busy, setBusy] = useState(false);

  async function handleSave() {
    if (name.trim() && name !== item.name) {
      setBusy(true);
      try {
        const result = await updateInvestmentItem(item.id, { name });
        if (!result.ok) return toast.error(result.error);
        toast.success("Item renamed");
      } finally {
        setBusy(false);
      }
    }
    setEditing(false);
  }

  async function handleArchive() {
    if (!window.confirm(`Archive "${item.name}"? It disappears from the transaction form; history keeps it.`))
      return;
    setBusy(true);
    try {
      const result = await updateInvestmentItem(item.id, { is_active: false });
      if (!result.ok) return toast.error(result.error);
      toast.success("Item archived");
    } finally {
      setBusy(false);
    }
  }

  if (editing) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-2.5 py-0.5">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSave();
            if (e.key === "Escape") {
              setName(item.name);
              setEditing(false);
            }
          }}
          autoFocus
          className="w-24 bg-transparent text-[12px] font-medium outline-none"
        />
        <button type="button" onClick={handleSave} disabled={busy} aria-label="Save" className="text-muted-foreground hover:text-foreground">
          <Check className="size-3.5" />
        </button>
        <button
          type="button"
          onClick={handleArchive}
          disabled={busy}
          aria-label={`Archive ${item.name}`}
          className="text-muted-foreground hover:text-foreground"
        >
          <X className="size-3.5" />
        </button>
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      className="rounded-full bg-secondary px-2.5 py-0.5 text-[12px] font-medium transition-colors hover:bg-secondary/70"
    >
      {item.name}
    </button>
  );
}
