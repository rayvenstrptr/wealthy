"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Archive, Plus } from "lucide-react";
import { createExpenseCategory, updateExpenseCategory } from "@/lib/actions/settings";
import { envelopeHue } from "@/lib/envelope-colors";
import type { BudgetType, ExpenseCategory } from "@/lib/types";
import { SimpleSelect } from "@/components/simple-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArchivedRow, SettingsCard } from "./income-types-card";

const NO_DEFAULT = "none";

interface CategoriesCardProps {
  categories: ExpenseCategory[];
  budgetTypes: BudgetType[];
}

export function CategoriesCard({ categories, budgetTypes }: CategoriesCardProps) {
  const active = categories.filter((c) => c.is_active);
  const archived = categories.filter((c) => !c.is_active);
  const budgetOptions = [
    { value: NO_DEFAULT, label: "No default" },
    ...budgetTypes.map((b) => ({ value: b.id, label: b.name })),
  ];
  const budgetNameById = new Map(budgetTypes.map((b) => [b.id, b.name]));

  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDefault, setNewDefault] = useState<string>(NO_DEFAULT);
  const [busy, setBusy] = useState(false);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return toast.error("Name is required.");
    setBusy(true);
    try {
      const result = await createExpenseCategory({
        name: newName,
        defaultBudgetTypeId: newDefault === NO_DEFAULT ? null : newDefault,
      });
      if (!result.ok) return toast.error(result.error);
      toast.success("Category added");
      setNewName("");
      setNewDefault(NO_DEFAULT);
      setAdding(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <SettingsCard
      title="Expense categories"
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
            placeholder="New category"
            autoComplete="off"
            className="h-9 flex-1"
            autoFocus
          />
          <SimpleSelect
            value={newDefault}
            onChange={setNewDefault}
            options={budgetOptions}
            className="h-9 w-36"
          />
          <Button type="submit" size="sm" disabled={busy}>
            Add
          </Button>
        </form>
      )}

      <div>
        {active.map((category, i) => (
          <CategoryRow
            key={category.id}
            category={category}
            budgetOptions={budgetOptions}
            budgetName={
              category.default_budget_type_id
                ? budgetNameById.get(category.default_budget_type_id)
                : undefined
            }
            last={i === active.length - 1}
          />
        ))}
      </div>

      <p className="mt-2.5 text-[11.5px] text-muted-foreground">
        Chip = default budget type, prefills the expense form.
      </p>

      {archived.length > 0 && (
        <details className="mt-2 text-[13px]">
          <summary className="cursor-pointer text-muted-foreground">
            Archived ({archived.length})
          </summary>
          <div className="mt-2 space-y-1">
            {archived.map((category) => (
              <ArchivedRow
                key={category.id}
                name={category.name}
                onRestore={() => updateExpenseCategory(category.id, { is_active: true })}
              />
            ))}
          </div>
        </details>
      )}
    </SettingsCard>
  );
}

function CategoryRow({
  category,
  budgetOptions,
  budgetName,
  last,
}: {
  category: ExpenseCategory;
  budgetOptions: { value: string; label: string }[];
  budgetName: string | undefined;
  last: boolean;
}) {
  const [name, setName] = useState(category.name);
  const [defaultBudget, setDefaultBudget] = useState(
    category.default_budget_type_id ?? NO_DEFAULT
  );
  const [busy, setBusy] = useState(false);
  const dirty =
    name !== category.name || defaultBudget !== (category.default_budget_type_id ?? NO_DEFAULT);
  const hue = envelopeHue(budgetName);

  async function handleSave() {
    setBusy(true);
    try {
      const result = await updateExpenseCategory(category.id, {
        name,
        default_budget_type_id: defaultBudget === NO_DEFAULT ? null : defaultBudget,
      });
      if (!result.ok) return toast.error(result.error);
      toast.success("Category updated");
    } finally {
      setBusy(false);
    }
  }

  async function handleArchive() {
    if (!window.confirm(`Archive "${category.name}"?`)) return;
    setBusy(true);
    try {
      const result = await updateExpenseCategory(category.id, { is_active: false });
      if (!result.ok) return toast.error(result.error);
      toast.success("Category archived");
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
        className="min-w-0 flex-1 rounded-[4px] border-b border-dashed border-transparent bg-transparent px-1 py-0.5 text-[13.5px] outline-none transition-colors hover:border-placeholder focus:border-solid focus:border-foreground"
        aria-label={`Rename ${category.name}`}
      />
      {budgetName && (
        <span className="size-[7px] shrink-0 rounded-full" style={{ background: hue.fill }} />
      )}
      <SimpleSelect
        value={defaultBudget}
        onChange={setDefaultBudget}
        options={budgetOptions}
        className="h-8 w-32 shrink-0"
      />
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
        aria-label={`Archive ${category.name}`}
      >
        <Archive className="size-4" />
      </Button>
    </div>
  );
}
