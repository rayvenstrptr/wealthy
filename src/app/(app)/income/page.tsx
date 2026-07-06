import type { SplitCell } from "@/lib/allocation-split";
import { currentMonthWIB } from "@/lib/dates";
import { normalizePeriod, periodLabel, periodRange } from "@/lib/period";
import {
  getConfig,
  getIncomeAllocations,
  getIncomes,
  getLatestSplitByIncomeType,
} from "@/lib/data";
import { formatIDR } from "@/lib/format";
import { IncomeList } from "@/components/income-list";

interface SearchParams {
  month?: string;
  type?: string;
  q?: string;
}

export default async function IncomePage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const defaultMonth = currentMonthWIB();
  const month = normalizePeriod(params.month, defaultMonth);
  const type = params.type ?? "all";
  const q = params.q ?? "";

  const range = periodRange(month);

  const [config, incomes, latestSplitByType] = await Promise.all([
    getConfig(),
    getIncomes({
      start: range?.start,
      end: range?.end,
      incomeTypeId: type !== "all" ? type : undefined,
      search: q || undefined,
    }),
    getLatestSplitByIncomeType(),
  ]);

  const allocations = await getIncomeAllocations(incomes.map((i) => i.id));
  const splitByIncome: Record<string, SplitCell[]> = {};
  for (const cell of allocations) {
    (splitByIncome[cell.income_id] ??= []).push({
      budget_type_id: cell.budget_type_id,
      amount: cell.amount,
    });
  }

  const total = incomes.reduce((sum, i) => sum + i.amount, 0);

  return (
    <div className="space-y-[18px]">
      <div className="flex items-baseline justify-between gap-4">
        <h1 className="text-[28px] font-bold tracking-[-0.02em]">Income</h1>
        <p className="text-[12.5px] text-muted-foreground">
          {periodLabel(month)} ·{" "}
          <span className="font-medium text-foreground tabular-nums">{formatIDR(total)}</span> total
        </p>
      </div>

      <IncomeList
        incomes={incomes}
        incomeTypes={config.incomeTypes}
        budgetTypes={config.budgetTypes}
        splitByIncome={splitByIncome}
        latestSplitByType={latestSplitByType}
        month={month}
        defaultMonth={defaultMonth}
        type={type}
        q={q}
      />
    </div>
  );
}
