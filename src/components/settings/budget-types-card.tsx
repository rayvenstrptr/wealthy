"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Archive } from "lucide-react";
import { createBudgetType, updateBudgetType } from "@/lib/actions/settings";
import type { BudgetType } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArchivedRow } from "./income-types-card";

interface BudgetTypesCardProps {
  budgetTypes: BudgetType[];
}

export function BudgetTypesCard({ budgetTypes }: BudgetTypesCardProps) {
  const active = budgetTypes.filter((t) => t.is_active);
  const archived = budgetTypes.filter((t) => !t.is_active);

  const [newName, setNewName] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return toast.error("Name is required.");
    setBusy(true);
    try {
      const result = await createBudgetType(newName);
      if (!result.ok) return toast.error(result.error);
      toast.success("Budget type added");
      setNewName("");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <form onSubmit={handleAdd} className="flex gap-2">
        <Input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="New budget type"
          autoComplete="off"
          className="flex-1"
        />
        <Button type="submit" disabled={busy}>
          Add
        </Button>
      </form>

      <div className="space-y-2">
        {active.map((budgetType) => (
          <BudgetTypeRow key={budgetType.id} budgetType={budgetType} />
        ))}
      </div>

      {archived.length > 0 && (
        <details className="text-sm">
          <summary className="cursor-pointer text-muted-foreground">
            Archived ({archived.length})
          </summary>
          <div className="mt-2 space-y-2">
            {archived.map((budgetType) => (
              <ArchivedRow
                key={budgetType.id}
                name={budgetType.name}
                onRestore={() => updateBudgetType(budgetType.id, { is_active: true })}
              />
            ))}
          </div>
        </details>
      )}
    </div>
  );
}

function BudgetTypeRow({ budgetType }: { budgetType: BudgetType }) {
  const [name, setName] = useState(budgetType.name);
  const [busy, setBusy] = useState(false);
  const dirty = name !== budgetType.name;

  async function handleSave() {
    setBusy(true);
    try {
      const result = await updateBudgetType(budgetType.id, { name });
      if (!result.ok) return toast.error(result.error);
      toast.success("Budget type renamed");
    } finally {
      setBusy(false);
    }
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

  return (
    <div className="flex items-center gap-2">
      <Input value={name} onChange={(e) => setName(e.target.value)} className="flex-1" />
      {dirty && (
        <Button size="sm" onClick={handleSave} disabled={busy}>
          Save
        </Button>
      )}
      <Button
        size="icon"
        variant="ghost"
        onClick={handleArchive}
        disabled={busy}
        aria-label={`Archive ${budgetType.name}`}
      >
        <Archive className="size-4" />
      </Button>
    </div>
  );
}
