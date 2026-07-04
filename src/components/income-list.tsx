"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Pencil, Plus, Search } from "lucide-react";
import { updateIncome } from "@/lib/actions/entries";
import { formatDate } from "@/lib/dates";
import type { IncomeRow, IncomeType } from "@/lib/types";
import { IncomeForm } from "@/components/income-form";
import { InlineAmount, InlineName } from "@/components/inline-edit";
import { SimpleSelect } from "@/components/simple-select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

const ALL = "all";

interface IncomeListProps {
  incomes: IncomeRow[];
  incomeTypes: IncomeType[];
  month: string; // "YYYY-MM" or "all"
  type: string; // income type id or "all"
  q: string;
}

export function IncomeList({ incomes, incomeTypes, month, type, q }: IncomeListProps) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<IncomeRow | null>(null);
  const [searchDraft, setSearchDraft] = useState(q);

  const typeById = new Map(incomeTypes.map((t) => [t.id, t]));

  function update(patch: { month?: string; type?: string; q?: string }) {
    const next = { month, type, q, ...patch };
    const params = new URLSearchParams();
    params.set("month", next.month);
    if (next.type !== ALL) params.set("type", next.type);
    if (next.q) params.set("q", next.q);
    router.replace(`/income?${params.toString()}`);
  }

  // Debounced search → URL.
  useEffect(() => {
    if (searchDraft === q) return;
    const timer = setTimeout(() => update({ q: searchDraft }), 350);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchDraft]);

  function formTypes(income?: IncomeRow) {
    return incomeTypes.filter((t) => t.is_active || t.id === income?.income_type_id);
  }

  async function savePatch(
    income: IncomeRow,
    patch: Partial<Pick<IncomeRow, "name" | "amount">>
  ): Promise<boolean> {
    const result = await updateIncome(income.id, {
      name: income.name,
      amount: income.amount,
      date: income.date,
      income_type_id: income.income_type_id,
      notes: income.notes,
      ...patch,
    });
    if (!result.ok) {
      toast.error(result.error);
      return false;
    }
    toast.success("Updated");
    return true;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-40 flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchDraft}
            onChange={(e) => setSearchDraft(e.target.value)}
            placeholder="Search income…"
            className="pl-8"
            aria-label="Search income by name"
          />
        </div>
        <Input
          type="month"
          value={month === ALL ? "" : month}
          onChange={(e) => update({ month: e.target.value || ALL })}
          className="w-40"
          aria-label="Filter by month"
        />
        {month !== ALL && (
          <Button variant="ghost" size="sm" onClick={() => update({ month: ALL })}>
            All time
          </Button>
        )}
        <SimpleSelect
          value={type}
          onChange={(v) => update({ type: v })}
          options={[
            { value: ALL, label: "All types" },
            ...incomeTypes.map((t) => ({
              value: t.id,
              label: t.is_active ? t.name : `${t.name} (archived)`,
            })),
          ]}
          className="w-36"
        />
        <div className="ml-auto">
          <Button size="sm" onClick={() => setAdding(true)}>
            <Plus className="size-4" />
            Income
          </Button>
        </div>
      </div>

      {incomes.length === 0 ? (
        <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
          No income matches these filters.
        </p>
      ) : (
        <ul className="divide-y rounded-lg border">
          {incomes.map((income) => {
            const incomeType = typeById.get(income.income_type_id);
            return (
              <li key={income.id} className="flex items-center gap-1.5 px-2 py-2">
                <div className="min-w-0 flex-1">
                  <InlineName
                    key={`${income.id}:${income.name}`}
                    value={income.name}
                    onSave={(name) => savePatch(income, { name })}
                    aria-label={`Rename ${income.name}`}
                  />
                  <div className="mt-0.5 flex flex-wrap items-center gap-1.5 px-1.5 text-xs text-muted-foreground">
                    <span>{formatDate(income.date)}</span>
                    {incomeType && <Badge variant="secondary">{incomeType.name}</Badge>}
                  </div>
                </div>
                <InlineAmount
                  key={`${income.id}:${income.amount}`}
                  value={income.amount}
                  onSave={(amount) => savePatch(income, { amount })}
                  className="w-28 shrink-0 text-emerald-600 dark:text-emerald-400"
                  aria-label={`Amount of ${income.name}`}
                />
                <Button
                  size="icon"
                  variant="ghost"
                  className="shrink-0 text-muted-foreground"
                  onClick={() => setEditing(income)}
                  aria-label={`Edit ${income.name}`}
                >
                  <Pencil className="size-4" />
                </Button>
              </li>
            );
          })}
        </ul>
      )}

      <Dialog open={adding} onOpenChange={setAdding}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add income</DialogTitle>
          </DialogHeader>
          <IncomeForm incomeTypes={formTypes()} onSaved={() => setAdding(false)} />
        </DialogContent>
      </Dialog>

      <Dialog open={editing !== null} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit income</DialogTitle>
          </DialogHeader>
          {editing && (
            <IncomeForm
              incomeTypes={formTypes(editing)}
              initial={editing}
              onSaved={() => setEditing(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
