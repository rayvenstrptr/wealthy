import { assetClassHue } from "@/lib/asset-class-colors";
import { formatIDR, formatNumber } from "@/lib/format";
import type { ClassSummaryRow } from "@/lib/investments";

function barPct(row: ClassSummaryRow): number {
  if (row.budget > 0) return Math.max(0, Math.min(100, (row.deployed / row.budget) * 100));
  return row.deployed > 0 ? 100 : 0;
}

/**
 * Asset-class summary card (envelope visual language). Yearly view shows
 * budget vs deployed; all-time view drops the budget line (targets are
 * per-year, so an all-time budget doesn't exist).
 */
export function ClassCard({ row, showBudget }: { row: ClassSummaryRow; showBudget: boolean }) {
  const hue = assetClassHue(row.name);
  const over = showBudget && row.remaining < 0;
  const profit = row.realized > 0;
  const loss = row.realized < 0;

  return (
    <div className="rounded-[16px] p-[18px]" style={{ background: hue.tint }}>
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-[13px] font-semibold" style={{ color: hue.text }}>
          {row.name}
          {showBudget && (
            <span className="ml-1.5 font-medium opacity-70">{row.percent}%</span>
          )}
        </span>
        {over && (
          <span
            className="shrink-0 rounded-full px-[7px] py-0.5 text-[10px] font-bold tracking-[0.06em] text-white"
            style={{ background: hue.fill }}
          >
            OVER
          </span>
        )}
      </div>

      <div className="mt-2.5 text-[17px] font-bold tabular-nums">
        {formatIDR(row.holdingsCost)}{" "}
        <span className="text-[11.5px] font-medium" style={{ color: hue.text }}>
          held
        </span>
      </div>

      {showBudget && (
        <>
          <div className="mt-3 h-[5px] rounded-[3px]" style={{ background: hue.track }}>
            <div
              className="h-full rounded-[3px]"
              style={{ width: `${barPct(row)}%`, background: hue.fill }}
            />
          </div>
          <div className="mt-2 text-[11px] tabular-nums" style={{ color: hue.text }}>
            {formatNumber(Math.max(row.deployed, 0))} / {formatNumber(row.budget)} deployed
            {row.remaining >= 0 && ` · ${formatNumber(row.remaining)} left`}
          </div>
        </>
      )}

      {(profit || loss) && (
        <div
          className="mt-1.5 text-[11.5px] font-semibold tabular-nums"
          style={{ color: loss ? "oklch(0.52 0.16 25)" : "oklch(0.5 0.12 155)" }}
        >
          {profit ? "+" : "−"}
          {formatIDR(Math.abs(row.realized))} realized
        </div>
      )}
    </div>
  );
}
