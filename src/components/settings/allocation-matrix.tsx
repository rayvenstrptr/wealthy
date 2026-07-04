"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { saveAllocationRow } from "@/lib/actions/settings";
import { formatIDR, formatPercent } from "@/lib/format";
import { deriveRowPercents, percentRowSum } from "@/lib/summary";
import type { AllocationMode, BudgetAllocation, BudgetType, IncomeType } from "@/lib/types";
import { AmountInput } from "@/components/amount-input";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface AllocationMatrixProps {
  incomeTypes: IncomeType[];
  budgetTypes: BudgetType[];
  allocations: BudgetAllocation[];
  /** Most recent actual income amount per income type id. */
  latestIncomeByType: Record<string, number>;
}

/**
 * The allocation matrix: rows = income types, columns = budget types.
 * Each row picks percent or amount entry mode; amounts are only a convenient
 * way to define percentages (derived % shown live).
 */
export function AllocationMatrix({
  incomeTypes,
  budgetTypes,
  allocations,
  latestIncomeByType,
}: AllocationMatrixProps) {
  if (incomeTypes.length === 0 || budgetTypes.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Add at least one income type and one budget type to configure allocations.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      {incomeTypes.map((incomeType) => (
        <MatrixRow
          key={incomeType.id}
          incomeType={incomeType}
          budgetTypes={budgetTypes}
          cells={allocations.filter((a) => a.income_type_id === incomeType.id)}
          latestIncome={latestIncomeByType[incomeType.id]}
        />
      ))}
    </div>
  );
}

function initValues(
  mode: AllocationMode,
  cells: BudgetAllocation[]
): Record<string, number | null> {
  const values: Record<string, number | null> = {};
  for (const cell of cells) {
    values[cell.budget_type_id] = mode === "percent" ? cell.percent : cell.amount;
  }
  return values;
}

