"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, Copy } from "lucide-react";
import { saveClassTargets } from "@/lib/actions/investments";
import { assetClassHue } from "@/lib/asset-class-colors";
import { currentYearWIB } from "@/lib/dates";
import type { AssetClass, AssetClassTarget } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface ClassTargetsCardProps {
  assetClasses: AssetClass[];
  targets: AssetClassTarget[];
}

function draftsFor(
  assetClasses: AssetClass[],
  targets: AssetClassTarget[],
  year: string
): Record<string, string> {
  const drafts: Record<string, string> = {};
  for (const assetClass of assetClasses) {
    const target = targets.find((t) => t.asset_class_id === assetClass.id && t.year === year);
    drafts[assetClass.id] = target ? String(target.percent) : "";
  }
  return drafts;
}

/**
 * Per-budget-year target percents for the investment risk split. Changing a
 * year's targets applies to that whole year. Sum ≠ 100 warns, never blocks.
 */
export function ClassTargetsCard({ assetClasses, targets }: ClassTargetsCardProps) {
  const active = useMemo(
    () => assetClasses.filter((c) => c.is_active).sort((a, b) => a.sort - b.sort),
    [assetClasses]
  );

  const [year, setYear] = useState(currentYearWIB());
  const [drafts, setDrafts] = useState<Record<string, string>>(() =>
    draftsFor(active, targets, currentYearWIB())
  );
  const [busy, setBusy] = useState(false);

  function switchYear(next: string) {
    setYear(next);
    setDrafts(draftsFor(active, targets, next));
  }

  const prevYear = String(Number(year) - 1);
  const hasPrev = targets.some((t) => t.year === prevYear);

  function copyPrevious() {
    setDrafts(draftsFor(active, targets, prevYear));
    toast.info(`Copied ${prevYear} targets — save to apply to ${year}.`);
  }

  const sum = active.reduce((total, c) => total + (Number.parseFloat(drafts[c.id] ?? "") || 0), 0);
  const sumOff = Math.abs(sum - 100) > 0.01;

  async function handleSave() {
    setBusy(true);
    try {
      const result = await saveClassTargets(
        year,
        active.map((c) => ({
          assetClassId: c.id,
          percent: Number.parseFloat(drafts[c.id] ?? "") || 0,
        }))
      );
      if (!result.ok) return toast.error(result.error);
      toast.success(`Targets saved for ${year}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => switchYear(prevYear)}
            aria-label="Previous year"
            className="inline-flex size-7 items-center justify-center rounded-full bg-secondary text-foreground"
          >
            <ChevronLeft className="size-3.5" />
          </button>
          <span className="min-w-[48px] text-center text-[14px] font-bold tabular-nums">{year}</span>
          <button
            type="button"
            onClick={() => switchYear(String(Number(year) + 1))}
            aria-label="Next year"
            className="inline-flex size-7 items-center justify-center rounded-full bg-secondary text-foreground"
          >
            <ChevronRight className="size-3.5" />
          </button>
        </div>
        {hasPrev && (
          <Button size="sm" variant="ghost" onClick={copyPrevious} className="text-muted-foreground">
            <Copy className="size-3.5" />
            Copy {prevYear}
          </Button>
        )}
      </div>

      <div className="mt-3 space-y-1.5">
        {active.map((assetClass) => {
          const hue = assetClassHue(assetClass.name);
          return (
            <div key={assetClass.id} className="grid grid-cols-[1fr_110px] items-center gap-2">
              <span className="flex items-center gap-1.5 text-[12.5px] font-medium">
                <span className="size-2 rounded-full" style={{ background: hue.fill }} aria-hidden />
                {assetClass.name}
              </span>
              <div className="relative">
                <Input
                  aria-label={`${assetClass.name} target percent`}
                  type="text"
                  inputMode="decimal"
                  autoComplete="off"
                  className="h-9 pr-8 text-right font-semibold tabular-nums"
                  placeholder="0"
                  value={drafts[assetClass.id] ?? ""}
                  onChange={(e) =>
                    setDrafts({ ...drafts, [assetClass.id]: e.target.value.replace(",", ".") })
                  }
                />
                <span className="pointer-events-none absolute inset-y-0 right-3.5 flex items-center text-[13px] text-muted-foreground">
                  %
                </span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-3 flex items-center justify-between gap-2">
        {sumOff ? (
          <Badge variant="warning">⚠ Targets sum to {Math.round(sum * 100) / 100}%</Badge>
        ) : (
          <span className="text-[12px] text-muted-foreground">✓ 100%</span>
        )}
        <Button size="sm" onClick={handleSave} disabled={busy}>
          {busy ? "Saving…" : `Save ${year}`}
        </Button>
      </div>
    </div>
  );
}
