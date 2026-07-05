import { formatIDR, formatNumber } from "@/lib/format";
import { envelopeHue } from "@/lib/envelope-colors";
import type { BudgetPerformanceRow } from "@/lib/summary";

function barPct(row: BudgetPerformanceRow): number {
  // spent can go negative for investment envelopes (net sells) — clamp to 0.
  if (row.allocated > 0) return Math.max(0, Math.min(100, (row.spent / row.allocated) * 100));
  return row.spent > 0 ? 100 : 0;
}

interface EnvelopeProps {
  row: BudgetPerformanceRow;
  /** "deployed" for investment envelopes (net buys), default expense wording. */
  verb?: "deployed";
}

/**
 * Desktop envelope: a tinted card. Overspent → OVER badge + "Rp X over"
 * (amount stays ink, never a minus sign) and a full bar. No outline/border.
 */
export function EnvelopeCard({ row, verb }: EnvelopeProps) {
  const hue = envelopeHue(row.name);
  const over = row.remaining < 0;
  const pct = barPct(row);

  return (
    <div className="rounded-[16px] p-[18px]" style={{ background: hue.tint }}>
      <div className="flex items-center justify-between">
        <span className="text-[13px] font-semibold" style={{ color: hue.text }}>
          {row.name}
        </span>
        {over && (
          <span
            className="rounded-full px-[7px] py-0.5 text-[10px] font-bold tracking-[0.06em] text-white"
            style={{ background: hue.fill }}
          >
            OVER
          </span>
        )}
      </div>
      <div className="mt-2.5 text-[17px] font-bold tabular-nums">
        {formatIDR(Math.abs(row.remaining))}{" "}
        <span className="text-[11.5px] font-medium" style={{ color: hue.text }}>
          {over ? "over" : "left"}
        </span>
      </div>
      <div className="mt-3 h-[5px] rounded-[3px]" style={{ background: hue.track }}>
        <div
          className="h-full rounded-[3px]"
          style={{ width: `${pct}%`, background: hue.fill }}
        />
      </div>
      <div className="mt-2 text-[11px] tabular-nums" style={{ color: hue.text }}>
        {formatNumber(Math.max(row.spent, 0))} / {formatNumber(row.allocated)}
        {verb && ` ${verb}`}
      </div>
    </div>
  );
}

/** Mobile envelope: a full-width tinted row (name · bar · amount). */
export function EnvelopeRow({ row }: EnvelopeProps) {
  const hue = envelopeHue(row.name);
  const over = row.remaining < 0;
  const pct = barPct(row);

  return (
    <div
      className="grid grid-cols-[64px_1fr_auto] items-center gap-3 rounded-[14px] px-4 py-[13px]"
      style={{ background: hue.tint }}
    >
      <span className="text-[12.5px] font-semibold" style={{ color: hue.text }}>
        {row.name}
      </span>
      <div className="h-[5px] rounded-[3px]" style={{ background: hue.track }}>
        <div
          className="h-full rounded-[3px]"
          style={{ width: `${pct}%`, background: hue.fill }}
        />
      </div>
      <span
        className="text-[12px] font-bold tabular-nums"
        style={over ? { color: hue.text } : undefined}
      >
        {formatNumber(Math.abs(row.remaining))} {over ? "over" : "left"}
      </span>
    </div>
  );
}
