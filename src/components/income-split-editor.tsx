"use client";

import { useState } from "react";
import { splitFromPercents, splitRemaining, type SplitCell } from "@/lib/allocation-split";
import { envelopeHue } from "@/lib/envelope-colors";
import { formatIDR } from "@/lib/format";
import type { BudgetType } from "@/lib/types";
import { AmountInput } from "@/components/amount-input";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface IncomeSplitEditorProps {
  /** Envelopes to split across (active + any archived ones the split references). */
  budgetTypes: BudgetType[];
  /** The income amount the split must add up to (null while not yet entered). */
  total: number | null;
  /** One cell per budget type, aligned with `budgetTypes`. */
  value: SplitCell[];
  onChange: (cells: SplitCell[]) => void;
}

/**
 * Per-income envelope split. Rp mode is the stored truth; % mode is a faster
 * way to type amounts (converted via splitFromPercents). The "remaining" line
 * stays amber until the split sums exactly to the income amount — the form
 * blocks submit until it does.
 */
export function IncomeSplitEditor({ budgetTypes, total, value, onChange }: IncomeSplitEditorProps) {
  const [mode, setMode] = useState<"amount" | "percent">("amount");
  // % drafts are strings so decimals can be typed freely ("12.5").
  const [percentDraft, setPercentDraft] = useState<Record<string, string>>({});

  const amountById = new Map(value.map((c) => [c.budget_type_id, c.amount]));
  const remaining = total != null && total > 0 ? splitRemaining(total, value) : null;

  function setAmount(budgetTypeId: string, amount: number | null) {
    onChange(
      budgetTypes.map((b) => ({
        budget_type_id: b.id,
        amount: b.id === budgetTypeId ? (amount ?? 0) : (amountById.get(b.id) ?? 0),
      }))
    );
  }

  function switchMode(next: "amount" | "percent") {
    if (next === "percent") {
      // Seed % drafts from the current amounts.
      const drafts: Record<string, string> = {};
      for (const b of budgetTypes) {
        const amount = amountById.get(b.id) ?? 0;
        drafts[b.id] =
          total != null && total > 0 && amount > 0
            ? String(Math.round((amount / total) * 1000) / 10)
            : "";
      }
      setPercentDraft(drafts);
    }
    setMode(next);
  }

  function setPercent(budgetTypeId: string, draft: string) {
    const drafts = { ...percentDraft, [budgetTypeId]: draft };
    setPercentDraft(drafts);
    if (total == null || total <= 0) return;
    onChange(
      splitFromPercents(
        budgetTypes.map((b) => ({
          budget_type_id: b.id,
          percent: Number.parseFloat(drafts[b.id] ?? "") || 0,
        })),
        total
      )
    );
  }

  return (
    <div className="space-y-2 rounded-[14px] bg-secondary/50 p-3">
      <div className="flex items-center justify-between">
        <span className="text-[12px] font-semibold tracking-[0.06em] text-muted-foreground uppercase">
          Split across envelopes
        </span>
        <div className="flex rounded-full bg-card p-0.5 shadow-[0_1px_2px_rgba(38,35,30,0.05)]">
          {(["amount", "percent"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => switchMode(m)}
              className={cn(
                "rounded-full px-2.5 py-1 text-[11.5px] font-semibold transition-colors",
                mode === m ? "bg-secondary text-foreground" : "text-muted-foreground"
              )}
            >
              {m === "amount" ? "Rp" : "%"}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-1.5">
        {budgetTypes.map((budgetType) => {
          const hue = envelopeHue(budgetType.name);
          const amount = amountById.get(budgetType.id) ?? 0;
          const derivedPct =
            total != null && total > 0 && amount > 0
              ? Math.round((amount / total) * 1000) / 10
              : null;
          return (
            <div key={budgetType.id} className="grid grid-cols-[92px_1fr_44px] items-center gap-2">
              <span className="flex min-w-0 items-center gap-1.5 text-[12.5px] font-medium">
                <span
                  className="size-2 shrink-0 rounded-full"
                  style={{ background: hue.fill }}
                  aria-hidden
                />
                <span className="truncate">
                  {budgetType.name}
                  {!budgetType.is_active && " (archived)"}
                </span>
              </span>
              {mode === "amount" ? (
                <AmountInput
                  aria-label={`${budgetType.name} amount`}
                  value={amount || null}
                  onChange={(v) => setAmount(budgetType.id, v)}
                  className="h-9"
                  placeholder="0"
                />
              ) : (
                <div className="relative">
                  <Input
                    aria-label={`${budgetType.name} percent`}
                    type="text"
                    inputMode="decimal"
                    autoComplete="off"
                    className="h-9 pr-8 font-semibold tabular-nums"
                    placeholder="0"
                    value={percentDraft[budgetType.id] ?? ""}
                    onChange={(e) => setPercent(budgetType.id, e.target.value.replace(",", "."))}
                  />
                  <span className="pointer-events-none absolute inset-y-0 right-3.5 flex items-center text-[13px] text-muted-foreground">
                    %
                  </span>
                </div>
              )}
              <span className="text-right text-[11.5px] text-muted-foreground tabular-nums">
                {mode === "amount"
                  ? derivedPct != null
                    ? `${derivedPct}%`
                    : ""
                  : amount > 0
                    ? formatIDR(amount).replace("Rp ", "")
                    : ""}
              </span>
            </div>
          );
        })}
      </div>

      {total == null || total <= 0 ? (
        <p className="text-[12px] text-muted-foreground">Enter the amount to allocate it.</p>
      ) : remaining === 0 ? (
        <p className="text-[12px] font-medium text-muted-foreground">✓ Fully allocated</p>
      ) : (
        <p className="text-[12px] font-semibold text-amber-600">
          {remaining! > 0
            ? `Remaining to allocate: ${formatIDR(remaining!)}`
            : `Over-allocated by ${formatIDR(-remaining!)}`}
        </p>
      )}
    </div>
  );
}
