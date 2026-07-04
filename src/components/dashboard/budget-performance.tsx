import { formatIDR } from "@/lib/format";
import type { BudgetPerformanceRow } from "@/lib/summary";
import { cn } from "@/lib/utils";

/** One bar per budget type: allocated / spent / remaining, red when overspent. */
export function BudgetPerformance({ rows }: { rows: BudgetPerformanceRow[] }) {
  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">No budget types configured.</p>;
  }

  return (
    <div className="space-y-4">
      {rows.map((row) => {
        const over = row.remaining < 0;
        const pct =
          row.allocated > 0
            ? Math.min(100, (row.spent / row.allocated) * 100)
            : row.spent > 0
              ? 100
              : 0;
        return (
          <div key={row.budget_type_id}>
            <div className="mb-1 flex items-baseline justify-between gap-2">
              <span className="text-sm font-medium">{row.name}</span>
              <span
                className={cn(
                  "text-xs tabular-nums",
                  over ? "font-medium text-destructive" : "text-muted-foreground"
                )}
              >
                {over
                  ? `${formatIDR(-row.remaining)} over`
                  : `${formatIDR(row.remaining)} left`}
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div
                className={cn("h-full rounded-full", over ? "bg-destructive" : "bg-primary")}
                style={{ width: `${pct}%` }}
              />
            </div>
            <div className="mt-1 text-xs tabular-nums text-muted-foreground">
              {formatIDR(row.spent)} spent of {formatIDR(row.allocated)} allocated
            </div>
          </div>
        );
      })}
    </div>
  );
}
