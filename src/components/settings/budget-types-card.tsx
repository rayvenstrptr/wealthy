"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Check, X } from "lucide-react";
import { createBudgetType, updateBudgetType } from "@/lib/actions/settings";
import { envelopeHue } from "@/lib/envelope-colors";
import type { BudgetType } from "@/lib/types";
import { ArchivedRow } from "./income-types-card";

interface BudgetTypesCardProps {
  budgetTypes: BudgetType[];
}

/**
 * Budget-type manager as a row of envelope-tinted chips. Clicking a chip edits
 * it in place (rename / archive); a dashed "+ Add" chip creates a new one.
 */
export function BudgetTypesCard({ budgetTypes }: BudgetTypesCardProps) {
  const active = budgetTypes.filter((t) => t.is_active);
  const archived = budgetTypes.filter((t) => !t.is_active);

  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleAdd() {
    if (!newName.trim()) return toast.error("Name is required.");
    setBusy(true);
    try {
      const result = await createBudgetType(newName);
      if (!result.ok) return toast.error(result.error);
      toast.success("Budget type added");
      setNewName("");
      setAdding(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {active.map((budgetType) => (
        <BudgetChip key={budgetType.id} budgetType={budgetType} />
      ))}

      {adding ? (
        <span className="inline-flex items-center gap-1 rounded-full border border-input bg-card px-3 py-1">
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
            className="w-20 bg-transparent text-[12px] font-semibold outline-none placeholder:text-placeholder"
          />
          <button
            type="button"
            onClick={handleAdd}
            disabled={busy}
            aria-label="Save new budget type"
            className="text-muted-foreground hover:text-foreground"
          >
            <Check className="size-3.5" />
          </button>
        </span>
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="rounded-full border border-dashed border-input px-3 py-1 text-[12px] text-muted-foreground transition-colors hover:text-foreground"
        >
          + Add
        </button>
      )}

      {archived.length > 0 && (
        <details className="w-full text-[13px]">
          <summary className="cursor-pointer text-muted-foreground">
            Archived ({archived.length})
          </summary>
          <div className="mt-2 max-w-xs space-y-1">
            {archived.map((budgetType) => (
              <ArchivedRow
                key={budgetType.id}
                name={budgetType.name}
                struck={false}
                onRestore={() => updateBudgetType(budgetType.id, { is_active: true })}
              />
            ))}
          </div>
        </details>
      )}
    </div>
  );
}

function BudgetChip({ budgetType }: { budgetType: BudgetType }) {
  const hue = envelopeHue(budgetType.name);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(budgetType.name);
  const [busy, setBusy] = useState(false);

  async function handleSave() {
    if (name.trim() && name !== budgetType.name) {
      setBusy(true);
      try {
        const result = await updateBudgetType(budgetType.id, { name });
        if (!result.ok) return toast.error(result.error);
        toast.success("Budget type renamed");
      } finally {
        setBusy(false);
      }
    }
    setEditing(false);
  }

  async function handleArchive() {
    if (
      !window.confirm(
        `Archive "${budgetType.name}"? Its allocation cells are hidden and it disappears from forms, but history keeps it.`
      )
    )
      return;
    setBusy(true);
    try {
      const result = await updateBudgetType(budgetType.id, { is_active: false });
      if (!result.ok) return toast.error(result.error);
      toast.success("Budget type archived");
    } finally {
      setBusy(false);
    }
  }

  if (editing) {
    return (
      <span
        className="inline-flex items-center gap-1.5 rounded-full px-3 py-1"
        style={{ background: hue.tint }}
      >
        <span className="size-[7px] rounded-full" style={{ background: hue.fill }} />
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSave();
            if (e.key === "Escape") {
              setName(budgetType.name);
              setEditing(false);
            }
          }}
          autoFocus
          className="w-16 bg-transparent text-[12px] font-semibold outline-none"
          style={{ color: hue.text }}
        />
        <button
          type="button"
          onClick={handleSave}
          disabled={busy}
          aria-label="Save"
          style={{ color: hue.text }}
        >
          <Check className="size-3.5" />
        </button>
        <button
          type="button"
          onClick={handleArchive}
          disabled={busy}
          aria-label={`Archive ${budgetType.name}`}
          style={{ color: hue.text }}
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
      className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[12px] font-semibold"
      style={{ background: hue.tint, color: hue.text }}
    >
      <span className="size-[7px] rounded-full" style={{ background: hue.fill }} />
      {budgetType.name}
    </button>
  );
}
