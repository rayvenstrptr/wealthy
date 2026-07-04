import { currentMonthWIB, formatDate, monthRange } from "@/lib/dates";
import { getConfig, getIncomes } from "@/lib/data";
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
  const month = params.month ?? defaultMonth;
  const type = params.type ?? "all";
  const q = params.q ?? "";

  const range = month !== "all" ? monthRange(month) : undefined;

  const [config, incomes] = await Promise.all([
    getConfig(),
    getIncomes({
      start: range?.start,
      end: range?.end,
      incomeTypeId: type !== "all" ? type : undefined,
      search: q || undefined,
    }),
  ]);

  const total = incomes.reduce((sum, i) => sum + i.amount, 0);

  return (
    <div className="space-y-4">
      <div className="flex items-baseline justify-between">
        <h1 className="text-xl font-semibold">Income</h1>
        <span className="text-sm text-muted-foreground">
          {incomes.length} entries ·{" "}
          <span className="font-medium text-foreground">{formatIDR(total)}</span>
        </span>
      </div>

      {range && (
        <p className="text-xs text-muted-foreground">
          Budget month: {formatDate(range.start)} – {formatDate(range.end)}
        </p>
      )}

      <IncomeList
        incomes={incomes}
        incomeTypes={config.incomeTypes}
        month={month}
        type={type}
        q={q}
      />
    </div>
  );
}
