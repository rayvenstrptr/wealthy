import { currentYearWIB, formatDate, yearRange } from "@/lib/dates";
import {
  getConfig,
  getIncomeAllocations,
  getIncomes,
  getInvestmentConfig,
  getInvestmentTransactions,
  getInvestmentYields,
  getLatestSplitByIncomeType,
} from "@/lib/data";
import { formatIDR } from "@/lib/format";
import {
  computeInvestmentSummary,
  computeItemPositions,
  type InvestmentSummary,
} from "@/lib/investments";
import type { AssetClassTarget, BudgetType, IncomeAllocation, IncomeRow } from "@/lib/types";
import { ClassCard } from "@/components/investments/class-card";
import { ItemSection, type ClassGroup } from "@/components/investments/item-section";
import {
  InvestmentsPeriodPicker,
  type InvestmentsView,
} from "@/components/investments/period-picker";
import { TradeLog, type TradeLogRow } from "@/components/investments/trade-log";
import { TransactionDialog } from "@/components/investments/transaction-dialog";
import { YieldDialog } from "@/components/investments/yield-dialog";
import { Badge } from "@/components/ui/badge";

interface SearchParams {
  view?: string;
  year?: string;
}

/** Income allocated to investment-kind envelopes = the investment budget. */
function investBudgetOf(
  incomes: IncomeRow[],
  allocations: IncomeAllocation[],
  budgetTypes: BudgetType[]
): number {
  const investTypeIds = new Set(budgetTypes.filter((b) => b.kind === "investment").map((b) => b.id));
  const incomeIds = new Set(incomes.map((i) => i.id));
  return allocations
    .filter((a) => incomeIds.has(a.income_id) && investTypeIds.has(a.budget_type_id))
    .reduce((sum, a) => sum + a.amount, 0);
}

function targetsFor(targets: AssetClassTarget[], year: string) {
  return targets.filter((t) => t.year === year);
}