function MatrixRow({
  incomeType,
  budgetTypes,
  cells,
  latestIncome,
}: {
  incomeType: IncomeType;
  budgetTypes: BudgetType[];
  cells: BudgetAllocation[];
  latestIncome: number | undefined;
}) {
  const [mode, setMode] = useState<AllocationMode>(incomeType.allocation_mode);
  const [values, setValues] = useState<Record<string, number | null>>(() =>
    initValues(incomeType.allocation_mode, cells)
  );
  const [busy, setBusy] = useState(false);

  function switchMode(next: AllocationMode) {
    if (next === mode) return;
    setMode(next);
    setValues(initValues(next, cells));
  }

  const derivedPercents = useMemo(() => {
    if (mode !== "amount") return null;
    return deriveRowPercents(
      "amount",
      budgetTypes.map((bt) => ({
        income_type_id: incomeType.id,
        budget_type_id: bt.id,
        percent: null,
        amount: values[bt.id] ?? null,
      }))
    );
  }, [mode, values, budgetTypes, incomeType.id]);

  const percentSum = useMemo(() => {
    if (mode !== "percent") return null;
    return percentRowSum(
      budgetTypes.map((bt) => ({
        income_type_id: incomeType.id,
        budget_type_id: bt.id,
        percent: values[bt.id] ?? null,
        amount: null,
      }))
    );
  }, [mode, values, budgetTypes, incomeType.id]);

  const showSumWarning =
    mode === "percent" && percentSum !== null && Math.abs(percentSum - 100) > 0.01;

  const amountTotal =
    mode === "amount"
      ? budgetTypes.reduce((sum, bt) => sum + (values[bt.id] ?? 0), 0)
      : null;
  const showAmountWarning =
    mode === "amount" &&
    amountTotal !== null &&
    amountTotal > 0 &&
    latestIncome !== undefined &&
    amountTotal !== latestIncome;

  async function handleSave() {
    setBusy(true);
    try {
      const result = await saveAllocationRow({
        incomeTypeId: incomeType.id,
        mode,
        cells: budgetTypes.map((bt) => ({
          budgetTypeId: bt.id,
          value: values[bt.id] ?? null,
        })),
      });
      if (!result.ok) return toast.error(result.error);
      toast.success(`${incomeType.name} allocation saved`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-lg border p-3">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="font-medium">{incomeType.name}</span>
          <span className="text-xs text-muted-foreground">
            {incomeType.cadence === "monthly" ? "monthly" : "yearly"}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-md border p-0.5">
            <Button
              type="button"
              size="sm"
              variant={mode === "percent" ? "secondary" : "ghost"}
              className="h-6 px-2 text-xs"
              onClick={() => switchMode("percent")}
            >
              %
            </Button>
            <Button
              type="button"
              size="sm"
              variant={mode === "amount" ? "secondary" : "ghost"}
              className="h-6 px-2 text-xs"
              onClick={() => switchMode("amount")}
            >
              Rp
            </Button>
          </div>
          <Button type="button" size="sm" onClick={handleSave} disabled={busy}>
            {busy ? "Saving…" : "Save"}
          </Button>
        </div>
      </div>

      {showSumWarning && (
        <p className="mb-2 rounded-md bg-amber-100 px-2.5 py-1.5 text-xs text-amber-900 dark:bg-amber-950 dark:text-amber-200">
          Percentages sum to {percentSum!.toLocaleString("id-ID")}%, not 100%. Saved anyway —
          allocations are applied as entered.
        </p>
      )}

      {mode === "amount" && amountTotal !== null && (
        <p className="mb-2 text-xs text-muted-foreground">
          Row total: <span className="font-medium tabular-nums">{formatIDR(amountTotal)}</span>
          {latestIncome !== undefined && (
            <>
              {" "}
              · last {incomeType.name} received:{" "}
              <span className="font-medium tabular-nums">{formatIDR(latestIncome)}</span>
            </>
          )}
        </p>
      )}

      {showAmountWarning && (
        <p className="mb-2 rounded-md bg-amber-100 px-2.5 py-1.5 text-xs text-amber-900 dark:bg-amber-950 dark:text-amber-200">
          Amounts total {formatIDR(amountTotal!)}, but the last {incomeType.name} received was{" "}
          {formatIDR(latestIncome!)}. Only the derived % is applied — the allocation scales to the
          income actually received.
        </p>
      )}

      <div className="overflow-x-auto">
        <div className="flex min-w-max gap-2">
          {budgetTypes.map((budgetType) => (
            <div key={budgetType.id} className="w-28 shrink-0 space-y-1">
              <div className="truncate text-xs font-medium text-muted-foreground">
                {budgetType.name}
              </div>
              {mode === "percent" ? (
                <div className="relative">
                  <Input
                    type="number"
                    inputMode="decimal"
                    min={0}
                    max={100}
                    step="any"
                    className="pr-6 tabular-nums"
                    value={values[budgetType.id] ?? ""}
                    onChange={(e) =>
                      setValues((prev) => ({
                        ...prev,
                        [budgetType.id]:
                          e.target.value === "" ? null : Number(e.target.value),
                      }))
                    }
                    aria-label={`${incomeType.name} → ${budgetType.name} percent`}
                  />
                  <span className="pointer-events-none absolute inset-y-0 right-2 flex items-center text-xs text-muted-foreground">
                    %
                  </span>
                </div>
              ) : (
                <>
                  <AmountInput
                    value={values[budgetType.id] ?? null}
                    onChange={(v) =>
                      setValues((prev) => ({ ...prev, [budgetType.id]: v }))
                    }
                    className="pl-8 text-sm"
                    aria-label={`${incomeType.name} → ${budgetType.name} amount`}
                  />
                  <div className="text-right text-xs tabular-nums text-muted-foreground">
                    {derivedPercents?.get(budgetType.id) !== undefined
                      ? `= ${formatPercent(derivedPercents.get(budgetType.id)!)}`
                      : "—"}
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
