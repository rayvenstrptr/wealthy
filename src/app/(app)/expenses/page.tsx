import { currentMonthWIB, formatDate, monthRange } from "@/lib/dates";
import { getConfig, getExpenses } from "@/lib/data";
import { formatIDR } from "@/lib/format";
import { ExpenseFilters } from "@/components/expense-filters";
import { ExpenseList } from "@/components/expense-list";

interface SearchParams {
  month?: string;
  budget?: string;
  category?: string;
  event?: string;
  q?: string;
}

export default async function ExpensesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const defaultMonth = currentMonthWIB();
  const month = params.month ?? defaultMonth;
  const budget = params.budget ?? "all";
  const category = params.category ?? "all";
  const event = params.event ?? "all";
  const q = params.q ?? "";

  const range = month !== "all" ? monthRange(month) : undefined;

  const [config, expenses] = await Promise.all([
    getConfig(),
    getExpenses({
      start: range?.start,
      end: range?.end,
      budgetTypeId: budget !== "all" ? budget : undefined,
      categoryId: category !== "all" ? category : undefined,
      eventId: event !== "all" ? event : undefined,
      search: q || undefined,
    }),
  ]);

  const total = expenses.reduce((sum, e) => sum + e.amount, 0);

  return (
    <div className="space-y-4">
      <div className="flex items-baseline justify-between">
        <h1 className="text-xl font-semibold">Expenses</h1>
        <span className="text-sm text-muted-foreground">
          {expenses.length} entries · <span className="font-medium text-foreground">{formatIDR(total)}</span>
        </span>
      </div>

      <ExpenseFilters
        values={{ month, budget, category, event, q }}
        budgetTypes={config.budgetTypes}
        categories={config.categories}
        events={config.events}
        defaultMonth={defaultMonth}
      />

      {range && (
        <p className="text-xs text-muted-foreground">
          Budget month: {formatDate(range.start)} – {formatDate(range.end)}
        </p>
      )}

      <ExpenseList
        expenses={expenses}
        budgetTypes={config.budgetTypes}
        categories={config.categories}
        events={config.events}
      />
    </div>
  );
}