export default async function InvestmentsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const view: InvestmentsView = params.view === "alltime" ? "alltime" : "yearly";
  const currentYear = currentYearWIB();
  const year = view === "yearly" ? (params.year ?? currentYear) : currentYear;
  const range = yearRange(year);
  const currentRange = yearRange(currentYear);

  const [config, investmentConfig, transactions, yields, latestSplitByType, yearIncomes] =
    await Promise.all([
      getConfig(),
      getInvestmentConfig(),
      getInvestmentTransactions(),
      getInvestmentYields(),
      getLatestSplitByIncomeType(),
      getIncomes({ start: range.start, end: range.end }),
    ]);
  const yearAllocations = await getIncomeAllocations(yearIncomes.map((i) => i.id));
  const investBudget = investBudgetOf(yearIncomes, yearAllocations, config.budgetTypes);

  // All-time capital = every Rp ever allocated to investment-kind envelopes.
  // The budget accumulates: unspent capital stays investable across years.
  let capitalBase: number | undefined;
  if (view === "alltime") {
    const allIncomes = await getIncomes({});
    const allAllocations = await getIncomeAllocations(allIncomes.map((i) => i.id));
    capitalBase = investBudgetOf(allIncomes, allAllocations, config.budgetTypes);
  }

  // Selected-view summary drives the cards (realized/deployed are windowed;
  // holdings are always current all-time state). Yields fold into realized.
  const summary: InvestmentSummary = computeInvestmentSummary({
    assetClasses: investmentConfig.assetClasses,
    targets: targetsFor(investmentConfig.targets, year),
    items: investmentConfig.items,
    transactions,
    yields,
    investBudget,
    capitalBase,
    window: view === "yearly" ? range : undefined,
  });

  // Budget state of the CURRENT budget year — powers the transaction form's
  // remaining-budget warning and the yearly net-worth headline.
  let budgetSummary = summary;
  if (view === "alltime" || year !== currentYear) {
    const currentIncomes = await getIncomes({ start: currentRange.start, end: currentRange.end });
    const currentAllocations = await getIncomeAllocations(currentIncomes.map((i) => i.id));
    budgetSummary = computeInvestmentSummary({
      assetClasses: investmentConfig.assetClasses,
      targets: targetsFor(investmentConfig.targets, currentYear),
      items: investmentConfig.items,
      transactions,
      yields,
      investBudget: investBudgetOf(currentIncomes, currentAllocations, config.budgetTypes),
      window: currentRange,
    });
  }
  const remainingByClass = Object.fromEntries(
    budgetSummary.classes.map((c) => [c.asset_class_id, c.remaining])
  );

  const inWindow = (date: string) =>
    view === "alltime" || (date >= range.start && date <= range.end);

  // Per-item holdings + windowed realized (trading + yields) for the drill-down.
  const { positions, realizedEvents } = computeItemPositions(transactions);
  const windowedByItem = new Map<string, { realized: number; basisSold: number }>();
  for (const event of realizedEvents) {
    if (!inWindow(event.date)) continue;
    const acc = windowedByItem.get(event.item_id) ?? { realized: 0, basisSold: 0 };
    acc.realized += event.realized;
    acc.basisSold += event.basisSold;
    windowedByItem.set(event.item_id, acc);
  }
  // Yields fold into the item's realized amount, never its trading basis.
  const yieldByItem = new Map<string, number>();
  for (const y of yields) {
    if (!inWindow(y.date)) continue;
    yieldByItem.set(y.item_id, (yieldByItem.get(y.item_id) ?? 0) + y.amount);
  }
  // Full yield history per item (any date) for the drill-down ledger.
  const yieldRowsByItem = new Map<string, { amount: number; date: string }[]>();
  for (const y of yields) {
    const list = yieldRowsByItem.get(y.item_id);
    if (list) list.push({ amount: y.amount, date: y.date });
    else yieldRowsByItem.set(y.item_id, [{ amount: y.amount, date: y.date }]);
  }

  const txsByItem = new Map<string, typeof transactions>();
  for (const tx of transactions) {
    const list = txsByItem.get(tx.item_id);
    if (list) list.push(tx);
    else txsByItem.set(tx.item_id, [tx]);
  }

  const groups: ClassGroup[] = investmentConfig.assetClasses
    .filter((c) => c.is_active)
    .sort((a, b) => a.sort - b.sort)
    .map((assetClass) => ({
      assetClass,
      items: investmentConfig.items
        .filter(
          (item) =>
            item.asset_class_id === assetClass.id &&
            (txsByItem.has(item.id) || yieldRowsByItem.has(item.id))
        )
        .map((item) => {
          const pos = positions.get(item.id);
          const windowed = windowedByItem.get(item.id);
          const itemYield = yieldByItem.get(item.id) ?? 0;
          const realized = (windowed?.realized ?? 0) + itemYield;
          // % denominator: basis sold (trading, as always) — plus the open
          // cost when yields exist, so a dividend reads as yield-on-cost.
          const pctBase =
            (windowed?.basisSold ?? 0) + (itemYield !== 0 ? (pos?.costBasis ?? 0) : 0);
          return {
            item,
            units: pos?.units ?? null,
            costBasis: pos?.costBasis ?? 0,
            realized,
            realizedPct: pctBase > 0 ? realized / pctBase : null,
            transactions: [...(txsByItem.get(item.id) ?? [])].reverse(), // newest first
            yields: [...(yieldRowsByItem.get(item.id) ?? [])].reverse(), // newest first
          };
        })
        .sort((a, b) => b.costBasis - a.costBasis),
    }))
    .filter((group) => group.items.length > 0);

  // Flat ledger of everything in the window — buys/sells + yields.
  const itemById = new Map(investmentConfig.items.map((i) => [i.id, i]));
  const classById = new Map(investmentConfig.assetClasses.map((c) => [c.id, c.name]));
  const nameOf = (itemId: string) => itemById.get(itemId)?.name ?? "?";
  const classOf = (itemId: string) => {
    const item = itemById.get(itemId);
    return item ? (classById.get(item.asset_class_id) ?? "") : "";
  };
  const tradeLogRows: TradeLogRow[] = [
    ...transactions.filter((tx) => inWindow(tx.date)).map((tx) => ({
      id: tx.id,
      date: tx.date,
      itemName: nameOf(tx.item_id),
      className: classOf(tx.item_id),
      kind: tx.side,
      amount: tx.amount,
      quantity: tx.quantity,
    })),
    ...yields
      .filter((y) => inWindow(y.date))
      .map((y, i) => ({
        id: `yield-${i}`,
        date: y.date,
        itemName: nameOf(y.item_id),
        className: classOf(y.item_id),
        kind: "yield" as const,
        amount: y.amount,
        quantity: null,
      })),
  ];

  const dataWarnings = [...positions.values()].flatMap((p) => p.warnings);
  const showBudget = view === "yearly";
  const realized = summary.totals.realized;
  const netWorth = showBudget ? budgetSummary.totals.netWorth : summary.totals.netWorth;
  const undeployed = Math.max(summary.totals.budget - summary.totals.deployed, 0);

  return (
    <div className="space-y-[18px] pb-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-[28px] font-bold tracking-[-0.02em]">Investments</h1>
          <p className="mt-1 text-[12.5px] text-muted-foreground">
            {view === "yearly"
              ? `${formatDate(range.start)} – ${formatDate(range.end)} · budget year ${year}`
              : "Everything ever recorded"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <InvestmentsPeriodPicker view={view} year={year} />
          <YieldDialog
            assetClasses={investmentConfig.assetClasses}
            items={investmentConfig.items}
            incomeTypes={config.incomeTypes}
            budgetTypes={config.budgetTypes}
            latestSplitByType={latestSplitByType}
          />
          <TransactionDialog
            assetClasses={investmentConfig.assetClasses}
            items={investmentConfig.items}
            remainingByClass={remainingByClass}
          />
        </div>
      </div>

      {dataWarnings.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {dataWarnings.map((warning, i) => (
            <Badge key={i} variant="warning">
              ⚠ {warning}
            </Badge>
          ))}
        </div>
      )}

      {/* Stat row */}
      <div className="grid grid-cols-2 gap-3.5 md:grid-cols-4">
        <div className="rounded-[16px] bg-primary px-[18px] py-4 text-primary-foreground md:px-[22px] md:py-5">
          <div className="text-[12px] font-medium text-on-ink">Net worth</div>
          <div className="mt-1.5 text-[19px] font-bold tracking-[-0.01em] tabular-nums md:text-[24px]">
            {formatIDR(netWorth)}
          </div>
          <div className="mt-1 text-[11px] text-on-ink">
            {showBudget ? "holdings + undeployed budget" : "holdings + undeployed capital"}
          </div>
        </div>
        <Stat label="Holdings at cost" value={formatIDR(summary.totals.holdingsCost)} />
        <Stat
          label={view === "yearly" ? `Realized P&L · ${year}` : "Realized P&L · all time"}
          value={`${realized < 0 ? "−" : realized > 0 ? "+" : ""}${formatIDR(Math.abs(realized))}`}
          tone={realized < 0 ? "loss" : realized > 0 ? "profit" : undefined}
        />
        {showBudget ? (
          <Stat
            label={`Deployed · budget ${year}`}
            value={`${formatIDR(Math.max(summary.totals.deployed, 0))} / ${formatIDR(summary.totals.budget)}`}
          />
        ) : (
          <Stat
            label="Undeployed capital"
            value={formatIDR(undeployed)}
            caption={`of ${formatIDR(summary.totals.budget)} total budget, all years`}
          />
        )}
      </div>

      {/* Class cards */}
      <div>
        <div className="flex items-baseline justify-between">
          <span className="text-[16px] font-bold">Asset classes</span>
          <span className="text-[12.5px] text-muted-foreground">
            {showBudget
              ? `Invest envelope ${year}: ${formatIDR(investBudget)} × target %`
              : "Holdings & realized, all time"}
          </span>
        </div>
        <div className="mt-3.5 grid grid-cols-2 gap-3.5 md:grid-cols-4">
          {summary.classes.map((row) => (
            <ClassCard key={row.asset_class_id} row={row} showBudget={showBudget} />
          ))}
        </div>
      </div>

      {/* Holdings drill-down */}
      <div>
        <div className="text-[16px] font-bold">Holdings & performance</div>
        <div className="mt-3.5">
          {groups.length === 0 ? (
            <div className="rounded-[14px] border border-dashed border-input bg-card px-6 py-8 text-center">
              <div className="text-[13.5px] font-semibold">No transactions yet</div>
              <div className="mt-1 text-[12.5px] text-muted-foreground">
                Record your first buy to start tracking performance.
              </div>
            </div>
          ) : (
            <ItemSection
              groups={groups}
              assetClasses={investmentConfig.assetClasses}
              allItems={investmentConfig.items}
              remainingByClass={remainingByClass}
            />
          )}
        </div>
      </div>

      {/* Log — every buy/sell/yield in the window, chronological */}
      <div>
        <div className="flex items-baseline justify-between">
          <span className="text-[16px] font-bold">Log</span>
          <span className="text-[12.5px] text-muted-foreground">
            {tradeLogRows.length} {tradeLogRows.length === 1 ? "entry" : "entries"}
          </span>
        </div>
        <div className="mt-3.5">
          <TradeLog rows={tradeLogRows} />
        </div>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  caption,
  tone,
}: {
  label: string;
  value: string;
  caption?: string;
  tone?: "profit" | "loss";
}) {
  return (
    <div className="rounded-[16px] bg-card px-[18px] py-4 shadow-[0_1px_2px_rgba(38,35,30,0.05)] md:px-[22px] md:py-5">
      <div className="text-[12px] font-medium text-muted-foreground">{label}</div>
      <div
        className="mt-1.5 text-[17px] font-bold tracking-[-0.01em] tabular-nums md:text-[20px]"
        style={
          tone === "loss"
            ? { color: "oklch(0.52 0.16 25)" }
            : tone === "profit"
              ? { color: "oklch(0.5 0.12 155)" }
              : undefined
        }
      >
        {value}
      </div>
      {caption && <div className="mt-1 text-[11px] text-muted-foreground">{caption}</div>}
    </div>
  );
}
