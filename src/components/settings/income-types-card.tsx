"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Archive, ArchiveRestore } from "lucide-react";
import { createIncomeType, updateIncomeType } from "@/lib/actions/settings";
import type { Cadence, IncomeType } from "@/lib/types";
import { SimpleSelect } from "@/components/simple-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const cadenceOptions = [
  { value: "monthly", label: "Monthly" },
  { value: "yearly", label: "Yearly" },
];

interface IncomeTypesCardProps {
  incomeTypes: IncomeType[];
}

export function IncomeTypesCard({ incomeTypes }: IncomeTypesCardProps) {
  const active = incomeTypes.filter((t) => t.is_active);
  const archived = incomeTypes.filter((t) => !t.is_active);

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
          placeholder="New income type"
          autoComplete="off"
          className="flex-1"
        />
        <SimpleSelect
          value={newCadence}
          onChange={(v) => setNewCadence(v as Cadence)}
          options={cadenceOptions}
          className="w-28"
        />
        <Button type="submit" disabled={busy}>
          Add
        </Button>
      </form>

      <div className="space-y-2">
        {active.map((incomeType) => (
          <IncomeTypeRow key={incomeType.id} incomeType={incomeType} />
        ))}
      </div>

      {archived.length > 0 && (
        <details className="text-sm">
          <summary className="cursor-pointer text-muted-foreground">
            Archived ({archived.length})
          </summary>
          <div className="mt-2 space-y-2">
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
    </div>
  );
}

function IncomeTypeRow({ incomeType }: { incomeType: IncomeType }) {
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
    if (!window.confirm(`Archive "${incomeType.name}"? It stays in history but disappears from forms.`))
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
    <div className="flex items-center gap-2">
      <Input value={name} onChange={(e) => setName(e.target.value)} className="flex-1" />
      <SimpleSelect
        value={cadence}
        onChange={(v) => setCadence(v as Cadence)}
        options={cadenceOptions}
        className="w-28"
      />
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
}: {
  name: string;
  onRestore: () => Promise<{ ok: boolean }>;
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
    <div className="flex items-center justify-between gap-2 text-muted-foreground">
      <span>{name}</span>
      <Button size="sm" variant="ghost" onClick={handleRestore} disabled={busy}>
        <ArchiveRestore className="size-4" />
        Restore
      </Button>
    </div>
  );
}
