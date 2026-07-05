"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Pencil, Plus, Search } from "lucide-react";
import { updateIncome } from "@/lib/actions/entries";
import { formatDate, monthLabel } from "@/lib/dates";
import type { IncomeRow, IncomeType } from "@/lib/types";
import { IncomeForm } from "@/components/income-form";
import { InlineAmount, InlineName } from "@/components/inline-edit";
import { SimpleSelect } from "@/components/simple-select";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

const ALL = "all";
const COLS = "1fr 160px 110px 150px 40px";

interface IncomeListProps {
  incomes: IncomeRow[];
  incomeTypes: IncomeType[];
  month: string; // "YYYY-MM" or "all"
  type: string; // income type id or "all"
  q: string;
}

function pillClass(active: boolean) {
  return cn(
    "h-9 rounded-full",
    active
      ? "border-transparent bg-secondary font-semibold text-foreground"
      : "text-muted-foreground"
  );
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

  const monthOptions = [
    { value: ALL, label: "All time" },
    ...monthChoices(month === ALL ? undefined : month).map((m) => ({ value: m, label: monthLabel(m) })),
  ];

  return (
    <div className="space-y-[18px]">
      <div className="flex flex-wrap items-center gap-2.5">
        <div className="relative min-w-[220px] flex-1 basis-full sm:basis-auto">
          <Search className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={searchDraft}
            onChange={(e) => setSearchDraft(e.target.value)}
            placeholder="Search income…"
            aria-label="Search income by name"
            className="h-9 w-full rounded-full bg-card pr-4 pl-10 text-[13px] shadow-[0_1px_2px_rgba(38,35,30,0.05)] outline-none placeholder:text-muted-foreground focus-visible:ring-3 focus-visible:ring-secondary"
          />
        </div>
        <SimpleSelect
          value={month}
          onChange={(v) => update({ month: v })}
          options={monthOptions}
          className={pillClass(month !== ALL)}
        />
        <SimpleSelect
          value={type}
          onChange={(v) => update({ type: v })}
          options={[
            { value: ALL, label: "Income type" },
            ...incomeTypes.map((t) => ({
              value: t.id,
              label: t.is_active ? t.name : `${t.name} (archived)`,
            })),
          ]}
          className={pillClass(type !== ALL)}
        />
        <Button size="sm" variant="secondary" className="ml-auto" onClick={() => setAdding(true)}>
          <Plus className="size-4" />
          Income
        </Button>
      </div>

      {incomes.length === 0 ? (
        <div className="rounded-[14px] border border-dashed border-input bg-card px-6 py-8 text-center">
          <div className="text-[13.5px] font-semibold">Nothing here yet</div>
          <div className="mt-1 text-[12.5px] text-muted-foreground">
            No income matches these filters.
          </div>
        </div>
      ) : (
        <div className="overflow-hidden rounded-[16px] bg-card shadow-[0_1px_2px_rgba(38,35,30,0.05)]">
          <div
            className="hidden items-center gap-3.5 border-b border-border px-6 py-3 text-[11px] font-semibold tracking-[0.1em] text-muted-foreground uppercase md:grid"
            style={{ gridTemplateColumns: COLS }}
          >
            <span>Name</span>
            <span>Type</span>
            <span>Date</span>
            <span className="text-right">Amount</span>
            <span />
          </div>

          {incomes.map((income, i) => {
            const incomeType = typeById.get(income.income_type_id);
            const last = i === incomes.length - 1;
            return (
              <div
                key={income.id}
                className="flex items-center gap-2 px-3 py-2.5 transition-colors hover:bg-row-hover md:grid md:gap-3.5 md:px-6 md:py-3"
                style={{
                  gridTemplateColumns: COLS,
                  borderBottom: last ? undefined : "1px solid var(--border)",
                }}
              >
                <div className="min-w-0 flex-1 md:flex-none">
                  <InlineName
                    key={`${income.id}:${income.name}`}
                    value={income.name}
                    onSave={(name) => savePatch(income, { name })}
                    aria-label={`Rename ${income.name}`}
                  />
                  {/* Mobile meta line */}
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-2 px-1 text-[12px] text-muted-foreground md:hidden">
                    <span>{formatDate(income.date)}</span>
                    {incomeType && (
                      <span>
                        · {incomeType.name} · {incomeType.cadence}
                      </span>
                    )}
                  </div>
                </div>
                <span className="hidden md:block">
                  {incomeType && (
                    <span className="inline-flex rounded-full bg-secondary px-2.5 py-1 text-[11.5px] font-semibold">
                      {incomeType.name} · {incomeType.cadence}
                    </span>
                  )}
                </span>
                <span className="hidden text-[12.5px] text-muted-foreground md:block">
                  {formatDate(income.date)}
                </span>
                <InlineAmount
                  key={`${income.id}:${income.amount}`}
                  value={income.amount}
                  onSave={(amount) => savePatch(income, { amount })}
                  currency
                  className="w-32 shrink-0 md:w-full md:text-right"
                  aria-label={`Amount of ${income.name}`}
                />
                <Button
                  size="icon-sm"
                  variant="ghost"
                  className="shrink-0 text-placeholder hover:text-foreground"
                  onClick={() => setEditing(income)}
                  aria-label={`Edit ${income.name}`}
                >
                  <Pencil className="size-4" />
                </Button>
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={adding} onOpenChange={setAdding}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle>Add income</DialogTitle>
          </DialogHeader>
          <IncomeForm incomeTypes={formTypes()} onSaved={() => setAdding(false)} />
        </DialogContent>
      </Dialog>

      <Dialog open={editing !== null} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-[440px]">
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

/** A window of selectable budget months around the current one (±12). */
function monthChoices(center: string | undefined): string[] {
  const ref = center ?? new Date().toISOString().slice(0, 7);
  const [y, m] = ref.split("-").map(Number);
  const base = y * 12 + (m - 1);
  const out: string[] = [];
  for (let d = 12; d >= -12; d--) {
    const total = base + d;
    const ny = Math.floor(total / 12);
    const nm = (total % 12) + 1;
    out.push(`${ny}-${String(nm).padStart(2, "0")}`);
  }
  return out;
}
