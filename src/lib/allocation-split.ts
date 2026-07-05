// Split-editor math for per-income envelope splits. Pure, unit-tested.
//
// Invariant everything here protects: a produced split ALWAYS sums exactly to
// the requested total (the app's one hard validation). Rounding remainders
// land on the largest cell so totals match to the rupiah.

export interface SplitCell {
  budget_type_id: string;
  amount: number;
}

/** Index of the largest cell (first wins ties); -1 when empty. */
function largestCellIndex(cells: SplitCell[]): number {
  let index = -1;
  let max = -Infinity;
  cells.forEach((cell, i) => {
    if (cell.amount > max) {
      max = cell.amount;
      index = i;
    }
  });
  return index;
}

/**
 * Scale a template split proportionally to `newTotal`. Each cell keeps its
 * share of the template total (rounded); the rounding remainder is assigned
 * to the largest cell so Σ === newTotal exactly.
 *
 * Empty/zero template or non-positive total → empty split.
 */
export function scaleSplit(template: SplitCell[], newTotal: number): SplitCell[] {
  const templateTotal = template.reduce((sum, c) => sum + c.amount, 0);
  if (templateTotal <= 0 || newTotal <= 0) return [];

  const scaled = template.map((cell) => ({
    budget_type_id: cell.budget_type_id,
    amount: Math.round((cell.amount / templateTotal) * newTotal),
  }));

  const remainder = newTotal - scaled.reduce((sum, c) => sum + c.amount, 0);
  if (remainder !== 0) {
    const target = largestCellIndex(scaled);
    if (target >= 0) scaled[target].amount += remainder;
  }
  return scaled;
}

/**
 * Percent-entry convenience: turn per-envelope percents into amounts of
 * `total` — percents are only a way to type amounts faster.
 *
 * When the percents sum to 100 (±0.005), the rounding remainder lands on the
 * largest cell so Σ === total exactly. When they don't (user mid-typing),
 * amounts are plain rounded shares and the gap shows up in splitRemaining —
 * never silently dumped onto a cell.
 */
export function splitFromPercents(
  cells: { budget_type_id: string; percent: number }[],
  total: number
): SplitCell[] {
  if (total <= 0) return cells.map((c) => ({ budget_type_id: c.budget_type_id, amount: 0 }));

  const amounts = cells.map((cell) => ({
    budget_type_id: cell.budget_type_id,
    amount: Math.round((cell.percent / 100) * total),
  }));

  const percentSum = cells.reduce((sum, c) => sum + c.percent, 0);
  if (Math.abs(percentSum - 100) < 0.005) {
    const remainder = total - amounts.reduce((sum, c) => sum + c.amount, 0);
    if (remainder !== 0) {
      const target = largestCellIndex(amounts);
      if (target >= 0) amounts[target].amount += remainder;
    }
  }
  return amounts;
}

/** How much of `total` is still unallocated (0 ⇒ valid to save). */
export function splitRemaining(total: number, cells: SplitCell[]): number {
  return total - cells.reduce((sum, c) => sum + c.amount, 0);
}
