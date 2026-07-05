// Investment math. Pure functions, no I/O — unit tested in investments.test.ts.
//
// Performance is REALIZED-ONLY (no market valuations in v2); holdings are
// shown at cost. Sells use AVERAGE COST basis.
//
// Conventions (decided with Ray):
// - Transactions are processed chronologically per item (date, then created_at).
// - Sell WITH quantity: basis = quantity × average cost per unit.
//   Overselling (quantity > held units, or any quantity-sell on an empty
//   position) is clamped here and flagged via warnings — the server action
//   rejects it before it can be stored.
// - Sell WITHOUT quantity closes the ENTIRE outstanding cost of the item
//   (deposito matures, whole TCG lot flips): realized += amount − cost.
// - Mixed items behave per-transaction; a no-quantity sell still closes all.
// - Realized % is cumulative across round trips: Σ realized ÷ Σ basis sold.
// - Deployed budget per class = buys − sell proceeds (sells replenish the
//   year's class budget).
// - Net worth = holdings at cost + undeployed budget (floored at 0).

export interface InvestmentTxInput {
  id: string;
  item_id: string;
  side: "buy" | "sell";
  amount: number;
  quantity: number | null;
  date: string;
  created_at?: string;
}

export interface ItemPosition {
  item_id: string;
  /** Held units; null when the position has no quantity-tracked lots. */
  units: number | null;
  /** Outstanding invested cost — holdings at cost. */
  costBasis: number;
  /** Cumulative realized P&L (all-time for the given transactions). */
  realized: number;
  /** Σ basis of sold portions — denominator for realizedPct. */
  basisSold: number;
  /** realized ÷ basisSold; null when nothing has been sold. */
  realizedPct: number | null;
  /** Data problems encountered (oversell clamped, sell on empty position). */
  warnings: string[];
}

/** A dated realization, so callers can window realized P&L by budget year. */
export interface RealizedEvent {
  item_id: string;
  date: string;
  realized: number;
  basisSold: number;
}

function chronological(a: InvestmentTxInput, b: InvestmentTxInput): number {
  if (a.date !== b.date) return a.date < b.date ? -1 : 1;
  const ca = a.created_at ?? "";
  const cb = b.created_at ?? "";
  if (ca !== cb) return ca < cb ? -1 : 1;
  return 0;
}

/**
 * Fold transactions into per-item positions (average cost) plus a dated list
 * of realization events for windowed realized-P&L reporting.
 */
export function computeItemPositions(txs: InvestmentTxInput[]): {
  positions: Map<string, ItemPosition>;
  realizedEvents: RealizedEvent[];
} {
  const positions = new Map<string, ItemPosition>();
  const realizedEvents: RealizedEvent[] = [];

  const ordered = [...txs].sort(chronological);
  for (const tx of ordered) {
    let pos = positions.get(tx.item_id);
    if (!pos) {
      pos = {
        item_id: tx.item_id,
        units: null,
        costBasis: 0,
        realized: 0,
        basisSold: 0,
        realizedPct: null,
        warnings: [],
      };
      positions.set(tx.item_id, pos);
    }

    if (tx.side === "buy") {
      pos.costBasis += tx.amount;
      if (tx.quantity != null) pos.units = (pos.units ?? 0) + tx.quantity;
      continue;
    }

    // Sell.
    let basis: number;
    if (tx.quantity != null) {
      const held = pos.units ?? 0;
      if (held <= 0 || pos.costBasis <= 0) {
        pos.warnings.push(`sell of ${tx.quantity} on empty position ignored (${tx.date})`);
        continue;
      }
      const qty = Math.min(tx.quantity, held);
      if (qty < tx.quantity) {
        pos.warnings.push(`oversell clamped from ${tx.quantity} to ${qty} (${tx.date})`);
      }
      basis = Math.round((qty / held) * pos.costBasis);
      pos.units = held - qty;
      // Full exit: clear rounding dust so the position closes clean.
      if (pos.units <= 0) {
        pos.units = 0;
        basis = pos.costBasis;
      }
    } else {
      // No quantity: the sell closes the entire outstanding position.
      basis = pos.costBasis;
      pos.units = pos.units == null ? null : 0;
    }

    pos.costBasis -= basis;
    pos.realized += tx.amount - basis;
    pos.basisSold += basis;
    realizedEvents.push({
      item_id: tx.item_id,
      date: tx.date,
      realized: tx.amount - basis,
      basisSold: basis,
    });
  }

  for (const pos of positions.values()) {
    pos.realizedPct = pos.basisSold > 0 ? pos.realized / pos.basisSold : null;
  }

  return { positions, realizedEvents };
}

/**
 * Server-side sell validation (oversell is a HARD error, unlike budget
 * overruns which only warn). Checks the candidate sell against the position
 * built from the item's transactions up to and including the sell date,
 * excluding the transaction being edited (if any). Returns an error message
 * or null when the sell is fine.
 */
