"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Archive, ArchiveRestore, Plus } from "lucide-react";
import { createIncomeType, updateIncomeType } from "@/lib/actions/settings";
import type { Cadence, IncomeType } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface IncomeTypesCardProps {
  incomeTypes: IncomeType[];
}

/** Clickable pill that toggles a cadence between monthly and yearly. */
function CadenceToggle({
  cadence,
  onChange,
}: {
  cadence: Cadence;
  onChange: (c: Cadence) => void;
}) {
  const monthly = cadence === "monthly";
  return (
    <button
      type="button"
      onClick={() => onChange(monthly ? "yearly" : "monthly")}
      className={cn(
        "rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors",
        monthly
          ? "bg-secondary text-foreground hover:bg-[#e2ddd0]"
          : "border border-input text-muted-foreground hover:text-foreground"
      )}
    >
      {cadence}
    </button>
  );
}

export function IncomeTypesCard({ incomeTypes }: IncomeTypesCardProps) {
  const active = incomeTypes.filter((t) => t.is_active);
  const archived = incomeTypes.filter((t) => !t.is_active);

  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [newCadence, setNewCadence] = useState<Cadence>("yearly");
  const [busy, setBusy] = useState(false);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return toast.error("Name is required.");
    setBusy(true);
    try {
      const result = await createIncomeType({ name: newName, cadence: newCadence });
      if (!result.ok) return toast.error(result.error);
      toast.success("Income type added");
      setNewName("");
      setNewCadence("yearly");
      setAdding(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <SettingsCard
      title="Income types"
      action={
        <Button size="sm" variant="secondary" onClick={() => setAdding((v) => !v)}>
          <Plus className="size-4" />
          Add
        </Button>
      }
    >
      {adding && (
        <form onSubmit={handleAdd} className="mb-3 flex items-center gap-2">
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="New income type"
            autoComplete="off"
            className="h-9 flex-1"
            autoFocus
          />
          <CadenceToggle cadence={newCadence} onChange={setNewCadence} />
          <Button type="submit" size="sm" disabled={busy}>
            Add
          </Button>
        </form>
      )}

      <div>
        {active.map((incomeType, i) => (
          <IncomeTypeRow key={incomeType.id} incomeType={incomeType} last={i === active.length - 1} />
        ))}
      </div>

      {archived.length > 0 && (
        <details className="mt-2 text-[13px]">
          <summary className="cursor-pointer text-muted-foreground">
            Archived ({archived.length})
          </summary>
          <div className="mt-2 space-y-1">
            {archived.map((incomeType) => (
              <ArchivedRow
                key={incomeType.id}
                name={incomeType.name}
                onRestore={() => updateIncomeType(incomeType.id, { is_active: true })}
              />
            ))}
          </div>
        </details>
      )}
    </SettingsCard>
  );
}

function IncomeTypeRow({ incomeType, last }: { incomeType: IncomeType; last: boolean }) {
  const [name, setName] = useState(incomeType.name);
  const [cadence, setCadence] = useState<Cadence>(incomeType.cadence);
  const [busy, setBusy] = useState(false);
  const dirty = name !== incomeType.name || cadence !== incomeType.cadence;

  async function handleSave() {
    setBusy(true);
    try {
      const result = await updateIncomeType(incomeType.id, { name, cadence });
      if (!result.ok) return toast.error(result.error);
      toast.success("Income type updated");
    } finally {
      setBusy(false);
    }
  }

  async function handleArchive() {
    if (
      !window.confirm(`Archive "${incomeType.name}"? It stays in history but disappears from forms.`)
    )
      return;
    setBusy(true);
    try {
      const result = await updateIncomeType(incomeType.id, { is_active: false });
      if (!result.ok) return toast.error(result.error);
      toast.success("Income type archived");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="flex items-center gap-2.5 py-2.5"
      style={last ? undefined : { borderBottom: "1px solid var(--border)" }}
    >
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="flex-1 rounded-[4px] border-b border-dashed border-transparent bg-transparent px-1 py-0.5 text-[13.5px] outline-none transition-colors hover:border-placeholder focus:border-solid focus:border-foreground"
        aria-label={`Rename ${incomeType.name}`}
      />
      <CadenceToggle cadence={cadence} onChange={setCadence} />
      {dirty && (
        <Button size="xs" onClick={handleSave} disabled={busy}>
          Save
        </Button>
      )}
      <Button
        size="icon-sm"
        variant="ghost"
        className="text-placeholder hover:text-foreground"
        onClick={handleArchive}
        disabled={busy}
        aria-label={`Archive ${incomeType.name}`}
      >
        <Archive className="size-4" />
      </Button>
    </div>
  );
}

export function ArchivedRow({
  name,
  onRestore,
  struck = true,
}: {
  name: string;
  onRestore: () => Promise<{ ok: boolean }>;
  struck?: boolean;
}) {
  const [busy, setBusy] = useState(false);

  async function handleRestore() {
    setBusy(true);
    try {
      await onRestore();
      toast.success(`${name} restored`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center justify-between gap-2 text-[13px] text-placeholder">
      <span className={cn("flex-1", struck && "line-through")}>{name}</span>
      <button
        type="button"
        onClick={handleRestore}
        disabled={busy}
        className="inline-flex items-center gap-1 text-[12px] text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArchiveRestore className="size-3.5" />
        Restore
      </button>
    </div>
  );
}

/** White settings card with a title + optional header action. */
export function SettingsCard({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-[16px] bg-card px-6 py-[22px] shadow-[0_1px_2px_rgba(38,35,30,0.05)]">
      <div className="flex items-center justify-between">
        <span className="text-[15px] font-bold">{title}</span>
        {action}
      </div>
      <div className="mt-3">{children}</div>
    </div>
  );
}
