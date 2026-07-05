"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { saveAllocationRow } from "@/lib/actions/settings";
import { envelopeHue } from "@/lib/envelope-colors";
import { formatIDR, formatPercent } from "@/lib/format";
import { deriveRowPercents, percentRowSum } from "@/lib/summary";
import type { AllocationMode, BudgetAllocation, BudgetType, IncomeType } from "@/lib/types";
import { AmountInput } from "@/components/amount-input";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface AllocationMatrixProps {
  incomeTypes: IncomeType[];
  budgetTypes: BudgetType[];
  allocations: BudgetAllocation[];
  /** Most recent actual income amount per income type id. */
  latestIncomeByType: Record<string, number>;
}

/**
 * The allocation matrix: rows = income types, columns = budget types. Each row
 * picks percent or amount entry mode; amounts are only a convenient way to
 * define percentages (derived % shown live).
 */
export function AllocationMatrix({
  incomeTypes,
  budgetTypes,
  allocations,
  latestIncomeByType,
}: AllocationMatrixProps) {
  if (incomeTypes.length === 0 || budgetTypes.length === 0) {
    return (
      <p className="text-[13px] text-muted-foreground">
        Add at least one income type and one budget type to configure allocations.
      </p>
    );
  }

  return (
    <div className="space-y-3">
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

/** Small segmented pill for the %/Rp entry-mode toggle. */
function CadencePill({ cadence }: { cadence: string }) {
  const monthly = cadence === "monthly";
  return (
    <span
      className={cn(
        "rounded-full px-2.5 py-0.5 text-[11px] font-semibold",
        monthly ? "bg-secondary text-foreground" : "border border-input text-muted-foreground"
      )}
    >
      {cadence}
    </span>
  );
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
    mode === "amount" ? budgetTypes.reduce((sum, bt) => sum + (values[bt.id] ?? 0), 0) : null;
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
        cells: budgetTypes.map((bt) => ({ budgetTypeId: bt.id, value: values[bt.id] ?? null })),
      });
      if (!result.ok) return toast.error(result.error);
      toast.success(`${incomeType.name} allocation saved`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-[14px] border border-border p-5">
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-[14px] font-bold">{incomeType.name}</span>
        <CadencePill cadence={incomeType.cadence} />
        <div className="ml-auto flex items-center gap-2.5">
          <div className="flex rounded-full bg-secondary p-0.5 text-[11.5px] font-semibold">
            <button
              type="button"
              onClick={() => switchMode("percent")}
              className={cn(
                "rounded-full px-3 py-1 transition-colors",
                mode === "percent"
                  ? "bg-card text-foreground shadow-[0_1px_2px_rgba(0,0,0,0.06)]"
                  : "text-muted-foreground"
              )}
            >
              %
            </button>
            <button
              type="button"
              onClick={() => switchMode("amount")}
              className={cn(
                "rounded-full px-3 py-1 transition-colors",
                mode === "amount"
                  ? "bg-card text-foreground shadow-[0_1px_2px_rgba(0,0,0,0.06)]"
                  : "text-muted-foreground"
              )}
            >
              Rp
            </button>
          </div>
          <Button type="button" size="sm" onClick={handleSave} disabled={busy}>
            {busy ? "Saving…" : "Save"}
          </Button>
        </div>
      </div>

      {showSumWarning && (
        <WarningNote className="mt-3">
          Percentages sum to {percentSum!.toLocaleString("id-ID")}%, not 100%. Saved anyway —
          allocations are applied as entered.
        </WarningNote>
      )}

      {showAmountWarning && (
        <WarningNote className="mt-3">
          ⚠ Amounts total {formatIDR(amountTotal!)}, but the last {incomeType.name} received was{" "}
          {formatIDR(latestIncome!)}. Only the derived % is applied — the allocation scales to the
          income actually received.
        </WarningNote>
      )}

      <div className="mt-3.5 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
        {budgetTypes.map((budgetType) => {
          const hue = envelopeHue(budgetType.name);
          return (
            <div key={budgetType.id} className="min-w-0">
              <div
                className="mb-1.5 flex items-center gap-1.5 text-[11.5px] font-semibold"
                style={{ color: hue.text }}
              >
                <span className="size-[7px] shrink-0 rounded-full" style={{ background: hue.fill }} />
                <span className="truncate">{budgetType.name}</span>
              </div>
              {mode === "percent" ? (
                <div className="relative">
                  <Input
                    type="number"
                    inputMode="decimal"
                    min={0}
                    max={100}
                    step="any"
                    className="pr-7 text-right font-semibold tabular-nums"
                    value={values[budgetType.id] ?? ""}
                    onChange={(e) =>
                      setValues((prev) => ({
                        ...prev,
                        [budgetType.id]: e.target.value === "" ? null : Number(e.target.value),
                      }))
                    }
                    aria-label={`${incomeType.name} → ${budgetType.name} percent`}
                  />
                  <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-[13px] text-muted-foreground">
                    %
                  </span>
                </div>
              ) : (
                <>
                  <AmountInput
                    value={values[budgetType.id] ?? null}
                    onChange={(v) => setValues((prev) => ({ ...prev, [budgetType.id]: v }))}
                    aria-label={`${incomeType.name} → ${budgetType.name} amount`}
                  />
                  <div className="mt-1 text-right text-[11px] tabular-nums text-muted-foreground">
                    {derivedPercents?.get(budgetType.id) !== undefined
                      ? `= ${formatPercent(derivedPercents.get(budgetType.id)!)}`
                      : "—"}
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>

      {mode === "percent" && percentSum !== null && (
        <div className="mt-2.5 text-right text-[12px] text-muted-foreground">
          Sum:{" "}
          <span className="ml-1 font-semibold tabular-nums text-foreground">
            {percentSum.toLocaleString("id-ID")}%
          </span>
        </div>
      )}
      {mode === "amount" && amountTotal !== null && (
        <div className="mt-2.5 text-right text-[12px] text-muted-foreground">
          Total:{" "}
          <span className="mx-1 font-semibold tabular-nums text-foreground">
            {formatIDR(amountTotal)}
          </span>
          {latestIncome !== undefined && (
            <>
              · last {incomeType.name} received:{" "}
              <span className="ml-1 font-semibold tabular-nums text-foreground">
                {formatIDR(latestIncome)}
              </span>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function WarningNote({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <p
      className={cn(
        "rounded-[10px] border border-warning px-3.5 py-2.5 text-[12px] text-warning-foreground",
        className
      )}
    >
      {children}
    </p>
  );
}
