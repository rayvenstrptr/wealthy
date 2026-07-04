"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Archive } from "lucide-react";
import { createExpenseCategory, updateExpenseCategory } from "@/lib/actions/settings";
import type { BudgetType, ExpenseCategory } from "@/lib/types";
import { SimpleSelect } from "@/components/simple-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArchivedRow } from "./income-types-card";

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
          placeholder="New category"
          autoComplete="off"
          className="flex-1"
        />
        <SimpleSelect
          value={newDefault}
          onChange={setNewDefault}
          options={budgetOptions}
          className="w-36"
        />
        <Button type="submit" disabled={busy}>
          Add
        </Button>
      </form>

      <div className="space-y-2">
        {active.map((category) => (
          <CategoryRow key={category.id} category={category} budgetOptions={budgetOptions} />
        ))}
      </div>

      {archived.length > 0 && (
        <details className="text-sm">
          <summary className="cursor-pointer text-muted-foreground">
            Archived ({archived.length})
          </summary>
          <div className="mt-2 space-y-2">
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
    </div>
  );
}

function CategoryRow({
  category,
  budgetOptions,
}: {
  category: ExpenseCategory;
  budgetOptions: { value: string; label: string }[];
}) {
  const [name, setName] = useState(category.name);
  const [defaultBudget, setDefaultBudget] = useState(
    category.default_budget_type_id ?? NO_DEFAULT
  );
  const [busy, setBusy] = useState(false);
  const dirty =
    name !== category.name || defaultBudget !== (category.default_budget_type_id ?? NO_DEFAULT);

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
    <div className="flex items-center gap-2">
      <Input value={name} onChange={(e) => setName(e.target.value)} className="flex-1" />
      <SimpleSelect
        value={defaultBudget}
        onChange={setDefaultBudget}
        options={budgetOptions}
        className="w-36"
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
        aria-label={`Archive ${category.name}`}
      >
        <Archive className="size-4" />
      </Button>
    </div>
  );
}