export function validateSell(
  txs: InvestmentTxInput[],
  candidate: { item_id: string; quantity: number | null; date: string },
  excludeTxId?: string
): string | null {
  const prior = txs.filter(
    (tx) => tx.item_id === candidate.item_id && tx.id !== excludeTxId && tx.date <= candidate.date
  );
  const { positions } = computeItemPositions(prior);
  const pos = positions.get(candidate.item_id);

  if (!pos || pos.costBasis <= 0) {
    return "Nothing held for this item on that date — record the buy first.";
  }
  if (candidate.quantity != null) {
    const held = pos.units ?? 0;
    if (held <= 0) {
      return "This position has no quantity-tracked units — leave quantity empty to close it.";
    }
    if (candidate.quantity > held) {
      return `You only hold ${held} units of this item on that date.`;
    }
  }
  return null;
}

function inRange(date: string, range?: { start: string; end: string }): boolean {
  return !range || (date >= range.start && date <= range.end);
}

/**
 * Net deployed IDR per asset class (buys − sell proceeds) within an optional
 * date window. Sells replenish the budget, so a class can go net-negative in
 * a window (sold more than bought).
 */
export function computeDeployed(
  txs: InvestmentTxInput[],
  items: { id: string; asset_class_id: string }[],
  range?: { start: string; end: string }
): Map<string, number> {
  const classByItem = new Map(items.map((i) => [i.id, i.asset_class_id]));
  const deployed = new Map<string, number>();
  for (const tx of txs) {
    if (!inRange(tx.date, range)) continue;
    const classId = classByItem.get(tx.item_id);
    if (!classId) continue;
    const delta = tx.side === "buy" ? tx.amount : -tx.amount;
    deployed.set(classId, (deployed.get(classId) ?? 0) + delta);
  }
  return deployed;
}

export interface ClassSummaryRow {
  asset_class_id: string;
  name: string;
  /** Target percent for the selected year (0 when none configured). */
  percent: number;
  /** investBudget × percent ÷ 100, rounded. */
  budget: number;
  /** Net buys − sells within the window. */
  deployed: number;
  /** budget − deployed (can exceed budget when sells replenished it). */
  remaining: number;
  /** Current holdings at cost (always all-time state). */
  holdingsCost: number;
  /** Realized P&L within the window. */
  realized: number;
}

export interface InvestmentSummary {
  classes: ClassSummaryRow[];
  totals: {
    holdingsCost: number;
    realized: number;
    budget: number;
    deployed: number;
    /** holdingsCost + max(budget − deployed, 0). */
    netWorth: number;
  };
}

/**
 * Full investments summary. Positions/holdings are always the current
 * all-time state; realized P&L and deployed are windowed when `window` is
 * given (yearly view). `investBudget` = income allocated to investment-kind
 * envelopes in the selected year.
 */
export function computeInvestmentSummary(params: {
  assetClasses: { id: string; name: string; is_active: boolean; sort: number }[];
  targets: { asset_class_id: string; percent: number }[];
  items: { id: string; asset_class_id: string }[];
  transactions: InvestmentTxInput[];
  investBudget: number;
  window?: { start: string; end: string };
}): InvestmentSummary {
  const { assetClasses, targets, items, transactions, investBudget, window } = params;

  const { positions, realizedEvents } = computeItemPositions(transactions);
  const deployed = computeDeployed(transactions, items, window);
  const percentByClass = new Map(targets.map((t) => [t.asset_class_id, t.percent]));
  const classByItem = new Map(items.map((i) => [i.id, i.asset_class_id]));

  const holdingsByClass = new Map<string, number>();
  for (const pos of positions.values()) {
    const classId = classByItem.get(pos.item_id);
    if (!classId) continue;
    holdingsByClass.set(classId, (holdingsByClass.get(classId) ?? 0) + pos.costBasis);
  }

  const realizedByClass = new Map<string, number>();
  for (const event of realizedEvents) {
    if (!inRange(event.date, window)) continue;
    const classId = classByItem.get(event.item_id);
    if (!classId) continue;
    realizedByClass.set(classId, (realizedByClass.get(classId) ?? 0) + event.realized);
  }

  const visible = assetClasses
    .filter((c) => c.is_active)
    .sort((a, b) => a.sort - b.sort);

  const classes: ClassSummaryRow[] = visible.map((assetClass) => {
    const percent = percentByClass.get(assetClass.id) ?? 0;
    const budget = Math.round((investBudget * percent) / 100);
    const classDeployed = deployed.get(assetClass.id) ?? 0;
    return {
      asset_class_id: assetClass.id,
      name: assetClass.name,
      percent,
      budget,
      deployed: classDeployed,
      remaining: budget - classDeployed,
      holdingsCost: holdingsByClass.get(assetClass.id) ?? 0,
      realized: realizedByClass.get(assetClass.id) ?? 0,
    };
  });

  // Totals include archived classes' holdings/realized so nothing vanishes
  // from the headline numbers when a class is archived.
  let totalHoldings = 0;
  for (const cost of holdingsByClass.values()) totalHoldings += cost;
  let totalRealized = 0;
  for (const event of realizedEvents) {
    if (inRange(event.date, window)) totalRealized += event.realized;
  }
  let totalDeployed = 0;
  for (const value of deployed.values()) totalDeployed += value;
  const totalBudget = classes.reduce((sum, c) => sum + c.budget, 0);

  return {
    classes,
    totals: {
      holdingsCost: totalHoldings,
      realized: totalRealized,
      budget: totalBudget,
      deployed: totalDeployed,
      netWorth: totalHoldings + Math.max(totalBudget - totalDeployed, 0),
    },
  };
}
